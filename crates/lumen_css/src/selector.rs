//! Selector scoping on the text of a style rule prelude (spec §4.6.2).
//!
//! Rewriting text (rather than Lightning CSS's selector AST) keeps Lightning CSS's own parse
//! of the final selectors, so specificity and pseudo-element flags stay exact, and gives
//! precise spans for diagnostics. The tokenizer only needs selector structure: compounds,
//! combinators, simple selectors and functional arguments.

use std::ops::Range;

use crate::diagnostics::{CssCode, CssDiagnostic};
use crate::edits::Edit;
use crate::prepass::{Prelude, skip_escape, skip_string};
use crate::{ElementInventory, Span};

/// How to scope the selectors of one block.
pub(crate) struct ScopeContext<'a> {
    /// The attribute selector to insert, `[data-l-<token>]`; `None` in a global block.
    pub attribute: Option<&'a str>,
    /// The scope's elements, for `LUM3005`.
    pub inventory: Option<&'a ElementInventory>,
    /// How messages name the scope: "component `Card`" or "this file".
    pub scope_label: &'a str,
}

/// Edits and diagnostics, relative to the block text.
#[derive(Default)]
pub(crate) struct Rewrite {
    pub edits: Vec<Edit>,
    pub diagnostics: Vec<CssDiagnostic>,
}

