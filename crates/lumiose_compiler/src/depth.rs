//! The nesting limit (TASK-170): oxc's parser, semantic analysis, transformer and codegen recurse
//! once per nesting level, so a source nested thousands of levels deep (`((((…`, `{a:{a:…`,
//! `` `${`${…`` ``) would overflow the native stack and kill the host process (the dev server, the
//! language server, the MCP server). Before parsing, [`check`] measures the bracket nesting of
//! the masked text with a light lexer; past [`MAX_DEPTH`] the file is rejected with `LUM1010`.
//! JSX element nesting is not counted here: the hosts compile on a large-stack thread, which covers
//! it (and any construct this lexer misses) far beyond real code.
//!
//! The same pass bounds oxc's speculation (TASK-600). In TypeScript a `<` may open type arguments,
//! so the parser tries that reading and, when it fails, parses the same text again as a comparison.
//! A bracket opened inside such a reading can hold the next `<` (`a < (n = a < (n = 0))`: a
//! function type whose parameter default is an expression), so each level doubles the parse time
//! and a few dozen levels hang the host. [`check`] counts the brackets open at once that were
//! opened after a `<` nothing closed; past [`MAX_SPECULATION`] the file is rejected too.

use crate::span::Span;

/// Deepest bracket nesting accepted: far beyond hand-written code, and well within the stack the
/// hosts give the compiler.
pub const MAX_DEPTH: usize = 1000;

/// Brackets open at once that each follow an unclosed `<`: the parse time doubles with each, so
/// this allows a slowdown of about a thousand times on the text inside, which real code (ten
/// levels of generics or comparisons, each holding the next) does not reach.
pub const MAX_SPECULATION: usize = 10;

/// A nesting limit a source goes past.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Limit {
    /// More than [`MAX_DEPTH`] open brackets.
    Depth,
    /// More than [`MAX_SPECULATION`] open brackets that each follow an unclosed `<`.
    Speculation,
}

impl Limit {
    /// The `LUM1010` message for this limit.
    pub fn message(self) -> String {
        match self {
            Self::Depth => format!(
                "brackets are nested more than {MAX_DEPTH} levels deep here; the file is not compiled"
            ),
            Self::Speculation => format!(
                "more than {MAX_SPECULATION} nested brackets each follow a `<` that nothing closes; \
                 the file is not compiled, because parsing it would take too long"
            ),
        }
    }

    /// How to get under this limit.
    pub fn help(self) -> &'static str {
        match self {
            Self::Depth => "Split the expression into named parts (constants or functions).",
            Self::Speculation => "Name the inner types or expressions (a type alias, a constant).",
        }
    }
}

/// The first limit the nesting goes past, and where.
pub fn check(text: &str) -> Option<(Limit, Span)> {
    let bytes = text.as_bytes();
    // Open brackets, plus template literals (`` ` ``) whose `${` is open: a `}` closes either.
    let mut stack: Vec<u8> = Vec::new();
    // Per open bracket: whether it follows an unclosed `<`, and whether a `<` is unclosed inside
    // it. `pending[0]` is the top level.
    let mut speculative: Vec<bool> = Vec::new();
    let mut pending: Vec<bool> = vec![false];
    let mut speculation = 0usize;
    let mut i = 0;
    while i < bytes.len() {
        let byte = bytes[i];
        // Inside a template literal's text.
        if stack.last() == Some(&b'`') {
            match byte {
                b'\\' => i += 1,
                b'`' => {
                    stack.pop();
                }
                b'$' if bytes.get(i + 1) == Some(&b'{') => {
                    stack.push(b'{');
                    i += 1;
                }
                _ => {}
            }
            i += 1;
            if stack.len() > MAX_DEPTH {
                return Some((Limit::Depth, Span::new(i as u32 - 1, i as u32)));
            }
            continue;
        }
        match byte {
            b'(' | b'[' | b'{' => {
                stack.push(byte);
                let follows = pending.last().copied().unwrap_or(false);
                speculative.push(follows);
                pending.push(false);
                speculation += usize::from(follows);
                if speculation > MAX_SPECULATION {
                    return Some((Limit::Speculation, Span::new(i as u32, i as u32 + 1)));
                }
            }
            b')' | b']' | b'}' => {
                // Unbalanced closers (in JSX text, regexes) are ignored.
                if stack.last().is_some_and(|&open| open != b'`') {
                    stack.pop();
                    speculation -= usize::from(speculative.pop().unwrap_or(false));
                    if pending.len() > 1 {
                        pending.pop();
                    }
                }
            }
            // A `<` that may open type arguments (`<=` and `<<` cannot).
            b'<' if !matches!(bytes.get(i + 1), Some(b'=' | b'<')) => set(&mut pending, true),
            b'<' => i += 1,
            // What ends that reading before the next bracket: the `>` that closes it, a
            // statement's end, an assignment or a logical operator. `=>` does not: a function
            // type goes on after it.
            b'=' if bytes.get(i + 1) == Some(&b'>') => i += 1,
            b'>' | b';' | b'=' => set(&mut pending, false),
            b'&' | b'|' if bytes.get(i + 1) == Some(&byte) => {
                set(&mut pending, false);
                i += 1;
            }
            b'`' => stack.push(b'`'),
            b'"' | b'\'' => i = string_end(bytes, i),
            b'/' if bytes.get(i + 1) == Some(&b'/') => {
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
            }
            b'/' if bytes.get(i + 1) == Some(&b'*') => {
                i += 2;
                while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                    i += 1;
                }
                i += 1;
            }
            _ => {}
        }
        if stack.len() > MAX_DEPTH {
            return Some((Limit::Depth, Span::new(i as u32, i as u32 + 1)));
        }
        i += 1;
    }
    None
}

