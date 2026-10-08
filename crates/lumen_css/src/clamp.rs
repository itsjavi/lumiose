//! Keeps math in properties with a non-negative range from folding into an invalid literal.
//!
//! Lightning CSS reduces `padding-left: calc(2px - 7px)` to `-5px`. A browser clamps a math
//! function that falls outside a property's range to that range (`0px` here), but drops a
//! negative literal as invalid; once Lightning CSS merges the longhand into a `padding`
//! shorthand, the whole shorthand is dropped. So before Lightning CSS parses a block, each
//! top-level math function of such a property that reduces to a negative value is wrapped in
//! `max(0px, …)`, which Lightning CSS reduces to `0px`: the value the browser would compute.
//!
//! This is a stopgap for parcel-bundler/lightningcss#1000, fixed upstream by #1329 ("Add
//! NonNegative wrapper for numeric values": negative literals are rejected and `calc()` that
//! resolves negative is clamped to zero), which is not in a release yet (the pinned crate is
//! 1.0.0-alpha.72). Remove this module once Lightning CSS is upgraded to a release with #1329;
//! `tests/fixtures/negative_math.stsx` must still pass without it.
//!
//! Only properties whose every numeric component is non-negative are listed. Math nested in
//! other functions is left alone, except where the arguments share the property's range: in
//! `minmax()`, `fit-content()` and the track list of `repeat()` (its count must be positive,
//! so it is skipped). Plain numbers are clamped only in properties that accept them:
//! `width: calc(2 - 7)` is invalid, and `max(0, …)` would turn it into a valid `width: 0`.

use std::ops::Range;

use crate::edits::Edit;
use crate::fold;
use crate::prepass::{Declaration, skip_escape, skip_string};

/// Edits that wrap the negative math of non-negative properties in `max(0<unit>, …)`.
/// `refs` are the `$ref` substitutions of the block, which the math is evaluated with.
pub(crate) fn guard(content: &str, declarations: &[Declaration], refs: &[Edit]) -> Vec<Edit> {
    let mut edits = Vec::new();
    for declaration in declarations {
        let Some(accepts_numbers) = non_negative(&content[declaration.name.clone()]) else {
            continue;
        };
        for function in math_functions(content, declaration.value.clone()) {
            let text = substituted(content, function.clone(), refs);
            let Some(value) = fold::evaluate(&text) else {
                continue;
            };
            if value.number() < 0.0 && (accepts_numbers || !value.is_number()) {
                edits.push(Edit::insert(
                    function.start,
                    format!("max({}, ", value.zero()),
                ));
                edits.push(Edit::insert(function.end, ")"));
            }
        }
    }
    edits
}

/// `Some(accepts plain numbers)` for a property whose numeric components are all
/// non-negative, `None` for any other.
fn non_negative(property: &str) -> Option<bool> {
    let property = property.to_ascii_lowercase();
    let name = ["-webkit-", "-moz-", "-ms-", "-o-"]
        .iter()
        .find_map(|prefix| property.strip_prefix(prefix))
        .unwrap_or(&property);
    match name {
        "line-height"
        | "flex"
        | "flex-grow"
        | "flex-shrink"
        | "tab-size"
        | "animation-iteration-count"
        | "font-size-adjust"
        | "zoom"
        | "aspect-ratio"
        | "border-image-width"
        | "border-image-outset"
        | "stroke-width" => Some(true),
        "width"
        | "height"
        | "min-width"
        | "min-height"
        | "max-width"
        | "max-height"
        | "inline-size"
        | "block-size"
        | "min-inline-size"
        | "min-block-size"
        | "max-inline-size"
        | "max-block-size"
        | "font-size"
        | "gap"
        | "row-gap"
        | "column-gap"
        | "grid-gap"
        | "grid-row-gap"
        | "grid-column-gap"
        | "flex-basis"
        | "column-width"
        | "perspective"
        | "shape-margin"
        | "r"
        | "rx"
        | "ry"
        | "transition-duration"
        | "animation-duration"
        | "background-size"
        | "mask-size"
        | "border-spacing"
        | "outline-width"
        | "column-rule-width"
        | "grid-template-rows"
        | "grid-template-columns"
        | "grid-auto-rows"
        | "grid-auto-columns" => Some(false),
        // Shorthands whose only numeric component is a width.
        "border"
        | "border-top"
        | "border-right"
        | "border-bottom"
        | "border-left"
        | "border-block"
        | "border-block-start"
        | "border-block-end"
        | "border-inline"
        | "border-inline-start"
        | "border-inline-end"
        | "outline"
        | "column-rule" => Some(false),
        _ if name.starts_with("padding") || name.starts_with("scroll-padding") => Some(false),
        _ if name.starts_with("border-")
            && (name.ends_with("-width") || name.ends_with("-radius")) =>
        {
            Some(false)
        }
        _ => None,
    }
}

/// Functions whose arguments share the property's non-negative range.
const TRANSPARENT: [&str; 2] = ["minmax", "fit-content"];

/// An open parenthesis.
struct Level {
    /// Math inside it shares the property's range.
    in_range: bool,
    /// A `repeat(` whose count is being read: its track list, after the comma, is in range.
    repeat: bool,
}

