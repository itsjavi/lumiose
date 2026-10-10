//! A light CSS lexer over one block that finds `$name` reference sites and selector preludes
//! before Lightning CSS sees the text.
//!
//! References count in declaration values and in `@media`, `@container` and `@supports`
//! preludes (spec §4.6.4). They are ignored in selectors, property names, other at-rule
//! preludes, strings, comments and `url()`. A reference is `$` followed by a JS identifier
//! and optional `.member` segments. The character right after a reference cannot start
//! another one (it is masked as `;`/`}` in the shadow TSX). These rules match the
//! compiler's scanner (`lumiose_compiler::scanner::css_refs`).
//!
//! Selector preludes are the preludes of style rules, including nested ones; keyframe
//! selectors and the bodies of other at-rules (`@font-face`, `@page`, …) are skipped.
//!
//! Declarations are those of style rules (including group rules nested in them), keyframes
//! and other at-rule blocks; the last are marked as descriptors.

use std::ops::Range;

/// A `$name` reference in CSS text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RefSite {
    /// `$` through the last path segment, relative to the scanned text.
    pub range: Range<usize>,
    /// The dotted path: `["radius", "lg"]` for `$radius.lg`.
    pub path: Vec<String>,
    /// For `$brand-primary`: `$` through the end of the hyphenated name. Such a reference is
    /// invalid (`LUM3009`) and never substituted.
    pub hyphenated: Option<Range<usize>>,
}

/// The `$name` reference sites of a block's CSS text, in order.
pub fn find_refs(css: &str) -> Vec<RefSite> {
    scan(css).refs
}

/// A style rule prelude (a selector list).
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Prelude {
    /// Trimmed of trailing whitespace; never empty.
    pub range: Range<usize>,
    /// Inside a style rule: relative selectors are resolved against an (already scoped) parent.
    pub nested: bool,
}

/// A `name: value` declaration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Declaration {
    /// The property name, trimmed.
    pub name: Range<usize>,
    /// Everything after the colon, up to the `;`, `}` or end of the text.
    pub value: Range<usize>,
    /// In the body of an at-rule such as `@font-face`, `@page` or `@property`, whose
    /// descriptors have their own grammar (`font-weight: 100 900`).
    pub descriptor: bool,
}

#[derive(Debug, Default)]
pub(crate) struct Scan {
    pub refs: Vec<RefSite>,
    pub preludes: Vec<Prelude>,
    pub declarations: Vec<Declaration>,
    /// The offsets of the `{` that have no matching `}`.
    pub unclosed: Vec<usize>,
    /// The first `{` nested deeper than [`MAX_BLOCKS`] or `(` deeper than [`MAX_PARENS`].
    pub too_deep: Option<usize>,
}

/// Blocks (`{`) nested deeper than this make a `<style>` block an error: Lightning CSS and the
/// selector pass recurse per level.
pub(crate) const MAX_BLOCKS: usize = 64;

/// Parentheses (functions, `:is(…)`, media conditions) nested deeper than this make a `<style>`
/// block an error: besides recursing, Lightning CSS parses nested math functions in time
/// exponential in their depth (16 levels of `calc(` take about 10 ms, 24 seconds).
pub(crate) const MAX_PARENS: usize = 16;

/// What the current `{…}` block contains.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Context {
    /// Rules: the stylesheet or a group at-rule (`@media`, `@layer`, …). `nested` when inside
    /// a style rule.
    Rules { nested: bool },
    /// A style rule body: declarations and nested rules.
    Style,
    /// A `@keyframes` body: keyframe selectors.
    Keyframes,
    /// A keyframe block: declarations only.
    Declarations,
    /// Any other at-rule block (`@font-face`, `@page`, `@property`, …) and blocks inside it:
    /// descriptors.
    Descriptors,
}

impl Context {
    fn in_style_rule(self) -> bool {
        matches!(self, Self::Style | Self::Rules { nested: true })
    }
}

#[derive(Default)]
struct Item {
    /// Where the item's first significant character is.
    start: Option<usize>,
    /// The lowercase at-rule name when the item starts with `@`.
    at_rule: Option<String>,
    /// A `:` was seen at parenthesis depth 0 (a declaration's value follows).
    colon: bool,
    /// Where the first such `:` is.
    colon_at: Option<usize>,
    parens: usize,
    /// Candidate references and whether each came after the colon.
    candidates: Vec<(RefSite, bool)>,
}

impl Item {
    fn begin(&mut self, pos: usize) {
        self.start.get_or_insert(pos);
    }
}

