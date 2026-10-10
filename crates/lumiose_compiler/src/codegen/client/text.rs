//! JSX text: masked style blocks are deleted before whitespace normalisation (spec §5.1), SVG
//! `<style>` blocks are re-emitted verbatim, and entities are decoded like TypeScript does.

use oxc_syntax::identifier::is_white_space_single_line;
use oxc_syntax::line_terminator::is_line_terminator;
use oxc_syntax::xml_entities::XML_ENTITIES;

use crate::scanner::StyleBlock;
use crate::span::Span;

/// A piece of a JSX text node after block handling.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextPiece {
    /// Raw JSX text (not yet normalised).
    Text(String),
    /// A native SVG `<style>` block, emitted verbatim into the template.
    Raw(String),
}

/// Splits the JSX text at `span` (in the original `source`) around the style blocks it contains.
pub fn split_text(source: &str, span: Span, blocks: &[StyleBlock]) -> Vec<TextPiece> {
    let mut pieces = Vec::new();
    let mut cursor = span.start;
    // Blocks are sorted and disjoint: start from the first one that ends after the text starts.
    let first = blocks.partition_point(|b| b.span.end <= span.start);
    for block in &blocks[first..] {
        if block.span.start >= span.end {
            break;
        }
        let start = block.span.start.max(span.start);
        if start > cursor {
            pieces.push(TextPiece::Text(
                source[cursor as usize..start as usize].to_owned(),
            ));
        }
        // An SVG block is emitted once, by the text node that contains its start.
        if block.svg && block.span.start >= span.start {
            pieces.push(TextPiece::Raw(block.span.source_text(source).to_owned()));
        }
        cursor = block.span.end.min(span.end).max(cursor);
    }
    if cursor < span.end {
        pieces.push(TextPiece::Text(
            source[cursor as usize..span.end as usize].to_owned(),
        ));
    }
    pieces
}

/// JSX whitespace rules (TypeScript's `fixupWhitespaceAndDecodeEntities`): lines are trimmed,
/// whitespace-only lines dropped, the rest joined with one space; then entities are decoded.
/// Returns `None` when nothing remains.
pub fn normalize(text: &str) -> Option<String> {
    let mut result = String::new();
    let mut first_non_ws: Option<usize> = Some(0);
    let mut last_non_ws: Option<usize> = None;
    let push_line = |line: &str, result: &mut String| {
        if !result.is_empty() {
            result.push(' ');
        }
        result.push_str(&decode_entities(line));
    };
    for (index, c) in text.char_indices() {
        if is_line_terminator(c) {
            if let (Some(first), Some(last)) = (first_non_ws, last_non_ws)
                && last > first
            {
                push_line(&text[first..last], &mut result);
            }
            first_non_ws = None;
        } else if !is_white_space_single_line(c) {
            last_non_ws = Some(index + c.len_utf8());
            if first_non_ws.is_none() {
                first_non_ws = Some(index);
            }
        }
    }
    if let Some(first) = first_non_ws {
        push_line(&text[first..], &mut result);
    }
    (!result.is_empty()).then_some(result)
}

/// Decodes `&name;`, `&#123;` and `&#x7B;` (unknown names stay as written).
pub fn decode_entities(text: &str) -> String {
    if !text.contains('&') {
        return text.to_owned();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let after = &rest[amp + 1..];
        let Some(semi) = after.find(';').filter(|&i| !after[..i].contains('&')) else {
            out.push('&');
            rest = after;
            continue;
        };
        let word = &after[..semi];
        let decoded = if let Some(number) = word.strip_prefix('#') {
            let value = match number.strip_prefix(['x', 'X']) {
                Some(hex) => u32::from_str_radix(hex, 16).ok(),
                None => number.parse::<u32>().ok(),
            };
            value.and_then(char::from_u32)
        } else {
            XML_ENTITIES.get(word).copied()
        };
        match decoded {
            Some(c) => {
                out.push(c);
                rest = &after[semi + 1..];
            }
            None => {
                out.push('&');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_like_typescript() {
        assert_eq!(normalize("  a  "), Some("  a  ".to_owned()));
        assert_eq!(normalize("\n  a\n  b  \n"), Some("a b".to_owned()));
        assert_eq!(normalize("Clicked "), Some("Clicked ".to_owned()));
        assert_eq!(normalize(" times\n      \n    "), Some(" times".to_owned()));
        assert_eq!(normalize("\n   \n"), None);
        assert_eq!(
            normalize("a &amp; b&nbsp;&#65;&#x42;&bogus;"),
            Some("a & b\u{a0}AB&bogus;".to_owned())
        );
    }
}