fn set(pending: &mut [bool], value: bool) {
    if let Some(last) = pending.last_mut() {
        *last = value;
    }
}

/// The index of the quote that closes the string starting at `start` (or the line end: an
/// unterminated string is the parser's to report).
fn string_end(bytes: &[u8], start: usize) -> usize {
    let quote = bytes[start];
    let mut i = start + 1;
    while i < bytes.len() {
        match bytes[i] {
            b'\\' => i += 1,
            b'\n' => return i,
            byte if byte == quote => return i,
            _ => {}
        }
        i += 1;
    }
    i
}

#[cfg(test)]
mod tests {
    use super::*;

    fn too_deep(text: &str) -> Option<Span> {
        check(text)
            .filter(|(limit, _)| *limit == Limit::Depth)
            .map(|(_, span)| span)
    }

    #[test]
    fn measures_brackets_and_template_substitutions() {
        let nested = |open: &str, close: &str, n: usize| {
            format!("x = {}1{};", open.repeat(n), close.repeat(n))
        };
        assert!(too_deep(&nested("(", ")", MAX_DEPTH)).is_none());
        assert!(too_deep(&nested("(", ")", MAX_DEPTH + 1)).is_some());
        assert!(too_deep(&nested("{a:", "}", MAX_DEPTH + 1)).is_some());
        assert!(too_deep(&nested("`${", "}`", MAX_DEPTH / 2 + 1)).is_some());
        // Brackets in strings, comments and template text do not count.
        let quoted = "(".repeat(MAX_DEPTH + 5);
        for text in [
            format!("x = \"{quoted}\";"),
            format!("x = '{quoted}';"),
            format!("// {quoted}\nx = 1;"),
            format!("/* {quoted} */ x = 1;"),
            format!("x = `{quoted}`;"),
        ] {
            assert!(too_deep(&text).is_none(), "{text}");
        }
        // Closers without openers (JSX text, regexes) do not underflow.
        assert!(too_deep(")))] }} x = (1);").is_none());
    }

    #[test]
    fn counts_brackets_that_follow_an_unclosed_less_than() {
        let nested = |open: &str, close: &str, n: usize| {
            format!("x = {}0{};", open.repeat(n), close.repeat(n))
        };
        let limit = |text: &str| check(text).map(|(limit, _)| limit);
        for (open, close) in [("a <(n = ", ")"), ("a <[(n = ", ")]"), ("a <{m(n = ", ")}")] {
            assert_eq!(limit(&nested(open, close, MAX_SPECULATION)), None, "{open}");
            assert_eq!(
                limit(&nested(open, close, MAX_SPECULATION + 1)),
                Some(Limit::Speculation),
                "{open}"
            );
        }
        // `=>` keeps a `<` open: a function type goes on after it.
        assert!(limit(&nested("a <() => (n = ", ")", MAX_SPECULATION + 1)).is_some());
        // Closed type arguments, JSX attributes, logical operators and siblings do not add up.
        let n = MAX_SPECULATION * 3;
        for text in [
            nested("f<T>(", ")", n),
            nested("<A b={(", ")}/>", n),
            nested("a < b && (", ")", n),
            nested("a <= (", ")", n),
            nested("a << (", ")", n),
            "x = a < (1);".repeat(n),
            format!(
                "type T = {}{};",
                "Map<string, Set<".repeat(n),
                ">>".repeat(n)
            ),
        ] {
            assert_eq!(limit(&text), None, "{text}");
        }
        assert!(too_deep(&nested("a <(n = ", ")", MAX_SPECULATION + 1)).is_none());
    }
}
