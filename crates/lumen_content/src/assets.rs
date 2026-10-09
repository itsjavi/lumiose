//! Relative asset URLs in the markup become imports (TASK-107), so Vite serves them in dev and
//! fingerprints them in builds, the way it treats the asset URLs of an HTML entry.
//!
//! The URL attributes of media elements (`<img src>`, `srcset`, `<video poster>`…) and links to
//! files (`<a href="./report.pdf">`, not to pages) are rewritten when they are relative:
//! `./photo.jpg`, `photo.jpg`, `../img/a.png`. Absolute paths (`/logo.svg`, served from
//! `public/`), URLs with a scheme or `//`, fragments (`#top`) and URLs with a query are kept.
//! Each file is imported once, with `?url` (its URL, whatever other plugins do with the file),
//! and a fragment is appended to the imported URL.

use crate::emit::js_string;

/// The URL attributes rewritten per HTML element: `(element, attribute)`.
const URL_ATTRIBUTES: [(&str, &str); 9] = [
    ("img", "src"),
    ("img", "srcset"),
    ("source", "src"),
    ("source", "srcset"),
    ("video", "src"),
    ("video", "poster"),
    ("audio", "src"),
    ("track", "src"),
    ("a", "href"),
];

/// Extensions of pages, which an `<a href>` navigates to rather than downloads.
const PAGE_EXTENSIONS: [&str; 4] = ["html", "htm", "md", "xhtml"];

/// The asset imports of a module, in first-use order.
#[derive(Default)]
pub(crate) struct Assets {
    specifiers: Vec<String>,
}

impl Assets {
    /// The JS expression of an attribute value with its relative URLs imported, when the
    /// attribute is a URL attribute of `element` (an HTML element) and has one.
    pub(crate) fn expression(
        &mut self,
        element: &str,
        attribute: &str,
        value: &str,
    ) -> Option<String> {
        if !URL_ATTRIBUTES.contains(&(element, attribute)) {
            return None;
        }
        if attribute == "srcset" {
            return self.srcset(value);
        }
        let (path, fragment) = asset_path(value)?;
        if element == "a" && !is_file(path) {
            return None;
        }
        let mut expression = self.import(path);
        if !fragment.is_empty() {
            expression.push_str(" + ");
            expression.push_str(&js_string(fragment));
        }
        Some(expression)
    }

    /// A `srcset` with each relative candidate URL imported: `a0 + " 1x, " + a1 + " 2x"`.
    fn srcset(&mut self, value: &str) -> Option<String> {
        let candidates = srcset_candidates(value);
        if !candidates
            .iter()
            .any(|(url, _)| asset_path(url).is_some_and(|(_, fragment)| fragment.is_empty()))
        {
            return None;
        }
        let mut parts: Vec<String> = Vec::new();
        let mut text = String::new();
        for (i, (url, descriptor)) in candidates.into_iter().enumerate() {
            if i > 0 {
                text.push_str(", ");
            }
            match asset_path(url) {
                Some((path, "")) => {
                    if !text.is_empty() {
                        parts.push(js_string(&text));
                        text.clear();
                    }
                    parts.push(self.import(path));
                }
                _ => text.push_str(url),
            }
            if !descriptor.is_empty() {
                text.push(' ');
                text.push_str(descriptor);
            }
        }
        if !text.is_empty() {
            parts.push(js_string(&text));
        }
        Some(parts.join(" + "))
    }

    /// The local name of the URL of `path` (imported once).
    fn import(&mut self, path: &str) -> String {
        let specifier = specifier(path);
        let index = self
            .specifiers
            .iter()
            .position(|known| *known == specifier)
            .unwrap_or_else(|| {
                self.specifiers.push(specifier);
                self.specifiers.len() - 1
            });
        format!("lumenAsset{index}")
    }

    /// The module's import declarations.
    pub(crate) fn imports(&self) -> String {
        self.specifiers
            .iter()
            .enumerate()
            .map(|(i, specifier)| format!("import lumenAsset{i} from {};\n", js_string(specifier)))
            .collect()
    }
}

/// `(path, fragment)` of a relative URL (`./a.png#x` → `("./a.png", "#x")`), or `None` for an
/// absolute, protocol-relative, scheme, fragment-only or empty URL, or one with a query.
fn asset_path(url: &str) -> Option<(&str, &str)> {
    let url = url.trim();
    let (path, fragment) = url.find('#').map_or((url, ""), |i| url.split_at(i));
    let has_scheme = path.split_once(':').is_some_and(|(scheme, _)| {
        scheme.starts_with(|c: char| c.is_ascii_alphabetic())
            && scheme
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    });
    let relative = !path.is_empty()
        && !path.starts_with(['/', '\\', '?'])
        && !path.contains('?')
        && !has_scheme
        && path != "."
        && path != ".."
        && !path.ends_with('/');
    relative.then_some((path, fragment))
}

