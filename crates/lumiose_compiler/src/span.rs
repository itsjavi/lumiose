//! Source spans and offset conversion.
//!
//! All compiler spans are UTF-8 byte offsets into the original source. JavaScript hosts
//! (shadow TSX, the language server) work in UTF-16 code units; [`Utf16Index`] converts.

use std::ops::Range;

/// A half-open byte range `start..end` in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, PartialOrd, Ord)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub const fn new(start: u32, end: u32) -> Self {
        Self { start, end }
    }

    pub(crate) fn from_usize(start: usize, end: usize) -> Self {
        Self::new(to_u32(start), to_u32(end))
    }

    pub const fn len(self) -> u32 {
        self.end - self.start
    }

    pub const fn is_empty(self) -> bool {
        self.start == self.end
    }

    pub const fn contains(self, offset: u32) -> bool {
        self.start <= offset && offset < self.end
    }

    pub fn range(self) -> Range<usize> {
        self.start as usize..self.end as usize
    }

    pub fn source_text(self, source: &str) -> &str {
        &source[self.range()]
    }

    /// Applies an offset mapping (for example byte → UTF-16) to both ends.
    pub fn map(self, f: &impl Fn(u32) -> u32) -> Self {
        Self::new(f(self.start), f(self.end))
    }
}

impl From<oxc_span::Span> for Span {
    fn from(span: oxc_span::Span) -> Self {
        Self::new(span.start, span.end)
    }
}

pub(crate) fn to_u32(offset: usize) -> u32 {
    u32::try_from(offset).expect("source files larger than 4 GiB are not supported")
}

/// Converts UTF-8 byte offsets of one source text into UTF-16 code-unit offsets.
#[derive(Debug, Clone)]
pub struct Utf16Index {
    /// `(byte offset, utf16 offset)` at the start of every non-ASCII character, plus the
    /// position right after it. Offsets between two entries advance one-to-one.
    anchors: Vec<(u32, u32)>,
}

impl Utf16Index {
    pub fn new(source: &str) -> Self {
        let mut anchors = Vec::new();
        let mut utf16 = 0u32;
        let mut last_byte = 0u32;
        for (byte, ch) in source.char_indices() {
            if ch.is_ascii() {
                continue;
            }
            let byte = to_u32(byte);
            utf16 += byte - last_byte;
            anchors.push((byte, utf16));
            utf16 += to_u32(ch.len_utf16());
            last_byte = byte + to_u32(ch.len_utf8());
            anchors.push((last_byte, utf16));
        }
        Self { anchors }
    }

    /// True when byte and UTF-16 offsets coincide everywhere (pure ASCII source).
    pub fn is_identity(&self) -> bool {
        self.anchors.is_empty()
    }

    /// Maps a byte offset that lies on a character boundary to its UTF-16 offset.
    pub fn to_utf16(&self, byte: u32) -> u32 {
        match self.anchors.binary_search_by_key(&byte, |&(b, _)| b) {
            Ok(i) => self.anchors[i].1,
            Err(0) => byte,
            Err(i) => {
                let (b, u) = self.anchors[i - 1];
                u + (byte - b)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_index_maps_offsets() {
        let source = "a→b😀c";
        let index = Utf16Index::new(source);
        let expected: Vec<(usize, u32)> = vec![(0, 0), (1, 1), (4, 2), (5, 3), (9, 5), (10, 6)];
        for (byte, utf16) in expected {
            assert_eq!(index.to_utf16(to_u32(byte)), utf16, "byte {byte}");
        }
        assert!(Utf16Index::new("plain").is_identity());
    }
}