pub(crate) fn rewrite_prelude(
    css: &str,
    prelude: &Prelude,
    scope: &ScopeContext,
    out: &mut Rewrite,
) {
    let list = Parser::new(css, prelude.range.clone()).list();
    for complex in list.iter().filter(|c| !c.compounds.is_empty()) {
        rewrite_complex(css, complex, prelude.nested, scope, out);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Type,
    Universal,
    Class,
    Id,
    Attribute,
    Nesting,
    PseudoClass,
    PseudoElement,
    /// Anything else that is part of a compound (`50%`, a stray digit).
    Other,
}

#[derive(Debug)]
struct Simple {
    kind: Kind,
    range: Range<usize>,
    /// The name of a type, class, id or pseudo selector (without `.`, `#` or `:`).
    name: Range<usize>,
    escaped: bool,
    /// The arguments of a functional pseudo-class or pseudo-element.
    args: Option<Range<usize>>,
}

impl Simple {
    fn pseudo_class(&self, css: &str, name: &str) -> bool {
        self.kind == Kind::PseudoClass && css[self.name.clone()].eq_ignore_ascii_case(name)
    }
}

#[derive(Debug)]
struct Compound {
    simples: Vec<Simple>,
    range: Range<usize>,
}

#[derive(Debug)]
struct Complex {
    compounds: Vec<Compound>,
    range: Range<usize>,
}

fn rewrite_complex(
    css: &str,
    complex: &Complex,
    nested: bool,
    scope: &ScopeContext,
    out: &mut Rewrite,
) {
    let mut deep: Option<(usize, usize)> = None;
    for (k, compound) in complex.compounds.iter().enumerate() {
        for (j, simple) in compound.simples.iter().enumerate() {
            if simple.kind != Kind::PseudoClass {
                continue;
            }
            let Some(args) = argument(css, simple, out) else {
                continue;
            };
            if simple.pseudo_class(css, "global") {
                unwrap(simple, &args, out);
            } else if simple.pseudo_class(css, "deep") {
                if deep.is_some() {
                    out.diagnostics.push(scope_error(
                        simple,
                        "only one `:deep()` is allowed per selector",
                    ));
                    unwrap(simple, &args, out);
                    continue;
                }
                deep = Some((k, j));
            }
            strip_nested(css, args, out);
        }
    }

    let compounds = &complex.compounds;
    // The compound that gets the token, where the attribute goes, and the simple selectors
    // that make up the subject (for `LUM3005`).
    let target: Option<(&[Simple], usize)> = match deep {
        None => compounds
            .iter()
            .rev()
            .find(|c| is_scoped(css, &c.simples))
            .map(|c| (c.simples.as_slice(), insertion_point(c))),
        Some((k, j)) => {
            let simple = &compounds[k].simples[j];
            let args = simple.args.clone().expect("checked by `argument`");
            let left = &compounds[k].simples[..j];
            let target = if !left.is_empty() {
                is_scoped(css, left).then_some((left, simple.range.start))
            } else {
                compounds[..k]
                    .iter()
                    .rev()
                    .find(|c| is_scoped(css, &c.simples))
                    .map(|c| (c.simples.as_slice(), insertion_point(c)))
            };
            // `.a:deep(.b)` → `.a[t] .b`; `.a :deep(.b)` → `.a[t] .b`; a leading `:deep(.b)`
            // → `[t] .b` (top level) or `.b` (nested: relative to the scoped parent).
            let opening = simple.range.start..args.start;
            let replacement = match (left.is_empty(), scope.attribute) {
                (false, _) => " ".to_owned(),
                (true, Some(attribute)) if k == 0 && !nested => format!("{attribute} "),
                (true, _) => String::new(),
            };
            out.edits.push(Edit::replace(opening, replacement));
            out.edits.push(Edit::delete(args.end..simple.range.end));
            target
        }
    };

    let (Some(attribute), Some((simples, at))) = (scope.attribute, target) else {
        return;
    };
    // A compound with `&` is the parent element, which already carries the token.
    if simples.iter().any(|s| s.kind == Kind::Nesting) {
        return;
    }
    out.edits.push(Edit::insert(at, attribute));
    if let Some(inventory) = scope.inventory
        && let Some((simple, reason)) = unmatched(css, simples, inventory)
    {
        let selector = &css[complex.range.clone()];
        out.diagnostics.push(
            CssDiagnostic::new(
                CssCode::UnusedSelector,
                span(&complex.range),
                format!("`{selector}` matches no element in {}", scope.scope_label),
            )
            .with_label(span(&simple.range), reason)
            .with_help(
                "Remove the rule, or wrap the selector in `:global()` if it targets elements \
                 outside this scope. JSX returned by a helper function (`const field = () => \
                 <label class=\"field\">…`) is not inside a nested `<style>`'s element: move \
                 the block to the top level of the file, or render that JSX inside the styled \
                 element",
            ),
        );
    }
}

/// The argument range of a `:global`/`:deep` pseudo-class (`LUM3016` when it has none), or
/// of any other functional pseudo-class.
fn argument(css: &str, simple: &Simple, out: &mut Rewrite) -> Option<Range<usize>> {
    let scoping = simple.pseudo_class(css, "global") || simple.pseudo_class(css, "deep");
    match &simple.args {
        Some(args) if !scoping || !css[args.clone()].trim().is_empty() => Some(args.clone()),
        _ if scoping => {
            let name = &css[simple.name.clone()];
            out.diagnostics.push(scope_error(
                simple,
                &format!("`:{name}` needs a selector argument, such as `:{name}(.selector)`"),
            ));
            None
        }
        _ => None,
    }
}

/// Removes the `:global(` / `:deep(` wrapper and its closing parenthesis.
fn unwrap(simple: &Simple, args: &Range<usize>, out: &mut Rewrite) {
    out.edits.push(Edit::delete(simple.range.start..args.start));
    out.edits.push(Edit::delete(args.end..simple.range.end));
}

/// Inside functional arguments (`:not(…)`, `:global(…)`, …) nothing is scoped: `:global()`
/// wrappers are removed and a `:deep()` is an error.
fn strip_nested(css: &str, range: Range<usize>, out: &mut Rewrite) {
    for complex in Parser::new(css, range).list() {
        for simple in complex.compounds.iter().flat_map(|c| &c.simples) {
            if simple.kind != Kind::PseudoClass {
                continue;
            }
            let Some(args) = argument(css, simple, out) else {
                continue;
            };
            if simple.pseudo_class(css, "deep") {
                out.diagnostics.push(scope_error(
                    simple,
                    "`:deep()` is only allowed at the top level of a selector",
                ));
                unwrap(simple, &args, out);
            } else if simple.pseudo_class(css, "global") {
                unwrap(simple, &args, out);
            }
            strip_nested(css, args, out);
        }
    }
}

fn scope_error(simple: &Simple, message: &str) -> CssDiagnostic {
    CssDiagnostic::new(CssCode::InvalidScopeSelector, span(&simple.range), message)
}

/// Whether a compound selects elements of this scope. A compound made only of `:global()`
/// parts and pseudo-classes/elements (`:global(.x):hover`) is global; one without `:global()`
/// is scoped even if it only has pseudo-classes (`:hover` is `*:hover`).
fn is_scoped(css: &str, simples: &[Simple]) -> bool {
    let has_subject = simples.iter().any(|s| {
        matches!(
            s.kind,
            Kind::Type
                | Kind::Universal
                | Kind::Class
                | Kind::Id
                | Kind::Attribute
                | Kind::Nesting
                | Kind::Other
        )
    });
    let has_global = simples.iter().any(|s| s.pseudo_class(css, "global"));
    has_subject || (!has_global && !simples.is_empty())
}

/// Before the first pseudo-element, else at the end of the compound.
fn insertion_point(compound: &Compound) -> usize {
    compound
        .simples
        .iter()
        .find(|s| s.kind == Kind::PseudoElement)
        .map_or(compound.range.end, |s| s.range.start)
}

/// The first type, class or id selector of the subject that no element of the scope has.
fn unmatched<'s>(
    css: &str,
    simples: &'s [Simple],
    inventory: &ElementInventory,
) -> Option<(&'s Simple, String)> {
    let name = |s: &Simple| &css[s.name.clone()];
    // A class passed to a component lands on an element the child renders.
    let passthrough = simples.iter().any(|s| {
        s.kind == Kind::Class && !s.escaped && inventory.component_classes.contains(name(s))
    });
    simples.iter().find_map(|s| {
        if s.escaped {
            return None;
        }
        let reason = match s.kind {
            Kind::Type
                if !inventory.dynamic_tags
                    && !passthrough
                    && !name(s).contains('|')
                    && !inventory.tags.contains(&name(s).to_ascii_lowercase()) =>
            {
                format!("no element is a `<{}>`", name(s))
            }
            Kind::Class
                if !inventory.dynamic_classes
                    && !inventory.classes.contains(name(s))
                    && !inventory.component_classes.contains(name(s)) =>
            {
                format!("no element has the class `{}`", name(s))
            }
            Kind::Id
                if !inventory.dynamic_ids && !passthrough && !inventory.ids.contains(name(s)) =>
            {
                format!("no element has the id `{}`", name(s))
            }
            _ => return None,
        };
        Some((s, reason))
    })
}

