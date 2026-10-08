//! `$name` references in block CSS (spec §4.6.4).
//!
//! References count in declaration values and in `@media`, `@container` and `@supports`
//! preludes. They are ignored in selectors (where `[attr$=…]` keeps its CSS meaning),
//! property names, strings, comments and `url()`. A reference is `$` followed by an
//! identifier and optional `.member` segments; `$brand-primary` yields `$brand` and is
//! reported later by the CSS pipeline (`LUM3009`).

use super::StyleRef;
use super::chars::{char_at, is_line_terminator};
use crate::span::Span;

#[derive(Default)]
struct Item {
    /// The item started with `@media`, `@container` or `@supports` (`Some(true)`) or with
    /// another at-rule (`Some(false)`).
    at_rule: Option<bool>,
    started: bool,
    /// A `:` was seen at parenthesis depth 0 (a declaration's value follows).
    colon: bool,
    parens: usize,
    /// Candidate references and whether each came after the colon.
    candidates: Vec<(StyleRef, bool)>,
}

enum Terminator {
    /// `{`: the item was a rule or at-rule prelude.
    Block,
    /// `;`, `}` or the end of the CSS: the item was a declaration or statement.
    Statement,
}

impl Item {
    fn flush(&mut self, terminator: Terminator, refs: &mut Vec<StyleRef>) {
        let candidates = std::mem::take(&mut self.candidates);
        match (terminator, self.at_rule) {
            (Terminator::Block, Some(true)) => refs.extend(candidates.into_iter().map(|(r, _)| r)),
            (Terminator::Statement, None) => {
                refs.extend(
                    candidates
                        .into_iter()
                        .filter(|(_, value)| *value)
                        .map(|(r, _)| r),
                );
            }
            _ => {}
        }
        *self = Self::default();
    }
}

pub(super) fn find(src: &str, content: Span) -> Vec<StyleRef> {
    let bytes = src.as_bytes();
    let end = content.end as usize;
    let mut pos = content.start as usize;
    let mut refs = Vec::new();
    let mut item = Item::default();
    // The masked close character of the previous reference cannot start another one.
    let mut blocked = usize::MAX;
    while pos < end {
        let byte = bytes[pos];
        match byte {
            b'/' if bytes.get(pos + 1) == Some(&b'*') => {
                pos = src[pos + 2..end]
                    .find("*/")
                    .map_or(end, |offset| pos + 2 + offset + 2);
            }
            b'"' | b'\'' => {
                item.started = true;
                pos = skip_string(bytes, pos, end);
            }
            b'\\' => {
                item.started = true;
                pos += 2;
            }
            b'{' => {
                item.flush(Terminator::Block, &mut refs);
                pos += 1;
            }
            b';' | b'}' => {
                item.flush(Terminator::Statement, &mut refs);
                pos += 1;
            }
            b'(' => {
                item.parens += 1;
                item.started = true;
                pos += 1;
            }
            b')' => {
                item.parens = item.parens.saturating_sub(1);
                pos += 1;
            }
            b':' => {
                item.colon |= item.parens == 0;
                item.started = true;
                pos += 1;
            }
            b'@' if !item.started => {
                let name_start = pos + 1;
                pos = ident_end(src, name_start, end).unwrap_or(name_start);
                let name = src[name_start..pos].to_ascii_lowercase();
                item.at_rule = Some(matches!(name.as_str(), "media" | "container" | "supports"));
                item.started = true;
            }
            b'$' if pos != blocked => {
                item.started = true;
                match parse_ref(src, pos, end) {
                    Some(reference) => {
                        pos = reference.span.end as usize;
                        blocked = src[pos..]
                            .char_indices()
                            .find(|&(_, ch)| !is_line_terminator(ch))
                            .map_or(usize::MAX, |(offset, _)| pos + offset);
                        item.candidates.push((reference, item.colon));
                    }
                    None => pos += 1,
                }
            }
            b'u' | b'U' if is_url_open(bytes, pos, content.start as usize) => {
                item.started = true;
                pos = skip_url(bytes, pos + 4, end);
            }
            _ if byte.is_ascii_whitespace() => pos += 1,
            _ => {
                item.started = true;
                pos += 1;
            }
        }
    }
    item.flush(Terminator::Statement, &mut refs);
    refs
}

fn parse_ref(src: &str, dollar: usize, end: usize) -> Option<StyleRef> {
    let bytes = src.as_bytes();
    let first_end = ident_end(src, dollar + 1, end)?;
    let mut path = vec![src[dollar + 1..first_end].to_owned()];
    let mut pos = first_end;
    while pos < end && bytes[pos] == b'.' {
        let Some(segment_end) = ident_end(src, pos + 1, end) else {
            break;
        };
        path.push(src[pos + 1..segment_end].to_owned());
        pos = segment_end;
    }
    Some(StyleRef {
        span: Span::from_usize(dollar, pos),
        path,
        close: None,
    })
}

