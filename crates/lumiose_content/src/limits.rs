//! Nesting limits (TASK-169): the HTML tree builder and Markdown's block parser slow down
//! quadratically with nesting depth (100 000 unclosed `<div>`s or `>` markers take seconds), and
//! no real document nests this deep. A cheap scan finds the depth before parsing.

/// Elements (and Markdown block quotes) nested deeper than this make the file an error.
pub(crate) const MAX_NESTING: usize = 512;

/// Elements whose end tag may be omitted: a new one (or the parent's end) closes them, so they
/// do not nest when left open (`<li>a<li>b`).
const OPTIONAL_END: [&str; 21] = [
    "p", "li", "dt", "dd", "option", "optgroup", "tr", "td", "th", "thead", "tbody", "tfoot", "rb",
    "rt", "rtc", "rp", "colgroup", "caption", "head", "body", "html",
];

/// Elements without content.
const VOID: [&str; 16] = [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "meta", "param",
    "source", "track", "wbr", "basefont",
];

/// The offset of the first start tag of `html` nested deeper than [`MAX_NESTING`] elements, from
/// a scan of its tags (comments and quoted attribute values skipped, raw text elements skipped
/// to their end tag, elements with optional end tags not counted).
pub(crate) fn html_too_deep(html: &str) -> Option<usize> {
    let lower = html.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let mut depth = 0usize;
    let mut at = 0;
    let skip_to = |from: usize, end: &str| {
        lower[from..]
            .find(end)
            .map_or(lower.len(), |i| from + i + end.len())
    };
    while let Some(found) = lower[at..].find('<') {
        let start = at + found;
        let rest = &lower[start..];
        if rest.starts_with("<!--") {
            at = skip_to(start + 4, "-->");
            continue;
        }
        if rest.starts_with("<!") || rest.starts_with("<?") {
            at = skip_to(start + 2, ">");
            continue;
        }
        let closing = rest.starts_with("</");
        let name_start = start + if closing { 2 } else { 1 };
        let name_end = lower[name_start..]
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-'))
            .map_or(lower.len(), |i| name_start + i);
        let name = &lower[name_start..name_end];
        if name.is_empty() || !name.starts_with(|c: char| c.is_ascii_alphabetic()) {
            at = start + 1;
            continue;
        }
        // To the tag's `>`, outside quoted values.
        let mut i = name_end;
        let mut quote = None;
        while i < bytes.len() {
            match (quote, bytes[i]) {
                (None, b'"' | b'\'') => quote = Some(bytes[i]),
                (Some(q), b) if b == q => quote = None,
                (None, b'>') => break,
                _ => {}
            }
            i += 1;
        }
        let self_closing = i > 0 && bytes.get(i - 1) == Some(&b'/');
        at = (i + 1).min(lower.len());
        if OPTIONAL_END.contains(&name) || VOID.contains(&name) {
            continue;
        }
        if closing {
            depth = depth.saturating_sub(1);
            continue;
        }
        if matches!(
            name,
            "script"
                | "style"
                | "textarea"
                | "title"
                | "xmp"
                | "iframe"
                | "noembed"
                | "noframes"
                | "plaintext"
        ) {
            at = skip_to(at, &format!("</{name}"));
            continue;
        }
        if !self_closing {
            depth += 1;
            if depth > MAX_NESTING {
                return Some(start);
            }
        }
    }
    None
}

/// The offset of the first line of `markdown` whose block quote markers (`>`) nest deeper than
/// [`MAX_NESTING`].
pub(crate) fn quotes_too_deep(markdown: &str) -> Option<usize> {
    let mut offset = 0;
    for line in markdown.split_inclusive('\n') {
        let markers = line
            .bytes()
            .take_while(|b| matches!(b, b'>' | b' ' | b'\t'))
            .filter(|&b| b == b'>')
            .count();
        if markers > MAX_NESTING {
            return Some(offset);
        }
        offset += line.len();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_deep_nesting() {
        assert_eq!(html_too_deep(&"<div>".repeat(512)), None);
        assert_eq!(html_too_deep(&"<div>".repeat(513)), Some(512 * 5));
        assert_eq!(html_too_deep(&"<div></div>".repeat(10_000)), None);
        // Optional end tags, void and self-closing elements, comments and raw text do not nest.
        assert_eq!(html_too_deep(&"<li>a<p>b<br><img/>".repeat(10_000)), None);
        assert_eq!(
            html_too_deep(&format!("<script>{}</script>", "<div>".repeat(1000))),
            None
        );
        assert_eq!(
            html_too_deep(&format!("<!--{}-->", "<div>".repeat(1000))),
            None
        );
        assert_eq!(html_too_deep(&"<a title='<div>'>".repeat(400)), None);
        assert_eq!(quotes_too_deep(&format!("{} x", "> ".repeat(512))), None);
        assert_eq!(
            quotes_too_deep(&format!("a\n{} x", ">".repeat(513))),
            Some(2)
        );
    }
}