fn span(range: &Range<usize>) -> Span {
    Span::from_usize(range.start, range.end)
}

/// Legacy pseudo-elements written with one colon.
const LEGACY_PSEUDO_ELEMENTS: [&str; 4] = ["before", "after", "first-line", "first-letter"];

struct Parser<'a> {
    css: &'a str,
    bytes: &'a [u8],
    pos: usize,
    end: usize,
}

impl<'a> Parser<'a> {
    fn new(css: &'a str, range: Range<usize>) -> Self {
        Self {
            css,
            bytes: css.as_bytes(),
            pos: range.start,
            end: range.end,
        }
    }

    fn peek(&self) -> Option<u8> {
        self.peek_at(0)
    }

    fn peek_at(&self, n: usize) -> Option<u8> {
        (self.pos + n < self.end).then(|| self.bytes[self.pos + n])
    }

    fn skip_trivia(&mut self) {
        while let Some(byte) = self.peek() {
            if byte.is_ascii_whitespace() {
                self.pos += 1;
            } else if byte == b'/' && self.peek_at(1) == Some(b'*') {
                self.pos = self.css[self.pos + 2..self.end]
                    .find("*/")
                    .map_or(self.end, |offset| self.pos + 2 + offset + 2);
            } else {
                break;
            }
        }
    }

    fn list(&mut self) -> Vec<Complex> {
        let mut list = Vec::new();
        loop {
            list.push(self.complex());
            if self.peek() == Some(b',') {
                self.pos += 1;
            } else {
                return list;
            }
        }
    }

    fn complex(&mut self) -> Complex {
        self.skip_trivia();
        let start = self.pos;
        let mut end = start;
        let mut compounds = Vec::new();
        loop {
            self.skip_trivia();
            match self.peek() {
                None | Some(b',') => break,
                Some(b'>' | b'+' | b'~') => self.pos += 1,
                Some(b'|') if self.peek_at(1) == Some(b'|') => self.pos += 2,
                Some(_) => {
                    let compound = self.compound();
                    if compound.simples.is_empty() {
                        // A stray character such as `)`: keep it out of every compound.
                        self.pos = skip_char(self.css, self.pos);
                        continue;
                    }
                    end = compound.range.end;
                    compounds.push(compound);
                }
            }
        }
        Complex {
            compounds,
            range: start..end,
        }
    }

