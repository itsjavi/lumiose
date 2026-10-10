//! Machine-independent module ids for island refs and scope tokens (TASK-74).
//!
//! A module inside the project root is named root-relatively (`/src/x.stsx`). A module outside it
//! but inside a package the host listed (a linked workspace package) is named package-relatively
//! (`@acme/ui/src/Nav.stsx`, the same string as a deep import of it). Anything else keeps its id
//! as given. So refs in server-rendered HTML and scope tokens do not depend on where the project
//! sits on the build machine.

/// A package outside the project root whose modules get package-relative ids.
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

/// `@acme/ui/src/Nav.stsx` for a module inside one of `packages` (the innermost wins).
pub(crate) fn package_relative(id: &str, packages: &[PackageRoot]) -> Option<String> {
    packages
        .iter()
        .filter_map(|package| within(id, &package.dir).map(|rest| (package, rest)))
        .max_by_key(|(package, _)| package.dir.len())
        .map(|(package, rest)| format!("{}{rest}", package.name))
}

/// The id island refs use: root-relative (`/src/x.stsx`), package-relative, or `id` as given.
/// `id` is a cleaned, absolute module id (or a relative one when there is no root).
pub(crate) fn stable_id(id: &str, root: Option<&str>, packages: &[PackageRoot]) -> String {
    if let Some(rest) = root.and_then(|root| within(id, root)) {
        return rest.to_owned();
    }
    package_relative(id, packages).unwrap_or_else(|| id.to_owned())
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
}
