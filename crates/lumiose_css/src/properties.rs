//! Declarations browsers ignore whatever their value: unknown property names (`LUM3020`) and
//! empty values (`LUM3017`), plus `{` without a matching `}` (`LUM3014`). Lightning CSS keeps all
//! three without a warning: an unknown property as a custom one, an empty value as raw tokens,
//! and an unclosed block closed at the end of the text.
//!
//! A property is known when it is in [`KNOWN_PROPERTIES`] (MDN's list) or Lightning CSS parses
//! its name. Custom properties (`--x`), vendor-prefixed names (`-webkit-…`) and at-rule
//! descriptors (`@font-face`) are not checked, nor are names that are not plain identifiers
//! (`*zoom` hacks, `$ref`s).

use lightningcss::properties::PropertyId;

use crate::Span;
use crate::diagnostics::{CssCode, CssDiagnostic, Fix, TextEdit};
use crate::known_properties::KNOWN_PROPERTIES;
use crate::prepass::Declaration;

/// The diagnostics of one block's declarations and unclosed blocks, with block-relative spans.
pub(crate) fn check(
    content: &str,
    declarations: &[Declaration],
    unclosed: &[usize],
) -> Vec<CssDiagnostic> {
    let mut diagnostics = Vec::new();
    for declaration in declarations.iter().filter(|d| !d.descriptor) {
        let name = &content[declaration.name.clone()];
        if name.starts_with('-') || !is_identifier(name) {
            continue;
        }
        let lower = name.to_ascii_lowercase();
        let span = Span::from_usize(declaration.name.start, declaration.name.end);
        if !is_known(&lower) {
            diagnostics.push(unknown_property(name, &lower, span));
        } else if is_empty(&content[declaration.value.clone()]) {
            diagnostics.push(
                CssDiagnostic::new(
                    CssCode::InvalidCssValue,
                    span,
                    format!("`{name}` has no value, so browsers ignore the declaration"),
                )
                .with_help("Give it a value, or remove the declaration"),
            );
        }
    }
    for &brace in unclosed {
        let prelude = content[..brace].trim_end();
        let start = prelude.rfind(['{', '}', ';']).map_or(0, |i| i + 1);
        let start = start + (prelude.len() - start - prelude[start..].trim_start().len());
        diagnostics.push(
            CssDiagnostic::new(
                CssCode::CssSyntaxError,
                Span::from_usize(brace, brace + 1),
                "this `{` has no matching `}`, so the block runs to the end of the `<style>`",
            )
            .with_label(
                Span::from_usize(start, prelude.len().max(start)),
                "the unclosed block",
            )
            .with_help("Add the missing `}`"),
        );
    }
    diagnostics
}

fn unknown_property(name: &str, lower: &str, span: Span) -> CssDiagnostic {
    let diagnostic = CssDiagnostic::new(
        CssCode::UnknownProperty,
        span,
        format!("`{name}` is not a CSS property, so browsers ignore the declaration"),
    );
    match suggestion(lower) {
        Some(known) => diagnostic
            .with_help(format!("Did you mean `{known}`?"))
            .with_fix(Fix {
                message: format!("Replace with `{known}`"),
                edits: vec![TextEdit {
                    span,
                    text: known.to_owned(),
                }],
            }),
        None => diagnostic.with_help(
            "Check the spelling. Custom properties start with `--`, and vendor-prefixed ones \
             with `-webkit-`, `-moz-`…",
        ),
    }
}

fn is_known(name: &str) -> bool {
    KNOWN_PROPERTIES.binary_search(&name).is_ok()
        || !matches!(PropertyId::from(name), PropertyId::Custom(_))
}

/// A known property one or two edits away (one for short names), the closest first.
fn suggestion(name: &str) -> Option<&'static str> {
    let limit = if name.len() <= 4 { 1 } else { 2 };
    KNOWN_PROPERTIES
        .iter()
        .map(|known| (distance(name, known), *known))
        .filter(|&(d, _)| d <= limit)
        .min_by_key(|&(d, _)| d)
        .map(|(_, known)| known)
}

