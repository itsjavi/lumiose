//! `LUM3013`: a top-level block references a top-level binding declared after it.
//!
//! Top-level masked references are `;name;` statements, so TypeScript reports them as
//! used before declaration. Only lexical bindings (`const`, `let`, `using`, `class`) have this
//! ordering hazard.
//!
//! The scanner's lexer collects those bindings itself, with [`declared_names`], when it meets a
//! declaration keyword at the top level. The check used to parse the masked text with OXC, whose
//! parser backtracks exponentially on some nestings (`a <s,(n = a <[t((n = …`, valid TSX
//! included): a file of a few hundred bytes took minutes, and the scanner runs on every
//! keystroke. A missed binding only loses this diagnostic (TypeScript still reports the use
//! before the declaration), so the collector prefers missing one to inventing one.

use super::chars::{char_at, is_ident_part, is_ident_start, is_js_whitespace};
use super::{Placement, StyleBlock};
use crate::diagnostics::{Code, Diagnostic};
use crate::span::Span;

/// Reports every top-level reference to a name in `bindings` (top-level lexical bindings, as
/// name spans in source order) that is declared after the reference.
pub(super) fn check_ref_order(
    source: &str,
    blocks: &[StyleBlock],
    bindings: &[Span],
    diagnostics: &mut Vec<Diagnostic>,
) {
    if bindings.is_empty() {
        return;
    }
    let name = |span: &Span| &source[span.start as usize..span.end as usize];
    for block in blocks
        .iter()
        .filter(|block| block.placement == Placement::TopLevel)
    {
        for reference in &block.refs {
            let root = reference.path[0].as_str();
            let Some(&declared) = bindings.iter().find(|span| name(span) == root) else {
                continue;
            };
            if declared.start < reference.span.start {
                continue;
            }
            diagnostics.push(
                Diagnostic::new(
                    Code::StyleRefBeforeDeclaration,
                    reference.span,
                    format!("`${root}` is used before its declaration"),
                )
                .with_label(declared, "declared here")
                .with_help(
                    "Move the `<style>` block below the declaration. Top-level blocks conventionally go at the end of the file.",
                ),
            );
        }
    }
}

/// What introduces the binding target at the cursor.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Declarator {
    /// The first one, after `const`, `let` or `using`.
    First,
    /// A later one, after a top-level `,`: taken only when it reads as a declarator (`name =`,
    /// `name:`, `name,`, `name;`), since the comma may belong to an expression or a type.
    Next,
    /// After `class`: a name, unless the class is anonymous.
    Class,
}

/// Patterns nest this deep at most; deeper ones are skipped, so the recursion is bounded.
const MAX_PATTERN_DEPTH: usize = 32;

/// Appends the names bound by the declarator that starts at `pos` to `bindings`: one identifier,
/// or the identifiers of a destructuring pattern. Appends nothing when the text does not read as
/// a declarator.
pub(super) fn declared_names(src: &str, pos: usize, kind: Declarator, bindings: &mut Vec<Span>) {
    let bytes = src.as_bytes();
    let start = skip_trivia(src, pos);
    let mark = bindings.len();
    let Some(&byte) = bytes.get(start) else {
        return;
    };
    let end = if matches!(byte, b'{' | b'[') && kind != Declarator::Class {
        // A pattern always has an initializer (or a type before it) at the top level.
        pattern(src, start, 0, bindings)
            .filter(|&end| matches!(bytes.get(skip_trivia(src, end)), Some(b'=' | b':')))
    } else {
        identifier(src, start).filter(|&end| {
            let word = &src[start..end];
            match kind {
                // `const enum E` declares an enum.
                Declarator::First => word != "enum",
                Declarator::Class => !matches!(word, "extends" | "implements"),
                Declarator::Next => {
                    let after = skip_trivia(src, end);
                    match bytes.get(after) {
                        None | Some(b':' | b',' | b';' | b'!') => true,
                        Some(b'=') => !matches!(bytes.get(after + 1), Some(b'=' | b'>')),
                        Some(_) => false,
                    }
                }
            }
        })
    };
    match end {
        Some(end) if byte != b'{' && byte != b'[' => {
            bindings.push(Span::new(start as u32, end as u32));
        }
        Some(_) => {}
        None => bindings.truncate(mark),
    }
}