/// The ranges of the math functions of `value` that share the property's range: at its top
/// level, or inside [`TRANSPARENT`] functions and `repeat()` track lists.
fn math_functions(css: &str, value: Range<usize>) -> Vec<Range<usize>> {
    let bytes = css.as_bytes();
    let mut functions = Vec::new();
    let mut levels: Vec<Level> = Vec::new();
    // A math function being read: its start and parenthesis depth.
    let mut open: Option<(usize, usize)> = None;
    let mut pos = value.start;
    while pos < value.end {
        match bytes[pos] {
            b'/' if bytes.get(pos + 1) == Some(&b'*') => {
                pos = css[pos + 2..value.end]
                    .find("*/")
                    .map_or(value.end, |offset| pos + 2 + offset + 2);
            }
            b'"' | b'\'' => pos = skip_string(css, pos).min(value.end),
            b'\\' => pos = skip_escape(css, pos).min(value.end),
            b'(' => {
                let start = name_start(bytes, value.start, pos);
                let name = &css[start..pos];
                let reachable = open.is_none() && levels.iter().all(|level| level.in_range);
                if reachable && fold::is_math(name) {
                    open = Some((start, levels.len()));
                }
                levels.push(Level {
                    in_range: reachable
                        && TRANSPARENT
                            .iter()
                            .any(|transparent| name.eq_ignore_ascii_case(transparent)),
                    repeat: reachable && name.eq_ignore_ascii_case("repeat"),
                });
                pos += 1;
            }
            b',' => {
                if let Some(level) = levels.last_mut()
                    && level.repeat
                {
                    *level = Level {
                        in_range: true,
                        repeat: false,
                    };
                }
                pos += 1;
            }
            b')' => {
                levels.pop();
                pos += 1;
                if let Some((start, depth)) = open
                    && levels.len() == depth
                {
                    functions.push(start..pos);
                    open = None;
                }
            }
            _ => pos += 1,
        }
    }
    functions
}

/// The start of the function name that ends at `paren`.
fn name_start(bytes: &[u8], floor: usize, paren: usize) -> usize {
    let mut start = paren;
    while start > floor {
        let byte = bytes[start - 1];
        if !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_') || !byte.is_ascii()) {
            break;
        }
        start -= 1;
    }
    start
}

/// The text of `range` with the `$ref` substitutions inside it applied.
fn substituted(css: &str, range: Range<usize>, refs: &[Edit]) -> String {
    let mut text = String::new();
    let mut last = range.start;
    for edit in refs
        .iter()
        .filter(|edit| range.start <= edit.range.start && edit.range.end <= range.end)
    {
        text.push_str(&css[last..edit.range.start]);
        text.push_str(&edit.text);
        last = edit.range.end;
    }
    text.push_str(&css[last..range.end]);
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    fn functions(value: &str) -> Vec<&str> {
        math_functions(value, 0..value.len())
            .into_iter()
            .map(|range| &value[range])
            .collect()
    }

    #[test]
    fn finds_top_level_math_functions() {
        assert_eq!(
            functions(" calc(1px - 2px) MIN(1px, calc(2px)) 3px"),
            ["calc(1px - 2px)", "MIN(1px, calc(2px))"]
        );
        assert_eq!(
            functions(" minmax(calc(1px - 2px), 1fr) fit-content(min(1px, 2px))"),
            ["calc(1px - 2px)", "min(1px, 2px)"]
        );
        assert_eq!(
            functions(" repeat(calc(1 - 2), max(1px, 2px) minmax(calc(1px), 1fr))"),
            ["max(1px, 2px)", "calc(1px)"]
        );
        assert!(functions(" foo(minmax(calc(1px), 1fr)) repeat(2, foo(calc(1px)))").is_empty());
        assert!(functions(" \"calc(1px)\" /* calc(1px) */ url(calc(1px))").is_empty());
        assert!(functions(" -webkit-calc(1px) (calc(1px))").is_empty());
    }

    #[test]
    fn lists_non_negative_properties() {
        assert_eq!(non_negative("padding-left"), Some(false));
        assert_eq!(non_negative("Border-Top-Left-Radius"), Some(false));
        assert_eq!(non_negative("-webkit-border-radius"), Some(false));
        assert_eq!(non_negative("border-image-width"), Some(true));
        assert_eq!(non_negative("line-height"), Some(true));
        assert_eq!(non_negative("margin-left"), None);
        assert_eq!(non_negative("border-image"), None);
        assert_eq!(non_negative("--gap"), None);
    }

    /// `css` with the guard's edits applied (no `$ref`s).
    fn guarded(css: &str) -> String {
        let scan = crate::prepass::scan(css);
        crate::edits::Rewritten::apply(css, guard(css, &scan.declarations, &[])).text
    }

    #[test]
    fn leaves_numbers_counts_and_literals_alone() {
        // A number is invalid for a length either way; `max(0, …)` would make it a valid `0`.
        assert_eq!(
            guarded(".a { width: calc(2 - 7) }"),
            ".a { width: calc(2 - 7) }"
        );
        assert_eq!(
            guarded(".a { line-height: calc(1 - 2) }"),
            ".a { line-height: max(0, calc(1 - 2)) }"
        );
        let untouched = ".a { grid-template-columns: repeat(calc(1 - 2), 1fr); height: -5px }";
        assert_eq!(guarded(untouched), untouched);
        assert_eq!(
            guarded("@keyframes k { to { font-size: calc(1rem - 2rem) } }"),
            "@keyframes k { to { font-size: max(0rem, calc(1rem - 2rem)) } }"
        );
        assert_eq!(
            guarded(".a { @media print { width: calc(1px - 2px) } }"),
            ".a { @media print { width: max(0px, calc(1px - 2px)) } }"
        );
    }

    #[test]
    fn substitutes_refs_inside_the_range() {
        let css = "x: calc($a - $b) $c";
        let refs = [
            Edit::replace(8..10, "2px"),
            Edit::replace(13..15, "7px"),
            Edit::replace(17..19, "1px"),
        ];
        assert_eq!(substituted(css, 3..16, &refs), "calc(2px - 7px)");
    }
}