/// Whether a link's path names a file to download or open, not a page (no extension, `.html`,
/// `.md`).
fn is_file(path: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    name.rsplit_once('.').is_some_and(|(stem, extension)| {
        !stem.is_empty()
            && !extension.is_empty()
            && !PAGE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
    })
}

/// The import specifier of a relative path: relative to the file, percent-decoded (Markdown
/// encodes spaces), with `?url`.
fn specifier(path: &str) -> String {
    let path = percent_decode(path);
    let prefix = if path.starts_with("./") || path.starts_with("../") {
        ""
    } else {
        "./"
    };
    format!("{prefix}{path}?url")
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = |b: u8| char::from(b).to_digit(16);
        if bytes[i] == b'%'
            && let (Some(high), Some(low)) = (
                bytes.get(i + 1).copied().and_then(hex),
                bytes.get(i + 2).copied().and_then(hex),
            )
        {
            // Two hex digits: at most 255.
            out.push(u8::try_from(high * 16 + low).unwrap_or(b'%'));
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).unwrap_or_else(|_| text.to_owned())
}

/// The `(url, descriptor)` candidates of a `srcset`, as the HTML spec splits them: a URL runs to
/// the next whitespace (a trailing comma ends the candidate), its descriptor to the next comma.
fn srcset_candidates(value: &str) -> Vec<(&str, &str)> {
    let mut candidates = Vec::new();
    let mut rest = value;
    loop {
        rest = rest.trim_start_matches(|c: char| c.is_ascii_whitespace() || c == ',');
        if rest.is_empty() {
            return candidates;
        }
        let end = rest
            .find(|c: char| c.is_ascii_whitespace())
            .unwrap_or(rest.len());
        let url = &rest[..end];
        if let Some(url) = url.strip_suffix(',') {
            candidates.push((url.trim_end_matches(','), ""));
            rest = &rest[end..];
            continue;
        }
        rest = &rest[end..];
        let end = rest.find(',').unwrap_or(rest.len());
        candidates.push((url, rest[..end].trim()));
        rest = &rest[end..];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_urls() {
        assert_eq!(asset_path("./a.png"), Some(("./a.png", "")));
        assert_eq!(asset_path(" img/a.png#x "), Some(("img/a.png", "#x")));
        assert_eq!(asset_path("../a.svg"), Some(("../a.svg", "")));
        for url in [
            "",
            "/a.png",
            "//cdn/a.png",
            "https://x/a.png",
            "data:image/png;base64,AA",
            "#top",
            "?q",
            "a.png?v=1",
            "mailto:a@b",
            "docs/",
            ".",
            "..",
        ] {
            assert_eq!(asset_path(url), None, "{url}");
        }
    }

    #[test]
    fn links_to_files() {
        assert!(is_file("./report.pdf") && is_file("files/a.tar.gz") && is_file("./a.PNG"));
        assert!(!is_file("./about") && !is_file("./post.md") && !is_file("page.HTML"));
        assert!(!is_file("./.hidden") && !is_file("../v1.2/"));
    }

    #[test]
    fn specifiers() {
        assert_eq!(specifier("a.png"), "./a.png?url");
        assert_eq!(specifier("../my%20photo.jpg"), "../my photo.jpg?url");
        assert_eq!(specifier("./100%25.png"), "./100%.png?url");
        assert_eq!(specifier("./bad%zz.png"), "./bad%zz.png?url");
    }

    #[test]
    fn srcsets() {
        assert_eq!(
            srcset_candidates(" a.png 1x,b.png  2x , c.png, d.png,"),
            [
                ("a.png", "1x"),
                ("b.png", "2x"),
                ("c.png", ""),
                ("d.png", "")
            ]
        );
        let mut assets = Assets::default();
        assert_eq!(
            assets
                .expression("img", "srcset", "./a.png 1x, /b.png 2x, ./a.png 3x")
                .as_deref(),
            Some("lumenAsset0 + \" 1x, /b.png 2x, \" + lumenAsset0 + \" 3x\"")
        );
        assert_eq!(
            assets.expression("img", "srcset", "/a.png 1x, https://x/b.png 2x"),
            None
        );
        assert_eq!(
            assets.imports(),
            "import lumenAsset0 from \"./a.png?url\";\n"
        );
    }

    #[test]
    fn elements_and_attributes() {
        let mut assets = Assets::default();
        assert_eq!(
            assets
                .expression("a", "href", "./guide.pdf#page=2")
                .as_deref(),
            Some("lumenAsset0 + \"#page=2\"")
        );
        assert_eq!(assets.expression("a", "href", "./next.md"), None);
        assert_eq!(assets.expression("img", "alt", "./a.png"), None);
        assert_eq!(assets.expression("div", "src", "./a.png"), None);
        assert_eq!(
            assets.expression("video", "poster", "p.jpg").as_deref(),
            Some("lumenAsset1")
        );
    }
}
