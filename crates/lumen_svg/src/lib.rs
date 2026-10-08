//! `.svg` imports as Lumen components (decision-22, TASK-70).
//!
//! [`component_source`] turns an SVG document into the `.stsx` source of a module whose default
//! export renders it inline; the host compiles that source with `lumen_compiler` for either
//! target, so the component works the same on the client, on the server and in islands. The
//! markup becomes a static template: rendering an icon clones it.
//!
//! # The component
//!
//! - The file's root attributes are the defaults; the component's props are spread after them,
//!   so `class`, `style`, `width`, `height`, `fill`, `aria-*` and events override them.
//! - `title` renders a `<title>` as the first child with `role="img"` and `aria-labelledby`
//!   pointing at it. Without `title`, `aria-label` or `aria-labelledby` the icon is decorative:
//!   `aria-hidden="true"`. The `<title>` id is derived from the file and the title text, so it is
//!   the same on the server and the client (no counter to keep in sync for hydration).
//! - `children` is ignored.
//!
//! # Sanitisation and ids
//!
//! The host optimises the file first (the Vite plugin runs SVGO); this crate does not optimise.
//! These transforms always run:
//! - scripts, event attributes, `javascript:` URLs and SMIL animations of a link target are
//!   removed;
//! - ids get a per-file prefix (`l<hash>__`), and so do the references to them, so two icons on
//!   a page, or an icon and the page, never share one (repeated uses of the same icon still
//!   repeat its ids); class names get it too when the file has a `<style>` (otherwise they stay
//!   hooks for the page's CSS);
//! - comments, processing instructions, the doctype, the file's own `<title>` (`title` is the
//!   prop), namespace declarations and foreign-namespace markup (editor data) are dropped;
//! - `xlink:href` becomes `href`.
//!
//! A `<style>` inside the file stays native SVG CSS and, once inlined, applies to the whole
//! document like any inline SVG's; the prefixes keep its rules to this icon.

mod emit;
mod prefix;

use std::fmt;

/// A file that is not a well-formed SVG document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SvgError {
    /// What is wrong; XML errors end with their position (`… at 1:12`).
    pub message: String,
    /// One-based line and column of the problem in the source, when known.
    pub position: Option<(u32, u32)>,
}

impl fmt::Display for SvgError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // XML errors already end with their position (`at 1:12`).
        f.write_str(&self.message)
    }
}

impl std::error::Error for SvgError {}

/// The `.stsx` source of a module whose default export renders `svg` inline. Compile it as a
/// `.stsx` file (the `<style>` of an SVG is native CSS there).
///
/// # Errors
///
/// When `svg` is not well-formed XML or its root element is not `<svg>`.
pub fn component_source(svg: &str) -> Result<String, SvgError> {
    emit::component(svg, &format!("l{}", short_hash(svg)))
}

/// Six base-36 characters of a 64-bit FNV-1a hash of `text`.
fn short_hash(text: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    let mut out = String::new();
    for _ in 0..6 {
        let digit = u32::try_from(hash % 36).expect("a base-36 digit");
        out.push(char::from_digit(digit, 36).expect("a base-36 digit"));
        hash /= 36;
    }
    out
}

/// Parses `svg` with the options every step uses (DTDs are allowed: editors still write them).
fn parse_options<'input>() -> roxmltree::ParsingOptions<'input> {
    roxmltree::ParsingOptions {
        allow_dtd: true,
        ..roxmltree::ParsingOptions::default()
    }
}

fn xml_error(error: &roxmltree::Error) -> SvgError {
    let position = error.pos();
    SvgError {
        message: format!("invalid SVG: {error}"),
        position: Some((position.row, position.col)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_short_and_stable() {
        assert_eq!(short_hash("<svg/>"), short_hash("<svg/>"));
        assert_ne!(short_hash("<svg/>"), short_hash("<svg />"));
        assert_eq!(short_hash("").len(), 6);
    }

    #[test]
    fn reports_malformed_documents() {
        let error = component_source("<svg><path></svg>").unwrap_err();
        assert!(error.message.starts_with("invalid SVG"), "{error}");
        assert_eq!(error.position.map(|(line, _)| line), Some(1));
        let error = component_source("<html/>").unwrap_err();
        assert_eq!(
            error.message,
            "the root element is `<html>`, expected `<svg>`"
        );
        assert!(component_source("").is_err());
    }
}
