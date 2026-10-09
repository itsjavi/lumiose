//! The nesting limit (TASK-170): oxc's parser, semantic analysis, transformer and codegen recurse
//! once per nesting level, so a source nested thousands of levels deep (`((((…`, `{a:{a:…`,
//! `` `${`${…`` ``) would overflow the native stack and kill the host process (the dev server, the
//! language server, the MCP server). Before parsing, [`too_deep`] measures the bracket nesting of
//! the masked text with a light lexer; past [`MAX_DEPTH`] the file is rejected with `LUM1010`.
//! JSX element nesting is not counted here: the hosts compile on a large-stack thread, which covers
//! it (and any construct this lexer misses) far beyond real code.

use crate::span::Span;

/// Deepest bracket nesting accepted: far beyond hand-written code, and well within the stack the
/// hosts give the compiler.
pub const MAX_DEPTH: usize = 1000;

/// Where the nesting first goes past [`MAX_DEPTH`], if it does.
pub fn too_deep(text: &str) -> Option<Span> {
    let bytes = text.as_bytes();
    // Open brackets, plus template literals (`` ` ``) whose `${` is open: a `}` closes either.
    let mut stack: Vec<u8> = Vec::new();
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
                return Some(Span::new(i as u32 - 1, i as u32));
            }
            continue;
        }
        match byte {
            b'(' | b'[' | b'{' => stack.push(byte),
            b')' | b']' | b'}' => {
                // Unbalanced closers (in JSX text, regexes) are ignored.
                if stack.last().is_some_and(|&open| open != b'`') {
                    stack.pop();
                }
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
            return Some(Span::new(i as u32, i as u32 + 1));
        }
        i += 1;
    }
    None
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
}