/// The end of the identifier at `pos`, if one starts there. Identifiers written with escapes are
/// not names a `$reference` can spell, so they are not taken.
fn identifier(src: &str, pos: usize) -> Option<usize> {
    let bytes = src.as_bytes();
    let first = *bytes.get(pos)?;
    if !is_ident_start(first) || first == b'\\' {
        return None;
    }
    let mut end = pos;
    while let Some(&byte) = bytes.get(end) {
        if byte == b'\\' {
            return None;
        }
        if byte < 0x80 {
            if !is_ident_part(byte) {
                break;
            }
            end += 1;
        } else {
            match char_at(src, end) {
                Some(ch) if !is_js_whitespace(ch) => end += ch.len_utf8(),
                _ => break,
            }
        }
    }
    Some(end)
}

/// Collects the binding identifiers of the object or array pattern that opens at `open`, and
/// returns the position after its closing bracket. `None` when the text is not a pattern.
fn pattern(src: &str, open: usize, depth: usize, bindings: &mut Vec<Span>) -> Option<usize> {
    if depth >= MAX_PATTERN_DEPTH {
        return None;
    }
    let bytes = src.as_bytes();
    let object = bytes[open] == b'{';
    let closer = if object { b'}' } else { b']' };
    let mut pos = open + 1;
    loop {
        pos = skip_trivia(src, pos);
        let byte = *bytes.get(pos)?;
        if byte == closer {
            return Some(pos + 1);
        }
        if byte == b',' {
            // An array hole, or the separator after an element.
            pos += 1;
            continue;
        }
        if bytes[pos..].starts_with(b"...") {
            pos = target(src, skip_trivia(src, pos + 3), depth, bindings)?;
        } else if object {
            // `key`, `key: target`, `"key": target`, `[computed]: target`.
            let key_end = match byte {
                b'[' => skip_balanced(src, pos)?,
                b'"' | b'\'' => skip_string(bytes, pos)?,
                b'0'..=b'9' | b'.' => {
                    let mut end = pos;
                    while bytes
                        .get(end)
                        .is_some_and(|&b| is_ident_part(b) || b == b'.')
                    {
                        end += 1;
                    }
                    end
                }
                _ => identifier(src, pos)?,
            };
            let after = skip_trivia(src, key_end);
            if bytes.get(after) == Some(&b':') {
                pos = target(src, skip_trivia(src, after + 1), depth, bindings)?;
            } else {
                // Shorthand: the key is the binding.
                if !is_ident_start(byte) {
                    return None;
                }
                bindings.push(Span::new(pos as u32, key_end as u32));
                pos = key_end;
            }
        } else {
            pos = target(src, pos, depth, bindings)?;
        }
        // An optional default, then `,` or the closer.
        pos = skip_trivia(src, pos);
        match *bytes.get(pos)? {
            b'=' => pos = skip_default(src, pos + 1, closer)?,
            byte if byte == b',' || byte == closer => {}
            _ => return None,
        }
    }
}

/// A binding target inside a pattern: an identifier or a nested pattern.
fn target(src: &str, pos: usize, depth: usize, bindings: &mut Vec<Span>) -> Option<usize> {
    match *src.as_bytes().get(pos)? {
        b'{' | b'[' => pattern(src, pos, depth + 1, bindings),
        _ => {
            let end = identifier(src, pos)?;
            bindings.push(Span::new(pos as u32, end as u32));
            Some(end)
        }
    }
}

/// Skips a default value: up to the `,` or `closer` that ends it at this nesting level.
fn skip_default(src: &str, mut pos: usize, closer: u8) -> Option<usize> {
    let bytes = src.as_bytes();
    loop {
        pos = skip_trivia(src, pos);
        match *bytes.get(pos)? {
            b',' => return Some(pos),
            byte if byte == closer => return Some(pos),
            b'(' | b'[' | b'{' => pos = skip_balanced(src, pos)?,
            b')' | b']' | b'}' => return None,
            b'"' | b'\'' | b'`' => pos = skip_string(bytes, pos)?,
            _ => pos += 1,
        }
    }
}

/// The position after the bracket that closes the one at `open`. Iterative: the nesting comes
/// from the source.
fn skip_balanced(src: &str, open: usize) -> Option<usize> {
    let bytes = src.as_bytes();
    let mut depth = 0usize;
    let mut pos = open;
    loop {
        pos = skip_trivia(src, pos);
        match *bytes.get(pos)? {
            b'(' | b'[' | b'{' => {
                depth += 1;
                pos += 1;
            }
            b')' | b']' | b'}' => {
                depth -= 1;
                pos += 1;
                if depth == 0 {
                    return Some(pos);
                }
            }
            b'"' | b'\'' | b'`' => pos = skip_string(bytes, pos)?,
            _ => pos += 1,
        }
    }
}

