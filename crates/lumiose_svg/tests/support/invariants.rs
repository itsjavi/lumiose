//! The invariants of an emitted SVG component, shared by the security tests and the
//! `svg_component` fuzz target:
//! - **Animations** (TASK-468): no emitted SMIL animation targets an `href`, an event handler or
//!   `style`, and none holds a `javascript:` URL in `values`, `from`, `to` or `by`.
//! - **References** (decision-69, TASK-499): nothing the component renders loads a resource from
//!   outside the file.
//!
//! They read the component's source as a browser would read the markup it renders, apart from
//! the sanitizer: attribute names in any case and with any prefix count, and CSS goes through
//! `cssparser`, the tokenizer of Firefox's style engine, which follows the CSS Syntax spec.

use cssparser::{ParseError, Parser, ParserInput, Token};

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
            .0
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

/// Blocks nested deeper than this in emitted CSS must be empty: the sanitizer drops what it does
/// not read (its own limit is lower), and this check stays within the stack.
const MAX_CSS_DEPTH: usize = 128;

/// The first emitted reference to a resource outside the file, described:
/// - an `href` that is not a fragment (`#id`), on any element but a link `<a>`;
/// - in the CSS a browser reads (`<style>` text, and every attribute but `id`, `class`, `href`,
///   `begin`, `end` and `aria-*`): a URL token, `url()` or `src()` that names anything but a
///   fragment (a `url("…")` holds its string alone), a bad URL, an `image-set()` or `image()`
///   that holds a string, a URL or a `var()`, `env()` or `attr()` at any depth, or an `@import`
///   rule;
/// - a CSS block nested deeper than [`MAX_CSS_DEPTH`] that holds anything.
///
/// The prelude of a top-level `@namespace` names a namespace and loads nothing. `<style>` text
/// is read as written: the emitter escapes `<` and `&`, so the HTML parser keeps it as it is.
pub fn external_reference(source: &str) -> Option<String> {
    let mut lines = source.lines();
    while let Some(line) = lines.next() {
        let line = line.trim_start();
        let (name, tag) = if line == "<svg" {
            // The root's attributes, one per line, up to those the emitter adds.
            let mut tag = String::new();
            for line in lines.by_ref() {
                let line = line.trim_start();
                if line == "role={label() ? \"img\" : undefined}" {
                    break;
                }
                tag.push_str(line);
                tag.push(' ');
            }
            ("svg", tag)
        } else {
            let Some(rest) = line.strip_prefix('<') else {
                continue;
            };
            if !rest.starts_with(|c: char| c.is_ascii_alphabetic()) {
                continue;
            }
            let end = rest
                .find(|c: char| c.is_whitespace() || c == '/' || c == '>')
                .unwrap_or(rest.len());
            (&rest[..end], rest[end..].to_owned())
        };
        let (attributes, rest) = attributes(&tag);
        for (attribute, value) in attributes {
            if let Some(breach) = attribute_breach(name, &attribute, &value) {
                return Some(format!("<{name} {attribute}>: {breach}"));
            }
        }
        if name == "style"
            && let Some(text) = rest.strip_prefix('>')
        {
            // The text runs to `</style>`, over as many lines as it has.
            let mut css = text.to_owned();
            while !css.contains("</style>") {
                css.push('\n');
                css.push_str(lines.next().expect("the end of the <style> text"));
            }
            css.truncate(css.find("</style>").unwrap_or_default());
            if let Some(breach) = css_breach(&css, true) {
                return Some(format!("<style>: {breach}"));
            }
        }
    }
    None
}

fn attribute_breach(element: &str, name: &str, value: &str) -> Option<String> {
    let name = name.to_ascii_lowercase();
    let name = name.rsplit(':').next().unwrap_or_default();
    if name == "href" {
        return (element != "a" && !is_fragment(value)).then(|| format!("href=\"{value}\""));
    }
    if ["id", "class", "begin", "end"].contains(&name) || name.starts_with("aria-") {
        return None;
    }
    css_breach(value, false)
}

/// Whether a URL parser reads `url` as a fragment: leading spaces and control characters go.
fn is_fragment(url: &str) -> bool {
    url.trim_start_matches(|c: char| c <= ' ').starts_with('#')
}

/// The first breach in `css`, a stylesheet or a value.
fn css_breach(css: &str, stylesheet: bool) -> Option<String> {
    let mut input = ParserInput::new(css);
    let mut parser = Parser::new(&mut input);
    breach_in(&mut parser, 0, stylesheet)
}

