//! Per-file prefixes for ids and class names, so that an inlined SVG never shares them with the
//! page or with another icon (repeated uses of one icon still repeat its ids).
//!
//! An id becomes `<prefix>__<id>`, and so does every reference to an id the file defines:
//! `href`/`xlink:href="#id"`, `url(#id)` in any attribute or `<style>`, `id.event` timing values
//! in `begin`/`end`, ARIA id references and `#id` selectors. References to ids the file does not
//! define point at the page and stay as they are. Class names get the prefix only when the file
//! has a `<style>` (otherwise they are hooks for the page's CSS), and selectors only for the
//! names the file uses, so a class the page adds (`<Icon class="spin" />`) still matches.

use std::collections::HashSet;

use cssparser::{ParseError, Parser, ParserInput, Token};
use roxmltree::Document;

/// ARIA attributes whose value is a list of ids.
const ARIA_ID_REFS: [&str; 8] = [
    "aria-activedescendant",
    "aria-controls",
    "aria-describedby",
    "aria-details",
    "aria-errormessage",
    "aria-flowto",
    "aria-labelledby",
    "aria-owns",
];

/// Blocks nested deeper than this in a `<style>` are left as they are (no stack overflow on
/// hostile input).
const MAX_CSS_DEPTH: usize = 64;

pub(crate) struct Prefixer<'a> {
    prefix: &'a str,
    ids: HashSet<&'a str>,
    /// The class names to prefix: those the file uses, when it has a `<style>`.
    classes: HashSet<&'a str>,
}

impl<'a> Prefixer<'a> {
    pub(crate) fn new(document: &'a Document<'_>, prefix: &'a str) -> Self {
        let elements = || document.descendants().filter(roxmltree::Node::is_element);
        let ids = elements()
            .filter_map(|element| element.attribute("id"))
            .filter(|id| !id.is_empty())
            .collect();
        let has_style = elements().any(|element| element.tag_name().name() == "style");
        let classes = if has_style {
            elements()
                .filter_map(|element| element.attribute("class"))
                .flat_map(str::split_ascii_whitespace)
                .collect()
        } else {
            HashSet::new()
        };
        Self {
            prefix,
            ids,
            classes,
        }
    }

    fn id(&self, id: &str) -> Option<String> {
        self.ids
            .contains(id)
            .then(|| format!("{}__{id}", self.prefix))
    }

    /// The value of the attribute `name` (a JSX name: `href`, `xml:space`) with prefixes.
    pub(crate) fn attribute(&self, name: &str, value: &str) -> String {
        match name {
            "id" => self.id(value).unwrap_or_else(|| value.to_owned()),
            "class" if !self.classes.is_empty() => value
                .split_ascii_whitespace()
                .map(|class| format!("{}__{class}", self.prefix))
                .collect::<Vec<_>>()
                .join(" "),
            "href" => value
                .strip_prefix('#')
                .and_then(|id| self.id(id))
                .map_or_else(|| value.to_owned(), |id| format!("#{id}")),
            // `begin="intro.end; 2s"`: SMIL sync and event bases name an element.
            "begin" | "end" => value
                .split(';')
                .map(|part| {
                    let trimmed = part.trim_start();
                    let lead = &part[..part.len() - trimmed.len()];
                    trimmed
                        .split_once('.')
                        .and_then(|(id, rest)| Some(format!("{lead}{}.{rest}", self.id(id)?)))
                        .unwrap_or_else(|| part.to_owned())
                })
                .collect::<Vec<_>>()
                .join(";"),
            _ if ARIA_ID_REFS.contains(&name) => value
                .split_ascii_whitespace()
                .map(|id| self.id(id).unwrap_or_else(|| id.to_owned()))
                .collect::<Vec<_>>()
                .join(" "),
            _ if contains_ignore_case(value, "url") => self.css(value, Mode::Values),
            _ => value.to_owned(),
        }
    }

    /// The text of a `<style>` element with prefixes.
    pub(crate) fn stylesheet(&self, css: &str) -> String {
        self.css(css, Mode::Rules)
    }

    fn css(&self, css: &str, mode: Mode) -> String {
        let mut input = ParserInput::new(css);
        let mut parser = Parser::new(&mut input);
        let mut insertions = Vec::new();
        self.walk(css, &mut parser, mode, 0, &mut insertions);
        if insertions.is_empty() {
            return css.to_owned();
        }
        insertions.sort_by_key(|(at, _)| *at);
        let mut out = String::with_capacity(css.len() + insertions.len() * 16);
        let mut last = 0;
        for (at, text) in insertions {
            out.push_str(&css[last..at]);
            out.push_str(&text);
            last = at;
        }
        out.push_str(&css[last..]);
        out
    }

