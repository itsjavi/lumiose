//! Line/column ↔ byte offset conversion. Columns are UTF-16 code units, as in Lightning CSS
//! locations and source maps.

/// Which characters end a line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Newlines {
    /// CSS: `\n`, `\r\n`, `\r` and form feed (what Lightning CSS counts).
    Css,
    /// The `.stsx` file, as JS tools see it: `\n`, `\r\n`, `\r`, U+2028 and U+2029.
    Js,
}

#[derive(Debug, Clone)]
pub(crate) struct LineIndex {
    /// Byte offset of the start of every line.
    starts: Vec<usize>,
}

impl LineIndex {
    pub fn new(text: &str, newlines: Newlines) -> Self {
        let mut starts = vec![0];
        let mut chars = text.char_indices().peekable();
        while let Some((offset, ch)) = chars.next() {
            let end = match ch {
                '\r' => match chars.peek() {
                    Some(&(_, '\n')) => continue,
                    _ => offset + 1,
                },
                '\n' => offset + 1,
                '\u{c}' if newlines == Newlines::Css => offset + 1,
                '\u{2028}' | '\u{2029}' if newlines == Newlines::Js => offset + ch.len_utf8(),
                _ => continue,
            };
            starts.push(end);
        }
        Self { starts }
    }

    /// The byte offset of a zero-based line and UTF-16 column, clamped to the line.
    pub fn offset(&self, text: &str, line: u32, column: u32) -> usize {
        let Some(&start) = self.starts.get(line as usize) else {
            return text.len();
        };
        let end = self
            .starts
            .get(line as usize + 1)
            .copied()
            .unwrap_or(text.len());
        let mut utf16 = 0;
        for (offset, ch) in text[start..end].char_indices() {
            if utf16 >= column as usize {
                return start + offset;
            }
            utf16 += ch.len_utf16();
        }
        end
    }

    /// The zero-based line and UTF-16 column of a byte offset.
    pub fn position(&self, text: &str, offset: usize) -> (u32, u32) {
        let line = self.starts.partition_point(|&start| start <= offset) - 1;
        let start = self.starts[line];
        let column: usize = text[start..offset].chars().map(char::len_utf16).sum();
        (crate::to_u32(line), crate::to_u32(column))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_between_offsets_and_positions() {
        let text = "a\r\nb→c\rd\u{c}e";
        let css = LineIndex::new(text, Newlines::Css);
        assert_eq!(css.position(text, 0), (0, 0));
        assert_eq!(css.position(text, 3), (1, 0));
        assert_eq!(css.position(text, 7), (1, 2)); // `c`, after the 3-byte arrow
        assert_eq!(css.offset(text, 1, 2), 7);
        assert_eq!(css.position(text, 9), (2, 0));
        assert_eq!(css.position(text, 11), (3, 0));
        assert_eq!(css.offset(text, 9, 0), text.len());
        assert_eq!(css.offset(text, 0, 40), 3); // clamped to the end of the line
        let js = LineIndex::new(text, Newlines::Js);
        assert_eq!(js.position(text, 11), (2, 2));
    }
}
