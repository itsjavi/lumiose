//! Rendering the masked TSX (spec §4.1, masking invariant).
//!
//! Inside a block every character becomes spaces (one per UTF-8 byte or per UTF-16 code
//! unit, depending on the output) except line terminators, which are kept. On top of that:
//! - top-level blocks: `$` → `;` and the reference's close character → `;`;
//! - JSX blocks: `$` → `{` and the close character → `}`;
//! - expression blocks: `<sty` becomes `null` (`<style` becomes `{null}` for a JSX
//!   attribute value).
//!
//! Reference names are kept verbatim, so both outputs stay offset-identical to the source.

use super::chars::is_line_terminator;
use super::{Placement, StyleBlock};
use crate::span::Span;

#[derive(Debug, Clone, Default)]
pub(super) struct MaskPlan {
    ops: Vec<MaskOp>,
}

#[derive(Debug, Clone)]
struct MaskOp {
    span: Span,
    /// Replacement for the first characters of the block (`null` or `{null}`).
    prefix: &'static [u8],
    refs: Vec<RefMask>,
}

#[derive(Debug, Clone, Copy)]
struct RefMask {
    dollar: u32,
    name_end: u32,
    close: Option<u32>,
    open_char: u8,
    close_char: u8,
}

impl MaskPlan {
    pub(super) fn new(blocks: &[StyleBlock]) -> Self {
        let ops = blocks
            .iter()
            .map(|block| {
                let (prefix, chars): (&[u8], _) = match block.placement {
                    Placement::TopLevel => (b"", Some((b';', b';'))),
                    Placement::InJsx { .. } => (b"", Some((b'{', b'}'))),
                    Placement::Expression if block.attribute_value => (b"{null}", None),
                    Placement::Expression => (b"null", None),
                };
                let refs = match chars {
                    Some((open_char, close_char)) => block
                        .refs
                        .iter()
                        .map(|reference| RefMask {
                            dollar: reference.span.start,
                            name_end: reference.span.end,
                            close: reference.close,
                            open_char,
                            close_char,
                        })
                        .collect(),
                    None => Vec::new(),
                };
                MaskOp {
                    span: block.span,
                    prefix,
                    refs,
                }
            })
            .collect();
        Self { ops }
    }

    pub(super) fn render_utf8(&self, source: &str) -> String {
        let mut out = Utf8Sink(String::with_capacity(source.len()));
        self.render(source, &mut out);
        out.0
    }

    pub(super) fn render_utf16(&self, source: &str) -> Vec<u16> {
        let mut out = Utf16Sink(Vec::with_capacity(source.len()));
        self.render(source, &mut out);
        out.0
    }

    fn render(&self, source: &str, out: &mut impl Sink) {
        let mut copied = 0usize;
        for op in &self.ops {
            out.keep(&source[copied..op.span.start as usize]);
            let mut refs = op.refs.iter().peekable();
            for (index, ch) in source[op.span.range()].char_indices() {
                let offset = op.span.start + crate::span::to_u32(index);
                // The prefix overwrites `<style`, which is ASCII.
                if let Some(&ascii) = op.prefix.get(index) {
                    out.replace(ascii, ch);
                    continue;
                }
                // Retire references whose masking is complete.
                while let Some(reference) = refs.peek() {
                    let done = match reference.close {
                        Some(close) => offset > close,
                        None => offset >= reference.name_end,
                    };
                    if !done {
                        break;
                    }
                    refs.next();
                }
                match refs.peek() {
                    Some(reference) if offset == reference.dollar => {
                        out.replace(reference.open_char, ch);
                    }
                    Some(reference) if offset > reference.dollar && offset < reference.name_end => {
                        out.keep_char(ch);
                    }
                    Some(reference) if Some(offset) == reference.close => {
                        out.replace(reference.close_char, ch);
                    }
                    _ => out.blank(ch),
                }
            }
            copied = op.span.end as usize;
        }
        out.keep(&source[copied..]);
    }
}

trait Sink {
    fn keep(&mut self, text: &str);
    fn keep_char(&mut self, ch: char);
    /// Writes `ascii`, padded with spaces to the width of `ch` in this encoding.
    fn replace(&mut self, ascii: u8, ch: char);

    fn blank(&mut self, ch: char) {
        if is_line_terminator(ch) {
            self.keep_char(ch);
        } else {
            self.replace(b' ', ch);
        }
    }
}

struct Utf8Sink(String);

impl Sink for Utf8Sink {
    fn keep(&mut self, text: &str) {
        self.0.push_str(text);
    }

    fn keep_char(&mut self, ch: char) {
        self.0.push(ch);
    }

    fn replace(&mut self, ascii: u8, ch: char) {
        self.0.push(char::from(ascii));
        self.0.extend(std::iter::repeat_n(' ', ch.len_utf8() - 1));
    }
}

struct Utf16Sink(Vec<u16>);

impl Sink for Utf16Sink {
    fn keep(&mut self, text: &str) {
        self.0.extend(text.encode_utf16());
    }

    fn keep_char(&mut self, ch: char) {
        let mut buffer = [0u16; 2];
        self.0.extend_from_slice(ch.encode_utf16(&mut buffer));
    }

    fn replace(&mut self, ascii: u8, ch: char) {
        self.0.push(u16::from(ascii));
        self.0
            .extend(std::iter::repeat_n(u16::from(b' '), ch.len_utf16() - 1));
    }
}