pub(crate) fn scan(css: &str) -> Scan {
    let bytes = css.as_bytes();
    let end = bytes.len();
    let mut out = Scan::default();
    let mut stack = vec![Context::Rules { nested: false }];
    // The `{` of each open block (`stack` minus the root).
    let mut braces = Vec::new();
    let mut item = Item::default();
    let mut pos = 0;
    // The character right after a reference cannot start another one.
    let mut blocked = usize::MAX;
    while pos < end {
        let byte = bytes[pos];
        match byte {
            b'/' if bytes.get(pos + 1) == Some(&b'*') => {
                pos = css[pos + 2..]
                    .find("*/")
                    .map_or(end, |offset| pos + 2 + offset + 2);
            }
            b'"' | b'\'' => {
                item.begin(pos);
                pos = skip_string(css, pos);
            }
            b'\\' => {
                item.begin(pos);
                pos = skip_escape(css, pos);
            }
            b'{' => {
                let context = *stack.last().expect("the root context is never popped");
                let item = std::mem::take(&mut item);
                stack.push(open_block(css, item, pos, context, &mut out));
                braces.push(pos);
                if braces.len() > MAX_BLOCKS && out.too_deep.is_none() {
                    out.too_deep = Some(pos);
                }
                pos += 1;
            }
            b';' | b'}' => {
                let context = *stack.last().expect("the root context is never popped");
                flush_statement(css, std::mem::take(&mut item), pos, context, &mut out);
                if byte == b'}' && stack.len() > 1 {
                    stack.pop();
                    braces.pop();
                }
                pos += 1;
            }
            b'(' => {
                item.begin(pos);
                item.parens += 1;
                if item.parens > MAX_PARENS && out.too_deep.is_none() {
                    out.too_deep = Some(pos);
                }
                pos += 1;
            }
            b')' => {
                item.begin(pos);
                item.parens = item.parens.saturating_sub(1);
                pos += 1;
            }
            b':' => {
                item.begin(pos);
                if item.parens == 0 && !item.colon {
                    item.colon = true;
                    item.colon_at = Some(pos);
                }
                pos += 1;
            }
            b'@' if item.start.is_none() => {
                item.begin(pos);
                let name_end = name_end(css, pos + 1);
                item.at_rule = Some(css[pos + 1..name_end].to_ascii_lowercase());
                pos = name_end.max(pos + 1);
            }
            b'$' if pos != blocked => {
                item.begin(pos);
                match parse_ref(css, pos) {
                    Some(site) => {
                        pos = site.hyphenated.as_ref().unwrap_or(&site.range).end;
                        blocked = css[site.range.end..]
                            .char_indices()
                            .find(|&(_, ch)| !matches!(ch, '\n' | '\r' | '\u{2028}' | '\u{2029}'))
                            .map_or(usize::MAX, |(offset, _)| site.range.end + offset);
                        item.candidates.push((site, item.colon));
                    }
                    None => pos += 1,
                }
            }
            b'u' | b'U' if is_url_open(bytes, pos) => {
                item.begin(pos);
                pos = skip_url(css, pos + 4);
            }
            _ if byte.is_ascii_whitespace() => pos += 1,
            _ => {
                item.begin(pos);
                pos += utf8_len(byte);
            }
        }
    }
    let context = *stack.last().expect("the root context is never popped");
    flush_statement(css, item, end, context, &mut out);
    out.unclosed = braces;
    out
}

/// An item ended at `end` (`;`, `}` or the end of the text): a declaration or statement.
fn flush_statement(css: &str, item: Item, end: usize, context: Context, out: &mut Scan) {
    if item.at_rule.is_some() {
        return;
    }
    let declarations = matches!(
        context,
        Context::Style
            | Context::Declarations
            | Context::Descriptors
            | Context::Rules { nested: true }
    );
    if let (Some(start), Some(colon), true) = (item.start, item.colon_at, declarations) {
        out.declarations.push(Declaration {
            name: start..start + css[start..colon].trim_end().len(),
            value: colon + 1..end,
            descriptor: context == Context::Descriptors,
        });
    }
    out.refs.extend(
        item.candidates
            .into_iter()
            .filter(|(_, value)| *value)
            .map(|(site, _)| site),
    );
}