    fn compound(&mut self) -> Compound {
        let start = self.pos;
        let mut simples = Vec::new();
        while let Some(byte) = self.peek() {
            let begin = self.pos;
            let mut args = None;
            let mut name = begin..begin;
            let mut escaped = false;
            let kind = match byte {
                b'.' | b'#' => {
                    self.pos += 1;
                    let name_start = self.pos;
                    escaped = self.ident();
                    name = name_start..self.pos;
                    if byte == b'.' { Kind::Class } else { Kind::Id }
                }
                b'[' => {
                    self.block(b'[', b']');
                    Kind::Attribute
                }
                b':' => {
                    let element = self.peek_at(1) == Some(b':');
                    self.pos += if element { 2 } else { 1 };
                    let name_start = self.pos;
                    escaped = self.ident();
                    name = name_start..self.pos;
                    if self.peek() == Some(b'(') {
                        args = Some(self.block(b'(', b')'));
                    }
                    let legacy = args.is_none()
                        && LEGACY_PSEUDO_ELEMENTS
                            .iter()
                            .any(|n| self.css[name.clone()].eq_ignore_ascii_case(n));
                    if element || legacy {
                        Kind::PseudoElement
                    } else {
                        Kind::PseudoClass
                    }
                }
                b'*' => {
                    self.pos += 1;
                    self.namespace_tail();
                    Kind::Universal
                }
                b'&' => {
                    self.pos += 1;
                    Kind::Nesting
                }
                b'|' if self.peek_at(1) != Some(b'|') => {
                    // `|a`: no namespace.
                    self.namespace_tail();
                    name = begin..self.pos;
                    Kind::Type
                }
                b'\\' | b'-' | b'_' | b'a'..=b'z' | b'A'..=b'Z' | 0x80.. => {
                    escaped = self.ident();
                    self.namespace_tail();
                    name = begin..self.pos;
                    Kind::Type
                }
                b'0'..=b'9' | b'%' => {
                    self.pos += 1;
                    self.ident();
                    Kind::Other
                }
                _ => break,
            };
            simples.push(Simple {
                kind,
                range: begin..self.pos,
                name,
                escaped,
                args,
            });
        }
        Compound {
            simples,
            range: start..self.pos,
        }
    }

    /// Consumes identifier characters and escapes. Returns whether it saw an escape.
    fn ident(&mut self) -> bool {
        let mut escaped = false;
        while let Some(byte) = self.peek() {
            match byte {
                b'-' | b'_' | b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' => self.pos += 1,
                0x80.. => self.pos = skip_char(self.css, self.pos),
                b'\\' => {
                    escaped = true;
                    self.escape();
                }
                _ => break,
            }
        }
        escaped
    }

    /// A CSS escape: up to six hex digits plus one optional whitespace, or one character.
    fn escape(&mut self) {
        let hex = self.bytes[self.pos + 1..self.end]
            .iter()
            .take(6)
            .take_while(|b| b.is_ascii_hexdigit())
            .count();
        if hex == 0 {
            self.pos = skip_escape(self.css, self.pos).min(self.end);
            return;
        }
        self.pos += 1 + hex;
        match self.peek() {
            Some(b'\r') if self.peek_at(1) == Some(b'\n') => self.pos += 2,
            Some(byte) if byte.is_ascii_whitespace() => self.pos += 1,
            _ => {}
        }
    }

    /// `ns|name` / `ns|*`: the part after the namespace separator.
    fn namespace_tail(&mut self) {
        if self.peek() == Some(b'|') && self.peek_at(1) != Some(b'|') {
            self.pos += 1;
            if self.peek() == Some(b'*') {
                self.pos += 1;
            } else {
                self.ident();
            }
        }
    }

