//! The animation invariant of an emitted SVG component (TASK-468), shared by the security tests
//! and the `svg_component` fuzz target: no emitted SMIL animation targets an `href`, an event
//! handler or `style`, and none holds a `javascript:` URL in `values`, `from`, `to` or `by`.
//!
//! It reads the component's source as an HTML parser would read the markup it renders, apart
//! from the sanitizer: attribute names in any case and with any prefix count.

const ANIMATIONS: [&str; 4] = ["animate", "animateMotion", "animateTransform", "set"];

/// The first emitted animation that breaks the invariant, as its source line.
pub fn unsafe_animation(source: &str) -> Option<&str> {
    source.lines().find(|line| {
        let line = line.trim_start();
        let Some(rest) = line.strip_prefix('<') else {
            return false;
        };
        let name_end = rest
            .find(|c: char| c.is_whitespace() || c == '/' || c == '>')
            .unwrap_or(rest.len());
        if !ANIMATIONS
            .iter()
            .any(|each| each.eq_ignore_ascii_case(&rest[..name_end]))
        {
            return false;
        }
        attributes(&rest[name_end..])
            .iter()
            .any(|(name, value)| breaks(name, value))
    })
}

fn breaks(name: &str, value: &str) -> bool {
    let name = name.rsplit(':').next().unwrap_or_default();
    if name.eq_ignore_ascii_case("attributeName") {
        let target = value.trim().to_ascii_lowercase();
        let target = target.rsplit(':').next().unwrap_or_default();
        target.ends_with("href") || target.starts_with("on") || target == "style"
    } else if ["values", "from", "to", "by"]
        .iter()
        .any(|each| name.eq_ignore_ascii_case(each))
    {
        value.split(';').any(script_url)
    } else {
        false
    }
}

/// Whether a browser reads `value` as a `javascript:` URL.
fn script_url(value: &str) -> bool {
    let scheme: String = value
        .trim_start_matches(|c: char| c <= ' ')
        .chars()
        .filter(|c| !matches!(c, '\t' | '\n' | '\r'))
        .take(11)
        .collect();
    scheme.eq_ignore_ascii_case("javascript:")
}

/// The attributes of an emitted start tag, from after its name: `name="value"` or
/// `name={"a JavaScript string"}`. Panics on anything else, so a change of the emitter's format
/// cannot hide an animation from the check.
fn attributes(mut tag: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    loop {
        tag = tag.trim_start();
        if tag.is_empty() || tag.starts_with('>') || tag.starts_with("/>") {
            return out;
        }
        let (name, rest) = tag
            .split_once('=')
            .unwrap_or_else(|| panic!("an attribute without a value: {tag}"));
        let (value, rest) = if let Some(rest) = rest.strip_prefix('"') {
            let end = rest.find('"').expect("a closing quote");
            (rest[..end].to_owned(), &rest[end + 1..])
        } else if let Some(rest) = rest.strip_prefix("{\"") {
            let (value, rest) = js_string(rest);
            (value, rest.strip_prefix('}').expect("a closing brace"))
        } else {
            panic!("an attribute value that is neither a string nor an expression: {rest}")
        };
        out.push((name.to_owned(), value));
        tag = rest;
    }
}

/// The text of a double-quoted JavaScript string from after its opening quote, and what follows
/// its closing quote.
fn js_string(text: &str) -> (String, &str) {
    let mut out = String::new();
    let mut chars = text.char_indices();
    while let Some((at, ch)) = chars.next() {
        match ch {
            '"' => return (out, &text[at + 1..]),
            '\\' => match chars.next().map(|(_, ch)| ch) {
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('u') => {
                    let hex: String = chars.by_ref().take(4).map(|(_, ch)| ch).collect();
                    let code = u32::from_str_radix(&hex, 16).expect("four hex digits");
                    out.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                }
                Some(other) => out.push(other),
                None => panic!("an unterminated escape"),
            },
            ch => out.push(ch),
        }
    }
    panic!("an unterminated string")
}
