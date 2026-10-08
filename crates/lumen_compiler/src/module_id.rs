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

#[cfg(test)]
mod tests {
    use super::*;

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