/// The position after the string or template literal that starts at `start`. A template's
/// substitutions are not lexed: one that holds a backtick ends the literal early, and the
/// declarator then fails to read as one.
fn skip_string(bytes: &[u8], start: usize) -> Option<usize> {
    let quote = bytes[start];
    let mut pos = start + 1;
    loop {
        match *bytes.get(pos)? {
            b'\\' => pos += 1,
            b'\n' if quote != b'`' => return None,
            byte if byte == quote => return Some(pos + 1),
            _ => {}
        }
        pos += 1;
    }
}

/// Skips whitespace and comments.
fn skip_trivia(src: &str, mut pos: usize) -> usize {
    let bytes = src.as_bytes();
    while let Some(&byte) = bytes.get(pos) {
        match byte {
            b' ' | b'\t' | b'\n' | b'\r' | 0x0B | 0x0C => pos += 1,
            b'/' if bytes.get(pos + 1) == Some(&b'/') => {
                while bytes.get(pos).is_some_and(|&b| b != b'\n') {
                    pos += 1;
                }
            }
            b'/' if bytes.get(pos + 1) == Some(&b'*') => {
                pos += 2;
                while pos < bytes.len() && !bytes[pos..].starts_with(b"*/") {
                    pos += 1;
                }
                pos = (pos + 2).min(bytes.len());
            }
            0x80.. => match char_at(src, pos) {
                Some(ch) if is_js_whitespace(ch) => pos += ch.len_utf8(),
                _ => return pos,
            },
            _ => return pos,
        }
    }
    pos
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(src: &str, kind: Declarator) -> Vec<&str> {
        let mut bindings = Vec::new();
        declared_names(src, 0, kind, &mut bindings);
        bindings
            .iter()
            .map(|span| &src[span.start as usize..span.end as usize])
            .collect()
    }

    #[test]
    fn collects_identifiers_and_patterns() {
        use Declarator::{Class, First, Next};
        assert_eq!(names(" gap = 1", First), ["gap"]);
        assert_eq!(names(" gap", First), ["gap"]);
        assert_eq!(names(" enum E {}", First), [""; 0]);
        assert_eq!(
            names(" [a, , b = [1, 2], ...rest] = x", First),
            ["a", "b", "rest"]
        );
        assert_eq!(
            names(
                " { a, b: c, d = f(1, 2), e: { g = '}' }, [k]: h, 'i': j, ...r } = x",
                First
            ),
            ["a", "c", "d", "g", "h", "j", "r"]
        );
        assert_eq!(names(" { a }: Props = x", First), ["a"]);
        // Not a declaration: a block or an array expression.
        assert_eq!(names(" { a }\nfoo()", First), [""; 0]);
        assert_eq!(names(" { a, b.c } = x", First), [""; 0]);

        assert_eq!(names(" Late extends Base {}", Class), ["Late"]);
        assert_eq!(names(" extends Base {}", Class), [""; 0]);
        assert_eq!(names(" { }", Class), [""; 0]);

        assert_eq!(names(" b = 2", Next), ["b"]);
        assert_eq!(names(" b: number = 2", Next), ["b"]);
        assert_eq!(names(" b;", Next), ["b"]);
        assert_eq!(names(" [b] = x", Next), ["b"]);
        // A comma inside type arguments or an expression.
        assert_eq!(names(" number> = new Map()", Next), [""; 0]);
        assert_eq!(names(" b == 2", Next), [""; 0]);
        assert_eq!(names(" b => 2", Next), [""; 0]);
        assert_eq!(names(" b()", Next), [""; 0]);
    }

    #[test]
    fn deep_or_unterminated_patterns_bind_nothing() {
        let deep = format!(" {}a{} = x", "[".repeat(40), "]".repeat(40));
        assert_eq!(names(&deep, Declarator::First), [""; 0]);
        let open = format!(" {}", "[".repeat(100_000));
        assert_eq!(names(&open, Declarator::First), [""; 0]);
        assert_eq!(names(" { a = (", Declarator::First), [""; 0]);
    }
}