/// An item ended with `{`: a rule or at-rule prelude. Returns the context of the new block.
fn open_block(css: &str, item: Item, brace: usize, parent: Context, out: &mut Scan) -> Context {
    match item.at_rule.as_deref() {
        Some(name) => {
            if matches!(name, "media" | "container" | "supports") {
                out.refs
                    .extend(item.candidates.into_iter().map(|(site, _)| site));
            }
            match name {
                "media" | "supports" | "container" | "layer" | "scope" | "starting-style"
                | "document" | "-moz-document" => Context::Rules {
                    nested: parent.in_style_rule(),
                },
                _ if name.ends_with("keyframes") => Context::Keyframes,
                _ => Context::Descriptors,
            }
        }
        None => match parent {
            Context::Rules { .. } | Context::Style => {
                if let Some(start) = item.start {
                    let end = start + css[start..brace].trim_end().len();
                    out.preludes.push(Prelude {
                        range: start..end,
                        nested: parent.in_style_rule(),
                    });
                }
                Context::Style
            }
            Context::Keyframes | Context::Declarations => Context::Declarations,
            Context::Descriptors => Context::Descriptors,
        },
    }
}

fn parse_ref(css: &str, dollar: usize) -> Option<RefSite> {
    let bytes = css.as_bytes();
    let first_end = ident_end(css, dollar + 1)?;
    let mut path = vec![css[dollar + 1..first_end].to_owned()];
    let mut pos = first_end;
    while bytes.get(pos) == Some(&b'.') {
        let Some(segment_end) = ident_end(css, pos + 1) else {
            break;
        };
        path.push(css[pos + 1..segment_end].to_owned());
        pos = segment_end;
    }
    let range = dollar..pos;
    let hyphenated = hyphen_end(css, pos).map(|end| dollar..end);
    Some(RefSite {
        range,
        path,
        hyphenated,
    })
}

/// `$brand-primary`: a `-` right after the reference, followed by an identifier character.
/// Returns the end of the whole hyphenated name.
fn hyphen_end(css: &str, mut pos: usize) -> Option<usize> {
    let starts_part = |at: usize| {
        css[at..]
            .chars()
            .next()
            .is_some_and(|ch| ch == '_' || ch.is_alphanumeric())
    };
    if !(css[pos..].starts_with('-') && starts_part(pos + 1)) {
        return None;
    }
    while (css[pos..].starts_with('-') || css[pos..].starts_with('.')) && starts_part(pos + 1) {
        pos += 1;
        pos += css[pos..]
            .char_indices()
            .find(|&(_, ch)| !(ch == '_' || ch.is_alphanumeric()))
            .map_or(css.len() - pos, |(offset, _)| offset);
    }
    Some(pos)
}

/// The end of a JS identifier (without `$`, which ends a reference) starting at `start`.
fn ident_end(css: &str, start: usize) -> Option<usize> {
    let mut end = start;
    for (offset, ch) in css[start..].char_indices() {
        let valid = if offset == 0 {
            ch == '_' || ch.is_alphabetic()
        } else {
            ch == '_' || ch.is_alphanumeric()
        };
        if !valid {
            break;
        }
        end = start + offset + ch.len_utf8();
    }
    (end > start).then_some(end)
}

/// The end of an at-rule name (CSS identifier characters).
fn name_end(css: &str, start: usize) -> usize {
    css[start..]
        .char_indices()
        .find(|&(_, ch)| !(ch == '-' || ch == '_' || ch.is_alphanumeric() || !ch.is_ascii()))
        .map_or(css.len(), |(offset, _)| start + offset)
}

fn utf8_len(first_byte: u8) -> usize {
    match first_byte {
        0xf0.. => 4,
        0xe0.. => 3,
        0xc0.. => 2,
        _ => 1,
    }
}

/// Skips `\` and the escaped character.
pub(crate) fn skip_escape(css: &str, pos: usize) -> usize {
    css[pos + 1..]
        .chars()
        .next()
        .map_or(css.len(), |ch| pos + 1 + ch.len_utf8())
}

/// Skips a quoted string; an unescaped newline ends it (a bad string in CSS).
pub(crate) fn skip_string(css: &str, start: usize) -> usize {
    let bytes = css.as_bytes();
    let quote = bytes[start];
    let mut pos = start + 1;
    while pos < bytes.len() {
        match bytes[pos] {
            b'\\' => pos = skip_escape(css, pos),
            byte if byte == quote => return pos + 1,
            b'\n' | b'\r' => return pos,
            _ => pos += 1,
        }
    }
    bytes.len()
}