    /// Collects `(offset, text)` insertions for the tokens of `parser`, read in `mode`.
    fn walk(
        &self,
        css: &str,
        parser: &mut Parser,
        mode: Mode,
        depth: usize,
        out: &mut Vec<(usize, String)>,
    ) {
        // Rules: whether the current prelude is an at-rule's (with its name) or a selector.
        let mut at_rule: Option<String> = None;
        let mut prelude_started = false;
        // Selectors: whether the previous token was a `.` (so an identifier is a class name).
        let mut after_dot = false;
        loop {
            let start = parser.position().byte_index();
            let Ok(token) = parser.next_including_whitespace_and_comments() else {
                break;
            };
            let token = token.clone();
            let nested = |parser: &mut Parser, mode: Mode, out: &mut Vec<(usize, String)>| {
                if depth < MAX_CSS_DEPTH {
                    let _ = parser.parse_nested_block(|parser| -> Result<(), ParseError<()>> {
                        self.walk(css, parser, mode, depth + 1, out);
                        Ok(())
                    });
                }
            };
            match mode {
                Mode::Rules => match &token {
                    Token::WhiteSpace(_) | Token::Comment(_) | Token::CDO | Token::CDC => {}
                    Token::AtKeyword(name) if !prelude_started => {
                        at_rule = Some(name.to_ascii_lowercase());
                        prelude_started = true;
                    }
                    Token::Semicolon => {
                        at_rule = None;
                        prelude_started = false;
                    }
                    Token::CurlyBracketBlock => {
                        let body = match at_rule.as_deref() {
                            Some(
                                "media" | "supports" | "container" | "layer" | "scope" | "document"
                                | "starting-style",
                            ) => Mode::Rules,
                            // A style rule's declarations, `@font-face`, `@keyframes`.
                            _ => Mode::Values,
                        };
                        nested(parser, body, out);
                        at_rule = None;
                        prelude_started = false;
                        after_dot = false;
                    }
                    _ => {
                        prelude_started = true;
                        if at_rule.is_some() {
                            if is_block(&token) {
                                nested(parser, Mode::Values, out);
                            }
                        } else {
                            after_dot = self.selector_token(&token, start, after_dot, out);
                            if let Token::Function(_) | Token::ParenthesisBlock = token {
                                nested(parser, Mode::Selector, out);
                            }
                        }
                    }
                },
                Mode::Selector => {
                    after_dot = self.selector_token(&token, start, after_dot, out);
                    if let Token::Function(_) | Token::ParenthesisBlock = token {
                        nested(parser, Mode::Selector, out);
                    }
                }
                Mode::Values => match &token {
                    Token::UnquotedUrl(url) => {
                        if let Some(id) = url.strip_prefix('#')
                            && self.ids.contains(id)
                        {
                            let raw = &css[start..parser.position().byte_index()];
                            if let Some(hash) = raw.find('#') {
                                out.push((start + hash + 1, format!("{}__", self.prefix)));
                            }
                        }
                    }
                    Token::Function(name) if name.eq_ignore_ascii_case("url") => {
                        nested(parser, Mode::Url, out);
                    }
                    _ if is_block(&token) => nested(parser, Mode::Values, out),
                    _ => {}
                },
                Mode::Url => {
                    if let Token::QuotedString(url) = &token
                        && let Some(id) = url.strip_prefix('#')
                        && self.ids.contains(id)
                    {
                        let raw = &css[start..parser.position().byte_index()];
                        // The raw token is `"#id"`: insert after the quote and the `#`.
                        if raw.get(1..2) == Some("#") {
                            out.push((start + 2, format!("{}__", self.prefix)));
                        }
                    }
                }
            }
        }
    }

    /// Records the insertion for `token` (an id or class selector); returns whether it is a `.`.
    fn selector_token(
        &self,
        token: &Token,
        start: usize,
        after_dot: bool,
        out: &mut Vec<(usize, String)>,
    ) -> bool {
        match token {
            Token::IDHash(id) if self.ids.contains(id.as_ref()) => {
                out.push((start + 1, format!("{}__", self.prefix)));
            }
            Token::Ident(class) if after_dot && self.classes.contains(class.as_ref()) => {
                out.push((start, format!("{}__", self.prefix)));
            }
            Token::Delim('.') => return true,
            _ => {}
        }
        false
    }
}

#[derive(Debug, Clone, Copy)]
enum Mode {
    /// A stylesheet or the body of a conditional group rule.
    Rules,
    /// Inside a functional pseudo-class of a selector (`:is(…)`, `:not(…)`).
    Selector,
    /// Declarations and values: only `url(#id)` changes.
    Values,
    /// The argument of `url(…)` written as a function (`url("#id")`).
    Url,
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

fn contains_ignore_case(haystack: &str, needle: &str) -> bool {
    haystack
        .as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}