/// The optimal string alignment distance: insertions, deletions, substitutions and adjacent
/// transpositions.
fn distance(a: &str, b: &str) -> usize {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len().abs_diff(b.len()) > 2 {
        return usize::MAX;
    }
    let width = b.len() + 1;
    let mut rows = vec![0; (a.len() + 1) * width];
    for (j, cell) in rows.iter_mut().take(width).enumerate() {
        *cell = j;
    }
    for i in 1..=a.len() {
        rows[i * width] = i;
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            let mut best = (rows[(i - 1) * width + j] + 1)
                .min(rows[i * width + j - 1] + 1)
                .min(rows[(i - 1) * width + j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                best = best.min(rows[(i - 2) * width + j - 2] + 1);
            }
            rows[i * width + j] = best;
        }
    }
    rows[a.len() * width + b.len()]
}

fn is_identifier(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_alphabetic())
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// A value that is only whitespace, comments and `!important`.
fn is_empty(value: &str) -> bool {
    let mut rest = value.trim();
    while let Some(after) = rest.strip_prefix("/*") {
        rest = after
            .split_once("*/")
            .map_or("", |(_, after)| after)
            .trim_start();
    }
    let rest = rest.trim_end_matches(|c: char| c.is_ascii_whitespace());
    rest.is_empty()
        || rest
            .strip_prefix('!')
            .is_some_and(|flag| flag.trim().eq_ignore_ascii_case("important"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The diagnostics of one block as `code `snippet``.
    fn report(css: &str) -> Vec<String> {
        let scan = crate::prepass::scan(css);
        check(css, &scan.declarations, &scan.unclosed)
            .iter()
            .map(|d| {
                format!(
                    "{} `{}`",
                    d.code,
                    &css[d.span.start as usize..d.span.end as usize]
                )
            })
            .collect()
    }

    #[test]
    fn the_list_is_sorted() {
        assert!(KNOWN_PROPERTIES.windows(2).all(|w| w[0] < w[1]));
    }

    #[test]
    fn unknown_properties() {
        assert_eq!(report(".a { colr: red; Color: red }"), ["LUM3020 `colr`"]);
        assert_eq!(
            report(".a { & .b { backgrund-color: red } @media print { fooo: 1 } }"),
            ["LUM3020 `backgrund-color`", "LUM3020 `fooo`"]
        );
        // Modern, SVG, vendor-prefixed, custom, descriptors, hacks.
        let fine = ".a { anchor-name: --a; field-sizing: content; fill: red; r: 2px; \
                    -webkit-line-clamp: 2; -foo-bar: 1; --my-x: 1; *zoom: 1; $x: 1 } \
                    @font-face { font-display: swap; unicode-range: U+0-7F } \
                    @page { size: A4; marks: crop } @keyframes k { to { colour: red } }";
        assert_eq!(report(fine), ["LUM3020 `colour`"]);
    }

    #[test]
    fn suggestions() {
        assert_eq!(suggestion("colr"), Some("color"));
        assert_eq!(suggestion("backgorund"), Some("background"));
        assert_eq!(suggestion("marign-top"), Some("margin-top"));
        assert_eq!(suggestion("fooo"), None);
        let scan = crate::prepass::scan(".a { colr: red }");
        let diagnostic = &check(".a { colr: red }", &scan.declarations, &[])[0];
        assert_eq!(diagnostic.fix.as_ref().unwrap().edits[0].text, "color");
    }

    #[test]
    fn empty_values() {
        assert_eq!(
            report(".a { color: ; width:; top: /* x */ !important; --x: ; height: 0 }"),
            ["LUM3017 `color`", "LUM3017 `width`", "LUM3017 `top`"]
        );
        assert_eq!(report(".a { color: red; }"), Vec::<String>::new());
    }

    #[test]
    fn unclosed_blocks() {
        assert_eq!(report(".a { color: red"), ["LUM3014 `{`"]);
        assert_eq!(report(".a { color: red; .b { top: 0 }"), ["LUM3014 `{`"]);
        assert_eq!(report("@media print { .a { top: 0 }"), ["LUM3014 `{`"]);
        assert_eq!(
            report(".a { content: \"{\" } /* { */"),
            Vec::<String>::new()
        );
        let css = "x {} .a .b {\n top: 0";
        let scan = crate::prepass::scan(css);
        let label = &check(css, &scan.declarations, &scan.unclosed)[0].labels[0];
        assert_eq!(
            &css[label.span.start as usize..label.span.end as usize],
            ".a .b"
        );
    }
}
