//! Character classes shared by the JS, JSX and CSS scanners.

/// JS line terminators. Masking keeps them so line numbers never move.
pub(super) fn is_line_terminator(ch: char) -> bool {
    matches!(ch, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// Bytes that may start a JS identifier. Non-ASCII bytes are resolved by the caller.
pub(super) fn is_ident_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || matches!(byte, b'_' | b'$' | b'\\') || byte >= 0x80
}

pub(super) fn is_ident_part(byte: u8) -> bool {
    is_ident_start(byte) || byte.is_ascii_digit()
}

/// Non-ASCII whitespace that JS treats as trivia (NBSP, BOM, Zs…).
pub(super) fn is_js_whitespace(ch: char) -> bool {
    ch.is_whitespace() || ch == '\u{FEFF}'
}

/// Decodes the character starting at byte `pos`, which must be a char boundary.
pub(super) fn char_at(source: &str, pos: usize) -> Option<char> {
    source.get(pos..).and_then(|rest| rest.chars().next())
}

/// `<style` followed by whitespace or `>` (spec §4.1).
pub(super) fn is_style_open(bytes: &[u8], pos: usize) -> bool {
    bytes.get(pos..pos + 6) == Some(b"<style")
        && matches!(
            bytes.get(pos + 6),
            Some(b' ' | b'\t' | b'\n' | b'\r' | 0x0C | b'>')
        )
}