fn breach_in(parser: &mut Parser, depth: usize, top_level: bool) -> Option<String> {
    // Top level: whether a rule starts here, and whether this is an `@namespace` prelude.
    let mut rule_start = true;
    let mut namespace = false;
    while let Ok(token) = parser.next_including_whitespace_and_comments() {
        let token = token.clone();
        if top_level {
            match &token {
                Token::WhiteSpace(_) | Token::Comment(_) | Token::CDO | Token::CDC => continue,
                Token::AtKeyword(name) if rule_start => {
                    if name.eq_ignore_ascii_case("import") {
                        return Some("@import".to_owned());
                    }
                    namespace = name.eq_ignore_ascii_case("namespace");
                    rule_start = false;
                    continue;
                }
                Token::Semicolon => {
                    rule_start = true;
                    namespace = false;
                    continue;
                }
                Token::CurlyBracketBlock => {
                    rule_start = true;
                    namespace = false;
                }
                _ if namespace => continue,
                _ => rule_start = false,
            }
        }
        let breach = match &token {
            Token::UnquotedUrl(url) if !is_fragment(url) => Some(format!("url({url})")),
            Token::BadUrl(url) => Some(format!("a bad url({url})")),
            Token::Function(name) if is_one_of(name, &["url", "src"]) => url_breach(parser, name),
            Token::Function(name)
                if is_one_of(name, &["image-set", "-webkit-image-set", "image"]) =>
            {
                holds_url(parser, depth + 1).then(|| format!("{name}() with a URL"))
            }
            _ if is_block(&token) => nested_breach(parser, depth + 1),
            _ => None,
        };
        if breach.is_some() {
            return breach;
        }
    }
    None
}

fn nested_breach(parser: &mut Parser, depth: usize) -> Option<String> {
    parser
        .parse_nested_block(|parser| -> Result<_, ParseError<()>> {
            if depth <= MAX_CSS_DEPTH {
                Ok(breach_in(parser, depth, false))
            } else {
                Ok((!parser.is_exhausted())
                    .then(|| format!("a block nested deeper than {MAX_CSS_DEPTH} levels")))
            }
        })
        .unwrap_or_default()
}

/// A `url()` or `src()` is fine when it holds one string, a fragment.
fn url_breach(parser: &mut Parser, name: &str) -> Option<String> {
    parser
        .parse_nested_block(|parser| -> Result<_, ParseError<()>> {
            let target = match parser.next() {
                Ok(Token::QuotedString(url)) => Some(url.to_string()),
                _ => None,
            };
            let fine = target.as_deref().is_some_and(is_fragment) && parser.is_exhausted();
            Ok((!fine).then(|| format!("{name}({})", target.unwrap_or_default())))
        })
        .unwrap_or_else(|_| Some(format!("{name}()")))
}

fn holds_url(parser: &mut Parser, depth: usize) -> bool {
    parser
        .parse_nested_block(|parser| -> Result<_, ParseError<()>> {
            while let Ok(token) = parser.next() {
                let token = token.clone();
                let found = match &token {
                    Token::QuotedString(_) | Token::UnquotedUrl(_) | Token::BadUrl(_) => true,
                    Token::Function(name)
                        if is_one_of(name, &["url", "src", "var", "env", "attr"]) =>
                    {
                        true
                    }
                    _ if is_block(&token) => depth >= MAX_CSS_DEPTH || holds_url(parser, depth + 1),
                    _ => false,
                };
                if found {
                    return Ok(true);
                }
            }
            Ok(false)
        })
        .unwrap_or(true)
}

fn is_one_of(name: &str, names: &[&str]) -> bool {
    names.iter().any(|each| name.eq_ignore_ascii_case(each))
}

fn is_block(token: &Token) -> bool {
    matches!(
        token,
        Token::Function(_)
            | Token::ParenthesisBlock
            | Token::SquareBracketBlock
            | Token::CurlyBracketBlock
    )
}

/// The attributes of an emitted start tag, from after its name, and what follows them (`>`,
/// `/>` or nothing): `name="value"` or `name={"a JavaScript string"}`. Panics on anything else,
/// so a change of the emitter's format cannot hide an attribute from the checks.
fn attributes(mut tag: &str) -> (Vec<(String, String)>, &str) {
    let mut out = Vec::new();
    loop {
        tag = tag.trim_start();
        if tag.is_empty() || tag.starts_with('>') || tag.starts_with("/>") {
            return (out, tag);
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