fn is_url_open(bytes: &[u8], pos: usize) -> bool {
    let preceded_by_ident = pos > 0
        && (bytes[pos - 1].is_ascii_alphanumeric() || matches!(bytes[pos - 1], b'-' | b'_'));
    !preceded_by_ident
        && bytes
            .get(pos..pos + 4)
            .is_some_and(|s| s.eq_ignore_ascii_case(b"url("))
}

/// Skips an unquoted `url(…)` body; a quoted one is left to the string scanner.
fn skip_url(css: &str, mut pos: usize) -> usize {
    let bytes = css.as_bytes();
    while pos < bytes.len() && bytes[pos].is_ascii_whitespace() {
        pos += 1;
    }
    if pos < bytes.len() && matches!(bytes[pos], b'"' | b'\'') {
        return pos;
    }
    while pos < bytes.len() {
        match bytes[pos] {
            b'\\' => pos = skip_escape(css, pos),
            b')' => return pos + 1,
            _ => pos += 1,
        }
    }
    bytes.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn refs(css: &str) -> Vec<String> {
        find_refs(css)
            .iter()
            .map(|site| site.path.join("."))
            .collect()
    }

    fn preludes(css: &str) -> Vec<(&str, bool)> {
        scan(css)
            .preludes
            .iter()
            .map(|p| (&css[p.range.clone()], p.nested))
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
        assert_eq!(refs("@container card (min-width: $w) {}"), ["w"]);
        assert_eq!(refs("@supports (display: $d) {}"), ["d"]);
        assert_eq!(refs(".a { --brand: $brand.primary; }"), ["brand.primary"]);
        assert_eq!(refs(".a { color: $c }"), ["c"]);
        assert_eq!(refs(".a { .b { margin: $m } }"), ["m"]);
        assert_eq!(refs("@font-face { font-display: $fd }"), ["fd"]);
        assert_eq!(refs("@keyframes k { from { opacity: $o } }"), ["o"]);
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
        assert!(refs("@layer $x { }").is_empty());
        assert!(refs(".a { $x: red }").is_empty());
        assert!(refs(".a { width: $1 }").is_empty());
    }

    #[test]
    fn reference_shape() {
        assert_eq!(refs(".a { width: $sizes.0 }"), ["sizes"]);
        assert_eq!(refs(".a { width: $a.b.c; }"), ["a.b.c"]);
        assert_eq!(refs(".a { width: $a$b; }"), ["a"]);
        assert_eq!(refs(".a { margin: $a\n$b; }"), ["a"]);
        assert_eq!(refs(".a { margin: $a\n $b; }"), ["a", "b"]);
        assert_eq!(refs(".a { width: $café }"), ["café"]);
    }

    #[test]
    fn hyphenated_references() {
        let css = ".a { color: $brand-primary.dark; margin: calc($gap-1px); top: $x -1px }";
        let sites = find_refs(css);
        let hyphenated: Vec<_> = sites
            .iter()
            .map(|s| s.hyphenated.clone().map(|r| &css[r]))
            .collect();
        assert_eq!(
            hyphenated,
            [Some("$brand-primary.dark"), Some("$gap-1px"), None]
        );
        assert_eq!(&css[sites[0].range.clone()], "$brand");
    }

    #[test]
    fn finds_declarations_and_descriptors() {
        let css = "\
.a { color: red; @media print { margin: 0 } .b { top: 1px } }
@media (width > 1px) { left: 0; .c { right: 0 } }
@keyframes k { from { opacity: 0 } }
@font-face { font-weight: 100 900 }
@page { @top-left { content: 'x' } }";
        let scan = scan(css);
        let declarations: Vec<(&str, bool)> = scan
            .declarations
            .iter()
            .map(|d| (&css[d.name.clone()], d.descriptor))
            .collect();
        assert_eq!(
            declarations,
            [
                ("color", false),
                ("margin", false),
                ("top", false),
                ("right", false),
                ("opacity", false),
                ("font-weight", true),
                ("content", true),
            ]
        );
    }

    #[test]
    fn finds_selector_preludes_with_nesting() {
        let css = "\
.a, .b > c { color: red; &:hover { color: blue } .d { x: y } }
@media (width > 1px) { .e { } }
@keyframes k { from { opacity: 0 } 50% { opacity: 1 } }
@font-face { font-family: x }
.f { @media print { .g { } } }
@page :first { margin: 0 }";
        assert_eq!(
            preludes(css),
            [
                (".a, .b > c", false),
                ("&:hover", true),
                (".d", true),
                (".e", false),
                (".f", false),
                (".g", true),
            ]
        );
    }
}