/// The end of a JS identifier (without `$`, which ends a reference) starting at `start`.
fn ident_end(src: &str, start: usize, end: usize) -> Option<usize> {
    let mut pos = start;
    while pos < end {
        let ch = char_at(src, pos)?;
        let valid = if pos == start {
            ch == '_' || ch.is_alphabetic()
        } else {
            ch == '_' || ch.is_alphanumeric()
        };
        if !valid {
            break;
        }
        pos += ch.len_utf8();
    }
    (pos > start).then_some(pos)
}

fn skip_string(bytes: &[u8], start: usize, end: usize) -> usize {
    let quote = bytes[start];
    let mut pos = start + 1;
    while pos < end {
        match bytes[pos] {
            b'\\' => pos += 2,
            byte if byte == quote => return pos + 1,
            b'\n' | b'\r' => return pos,
            _ => pos += 1,
        }
    }
    end
}

fn is_url_open(bytes: &[u8], pos: usize, content_start: usize) -> bool {
    let preceded_by_ident = pos > content_start
        && (bytes[pos - 1].is_ascii_alphanumeric() || matches!(bytes[pos - 1], b'-' | b'_'));
    !preceded_by_ident
        && bytes
            .get(pos..pos + 4)
            .is_some_and(|s| s.eq_ignore_ascii_case(b"url("))
}

/// Skips an unquoted `url(…)` body; a quoted one is left to the string scanner.
fn skip_url(bytes: &[u8], mut pos: usize, end: usize) -> usize {
    while pos < end && bytes[pos].is_ascii_whitespace() {
        pos += 1;
    }
    if pos < end && matches!(bytes[pos], b'"' | b'\'') {
        return pos;
    }
    while pos < end {
        match bytes[pos] {
            b'\\' => pos += 2,
            b')' => return pos + 1,
            _ => pos += 1,
        }
    }
    end
}

#[cfg(test)]
mod tests {
    use super::*;

    fn refs(css: &str) -> Vec<String> {
        find(css, Span::from_usize(0, css.len()))
            .iter()
            .map(StyleRef::dotted)
            .collect()
    }

    #[test]
    fn finds_references_in_values_and_conditional_preludes() {
        assert_eq!(refs(".a { border-radius: $radius.lg; }"), ["radius.lg"]);
        assert_eq!(refs(".a { padding: calc($gap * 1px) $x }"), ["gap", "x"]);
        assert_eq!(
            refs("@media (width < $BREAKPOINT) { .a { color: red } }"),
            ["BREAKPOINT"]
        );
        assert_eq!(refs("@container (min-width: $w) {}"), ["w"]);
        assert_eq!(refs("@supports (display: $d) {}"), ["d"]);
        assert_eq!(refs(".a { --brand: $brand.primary; }"), ["brand.primary"]);
        assert_eq!(refs(".a { color: $c }"), ["c"]);
        assert_eq!(refs(".a { .b { margin: $m } }"), ["m"]);
    }

    #[test]
    fn ignores_selectors_strings_comments_and_urls() {
        assert!(refs("[href$=\".pdf\"] { color: red }").is_empty());
        assert!(refs(".a$b { color: red }").is_empty());
        assert!(refs("a:hover $x { color: red }").is_empty());
        assert!(refs(".a { content: \"$x\" }").is_empty());
        assert!(refs(".a { /* $x */ color: red }").is_empty());
        assert!(refs(".a { background: url($x) }").is_empty());
        assert!(refs(".a { background: url(\"$x\") }").is_empty());
        assert!(refs("@import \"$x\";").is_empty());
        assert!(refs(".a { $x: red }").is_empty());
        assert!(refs(".a { width: $1 }").is_empty());
    }

    #[test]
    fn reference_shape() {
        assert_eq!(refs(".a { color: $brand-primary }"), ["brand"]);
        assert_eq!(refs(".a { width: $sizes.0 }"), ["sizes"]);
        assert_eq!(refs(".a { width: $a.b.c; }"), ["a.b.c"]);
        assert_eq!(refs(".a { width: $a$b; }"), ["a"]);
        assert_eq!(refs(".a { margin: $a\n$b; }"), ["a"]);
        assert_eq!(refs(".a { margin: $a\n $b; }"), ["a", "b"]);
        assert_eq!(refs(".a { width: $café }"), ["café"]);
    }
}
