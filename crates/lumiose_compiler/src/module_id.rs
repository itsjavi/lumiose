//! Machine-independent module ids for island refs and scope tokens (TASK-74).
//!
//! A module inside the project root is named root-relatively (`/src/x.stsx`). A module inside a
//! package the host listed (a linked workspace package, or a Lumiose package installed in
//! `node_modules`) is named package-relatively (`@acme/ui/src/Nav.stsx`, the same string as a deep
//! import of it). When both contain it, the innermost directory wins: a package installed under
//! the root's `node_modules` is named by its package, a root inside a package by the root.
//! Anything else keeps its id as given. So refs in server-rendered HTML and scope tokens depend
//! neither on where the project sits on the build machine nor on the package manager's layout.

/// A package whose modules get package-relative ids.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageRoot {
    /// The package name (`@acme/ui`).
    pub name: String,
    /// The package directory (absolute, as module ids are).
    pub dir: String,
}

/// The module id without its query or hash, with `/` separators.
pub(crate) fn clean_id(filename: &str) -> String {
    filename
        .split(['?', '#'])
        .next()
        .unwrap_or_default()
        .replace('\\', "/")
}

/// The rest of `id` after the directory `dir` (starting with `/`), when `id` is inside it.
pub(crate) fn within<'a>(id: &'a str, dir: &str) -> Option<&'a str> {
    let dir = dir.replace('\\', "/");
    id.strip_prefix(dir.trim_end_matches('/'))
        .filter(|rest| rest.starts_with('/'))
}

/// The innermost of `packages` that contains `id`, with the rest of `id` after its directory.
fn innermost_package<'a>(
    id: &'a str,
    packages: &'a [PackageRoot],
) -> Option<(&'a PackageRoot, &'a str)> {
    packages
        .iter()
        .filter_map(|package| within(id, &package.dir).map(|rest| (package, rest)))
        .max_by_key(|(package, _)| package.dir.trim_end_matches('/').len())
}

/// Where `id` is named from: the rest after the root (`Root`), or a package name and the rest
/// after its directory (`Package`), whichever directory is innermost; the root wins a tie.
pub(crate) enum Base<'a> {
    Root(&'a str),
    Package(&'a str, &'a str),
}

pub(crate) fn base<'a>(
    id: &'a str,
    root: Option<&str>,
    packages: &'a [PackageRoot],
) -> Option<Base<'a>> {
    let package = innermost_package(id, packages);
    if let Some(root) = root
        && let Some(rest) = within(id, root)
    {
        let root_len = root.replace('\\', "/").trim_end_matches('/').len();
        match package {
            Some((package, rest)) if package.dir.trim_end_matches('/').len() > root_len => {
                return Some(Base::Package(&package.name, rest));
            }
            _ => return Some(Base::Root(rest)),
        }
    }
    package.map(|(package, rest)| Base::Package(&package.name, rest))
}

/// The id island refs use: root-relative (`/src/x.stsx`), package-relative, or `id` as given.
/// `id` is a cleaned, absolute module id (or a relative one when there is no root).
pub(crate) fn stable_id(id: &str, root: Option<&str>, packages: &[PackageRoot]) -> String {
    match base(id, root, packages) {
        Some(Base::Root(rest)) => rest.to_owned(),
        Some(Base::Package(name, rest)) => format!("{name}{rest}"),
        None => id.to_owned(),
    }
}

/// True when `specifier`, imported by the module `importer`, names a server-only module (spec
/// §7.2, LUM4003): a `*.server.*` file, or a file under `src/server/` of the project (`root`).
/// Only relative and root-relative specifiers are resolved; bare and aliased ones match only by
/// their file name.
pub(crate) fn is_server_only_import(specifier: &str, importer: &str, root: Option<&str>) -> bool {
    let path = specifier.split(['?', '#']).next().unwrap_or_default();
    let file = path.rsplit('/').next().unwrap_or_default();
    if file.split('.').skip(1).any(|part| part == "server") {
        return true;
    }
    let resolved = if path.starts_with("./") || path.starts_with("../") {
        let importer = clean_id(importer);
        let dir = importer.rsplit_once('/').map_or("", |(dir, _)| dir);
        normalize(&format!("{dir}/{path}"))
    } else if path.starts_with('/') {
        normalize(path)
    } else {
        return false;
    };
    match root.and_then(|root| within(&resolved, root)) {
        Some(rest) => rest.starts_with("/src/server/"),
        // Vite's root-relative ids (`/src/server/db.ts`), or no root: any `src/server/` directory.
        None => resolved.starts_with("/src/server/") || resolved.contains("/src/server/"),
    }
}