    /// Skips a bracketed block starting at `open`; returns the range inside it.
    fn block(&mut self, open: u8, close: u8) -> Range<usize> {
        debug_assert_eq!(self.peek(), Some(open));
        self.pos += 1;
        let inner = self.pos;
        let mut depth = 0usize;
        while let Some(byte) = self.peek() {
            match byte {
                b'"' | b'\'' => self.pos = skip_string(self.css, self.pos).min(self.end),
                b'\\' => self.escape(),
                b'(' | b'[' => {
                    depth += 1;
                    self.pos += 1;
                }
                b')' | b']' if depth > 0 => {
                    depth -= 1;
                    self.pos += 1;
                }
                _ if byte == close => {
                    let inner_end = self.pos;
                    self.pos += 1;
                    return inner..inner_end;
                }
                _ => self.pos = skip_char(self.css, self.pos),
            }
        }
        inner..self.pos
    }
}

fn skip_char(css: &str, pos: usize) -> usize {
    pos + css[pos..].chars().next().map_or(1, char::len_utf8)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::edits::Rewritten;

    fn rewrite_with(css: &str, nested: bool, attribute: Option<&str>) -> (String, Vec<String>) {
        let scope = ScopeContext {
            attribute,
            inventory: None,
            scope_label: "this file",
        };
        let mut out = Rewrite::default();
        let prelude = Prelude {
            range: 0..css.len(),
            nested,
        };
        rewrite_prelude(css, &prelude, &scope, &mut out);
        let messages = out
            .diagnostics
            .iter()
            .map(|d| format!("{} {}", d.code, d.message))
            .collect();
        (Rewritten::apply(css, out.edits).text, messages)
    }

    fn scoped(css: &str) -> String {
        let (text, messages) = rewrite_with(css, false, Some("[t]"));
        assert!(messages.is_empty(), "{messages:?}");
        text
    }

    fn nested(css: &str) -> String {
        let (text, messages) = rewrite_with(css, true, Some("[t]"));
        assert!(messages.is_empty(), "{messages:?}");
        text
    }

    #[test]
    fn scopes_the_last_compound_before_pseudo_elements() {
        assert_eq!(scoped(".a"), ".a[t]");
        assert_eq!(scoped("div.a > p + .b ~ span"), "div.a > p + .b ~ span[t]");
        assert_eq!(scoped(".a .b, .c"), ".a .b[t], .c[t]");
        assert_eq!(scoped(".a::before"), ".a[t]::before");
        assert_eq!(scoped(".a:hover::after"), ".a:hover[t]::after");
        assert_eq!(scoped(".a:before"), ".a[t]:before");
        assert_eq!(scoped(".a::part(x):hover"), ".a[t]::part(x):hover");
        assert_eq!(scoped("::selection"), "[t]::selection");
        assert_eq!(scoped(".a ::before"), ".a [t]::before");
        assert_eq!(scoped(":hover"), ":hover[t]");
        assert_eq!(scoped("*"), "*[t]");
        assert_eq!(scoped("svg|circle"), "svg|circle[t]");
        assert_eq!(scoped("a[href$=\".pdf\"]"), "a[href$=\".pdf\"][t]");
        assert_eq!(scoped(".a:not(.b, .c)"), ".a:not(.b, .c)[t]");
        assert_eq!(scoped(".a:is(.b .c)"), ".a:is(.b .c)[t]");
        assert_eq!(scoped("li:nth-child(2n + 1)"), "li:nth-child(2n + 1)[t]");
        assert_eq!(scoped(".a /* c */ .b"), ".a /* c */ .b[t]");
        assert_eq!(scoped(".\\31 0 .b\\:c"), ".\\31 0 .b\\:c[t]");
        assert_eq!(scoped(".\\31 0"), ".\\31 0[t]");
        assert_eq!(scoped(".a\n  .b"), ".a\n  .b[t]");
    }

    #[test]
    fn global_parts_stay_unscoped() {
        assert_eq!(scoped(":global(.a)"), ".a");
        assert_eq!(scoped(":global(.a .b)"), ".a .b");
        assert_eq!(scoped(":global(.a) :global(.b)"), ".a .b");
        assert_eq!(scoped(":global(.dark) .a"), ".dark .a[t]");
        assert_eq!(scoped(".a :global(.b)"), ".a[t] .b");
        assert_eq!(scoped(".a:global(.b)"), ".a.b[t]");
        assert_eq!(scoped(":global(.a):hover"), ".a:hover");
        assert_eq!(scoped(":global(.a)::before"), ".a::before");
        assert_eq!(scoped(".a:not(:global(.b))"), ".a:not(.b)[t]");
        assert_eq!(scoped(":GLOBAL(.a)"), ".a");
    }

    #[test]
    fn deep_scopes_only_the_left_part() {
        assert_eq!(scoped(".a :deep(.b)"), ".a[t] .b");
        assert_eq!(scoped(".a :deep(.b .c)"), ".a[t] .b .c");
        assert_eq!(scoped(".a:deep(.b)"), ".a[t] .b");
        assert_eq!(scoped(".a > :deep(.b)"), ".a[t] > .b");
        assert_eq!(scoped(":deep(.b)"), "[t] .b");
        assert_eq!(scoped(".x .a :deep(.b) .c"), ".x .a[t] .b .c");
        assert_eq!(scoped(":global(.x) :deep(.b)"), ".x .b");
        assert_eq!(scoped(".a :deep(:global(.b))"), ".a[t] .b");
        assert_eq!(nested(":deep(.b)"), ".b");
        assert_eq!(nested("& :deep(.b)"), "& .b");
    }

    #[test]
    fn nested_selectors_and_nesting_selector() {
        assert_eq!(nested(".b"), ".b[t]");
        assert_eq!(nested("> .b"), "> .b[t]");
        assert_eq!(nested("&:hover"), "&:hover");
        assert_eq!(nested("&.active, & + &"), "&.active, & + &");
        assert_eq!(nested(".x &"), ".x &");
        assert_eq!(nested("& .b::before"), "& .b[t]::before");
    }

    #[test]
    fn global_blocks_only_unwrap() {
        let (text, _) = rewrite_with(":global(.a) .b, .c :deep(.d)", false, None);
        assert_eq!(text, ".a .b, .c .d");
        let (text, _) = rewrite_with(":deep(.d)", false, None);
        assert_eq!(text, ".d");
    }

    #[test]
    fn invalid_global_and_deep() {
        let (text, messages) = rewrite_with(":global .a, .b:deep()", false, Some("[t]"));
        assert_eq!(text, ":global .a[t], .b:deep()[t]");
        assert_eq!(
            messages,
            [
                "LUM3016 `:global` needs a selector argument, such as `:global(.selector)`",
                "LUM3016 `:deep` needs a selector argument, such as `:deep(.selector)`",
            ]
        );
        let (text, messages) = rewrite_with(".a :deep(.b) :deep(.c)", false, Some("[t]"));
        assert_eq!(text, ".a[t] .b .c");
        assert_eq!(
            messages,
            ["LUM3016 only one `:deep()` is allowed per selector"]
        );
        let (text, messages) = rewrite_with(".a:not(:deep(.b))", false, Some("[t]"));
        assert_eq!(text, ".a:not(.b)[t]");
        assert_eq!(
            messages,
            ["LUM3016 `:deep()` is only allowed at the top level of a selector"]
        );
    }

    #[test]
    fn reports_selectors_without_matching_elements() {
        let inventory = ElementInventory {
            token: "t".into(),
            tags: ["div", "button"].map(String::from).into(),
            classes: ["card", "title"].map(String::from).into(),
            component_classes: ["cta"].map(String::from).into(),
            ids: ["main"].map(String::from).into(),
            ..ElementInventory::default()
        };
        let scope = ScopeContext {
            attribute: Some("[t]"),
            inventory: Some(&inventory),
            scope_label: "component `Card`",
        };
        let css = ".card .title, .missing, span, #main, #other, a.cta, .x :global(.y), \
                   .card:hover, .card :deep(.z), .\\31 0, &.nope, .card::before";
        let mut out = Rewrite::default();
        let prelude = Prelude {
            range: 0..css.len(),
            nested: true,
        };
        rewrite_prelude(css, &prelude, &scope, &mut out);
        let reports: Vec<String> = out
            .diagnostics
            .iter()
            .map(|d| format!("{} | {}", d.message, d.labels[0].message))
            .collect();
        assert_eq!(
            reports,
            [
                "`.missing` matches no element in component `Card` | no element has the class `missing`",
                "`span` matches no element in component `Card` | no element is a `<span>`",
                "`#other` matches no element in component `Card` | no element has the id `other`",
                "`.x :global(.y)` matches no element in component `Card` | no element has the class `x`",
            ]
        );
    }
}