/// Resolves `.` and `..` segments of a `/`-separated path.
fn normalize(path: &str) -> String {
    let mut segments: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "." => {}
            ".." if segments.last().is_some_and(|s| !s.is_empty() && *s != "..") => {
                segments.pop();
            }
            _ => segments.push(segment),
        }
    }
    segments.join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_only_imports() {
        let importer = "/app/src/routes/books/[isbn].stsx";
        let root = Some("/app");
        let server = |specifier: &str| is_server_only_import(specifier, importer, root);
        assert!(server("../../server/queries.server.ts"));
        assert!(server("./db.server"));
        assert!(server("~/lib/auth.server.js"));
        assert!(server("../../server/db.ts"));
        assert!(server("/src/server/db.ts"));
        assert!(!server("../../lib/server-utils.ts"));
        assert!(!server("../../components/server/Nav.stsx"));
        assert!(!server("lumiose/server"));
        assert!(!server("lumiose"));
        assert!(!server("./serverless.ts"));
        assert!(is_server_only_import(
            "../server/db.ts",
            "/elsewhere/src/routes/a.stsx",
            None
        ));
        assert_eq!(normalize("/a/b/../../c/./d"), "/c/d");
    }

    fn kit() -> Vec<PackageRoot> {
        vec![
            PackageRoot {
                name: "@acme/kit".into(),
                dir: "/repo/packages/kit/".into(),
            },
            PackageRoot {
                name: "@acme/kit-icons".into(),
                dir: "/repo/packages/kit/icons".into(),
            },
        ]
    }

    #[test]
    fn ids_are_root_relative_then_package_relative() {
        let root = Some("/repo/apps/web");
        let packages = kit();
        let id = |path: &str| stable_id(path, root, &packages);
        assert_eq!(id("/repo/apps/web/src/App.stsx"), "/src/App.stsx");
        assert_eq!(
            id("/repo/packages/kit/src/Nav.stsx"),
            "@acme/kit/src/Nav.stsx"
        );
        assert_eq!(
            id("/repo/packages/kit/icons/Star.stsx"),
            "@acme/kit-icons/Star.stsx"
        );
        assert_eq!(
            id("/repo/packages/kitchen/A.stsx"),
            "/repo/packages/kitchen/A.stsx"
        );
        assert_eq!(id("/elsewhere/A.stsx"), "/elsewhere/A.stsx");
        assert_eq!(clean_id(r"C:\repo\a.stsx?x=1"), "C:/repo/a.stsx");
    }

    #[test]
    fn the_innermost_of_root_and_package_names_a_module() {
        // A package installed in the root's node_modules (pnpm's layout) is named by its package.
        let installed = vec![PackageRoot {
            name: "@acme/ui".into(),
            dir: "/app/node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui".into(),
        }];
        assert_eq!(
            stable_id(
                "/app/node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui/dist/Nav.tsx",
                Some("/app/"),
                &installed
            ),
            "@acme/ui/dist/Nav.tsx"
        );
        assert_eq!(
            stable_id("/app/src/App.stsx", Some("/app"), &installed),
            "/src/App.stsx"
        );
        // A root inside a listed package (a showcase app of the kit) names its own modules.
        assert_eq!(
            stable_id(
                "/repo/packages/kit/showcase/src/App.stsx",
                Some("/repo/packages/kit/showcase"),
                &kit()
            ),
            "/src/App.stsx"
        );
    }
}
