//! Per-file prefixes for ids and class names, so that an inlined SVG never shares them with the
//! page or with another icon (repeated uses of one icon still repeat its ids).
//!
//! An id becomes `<prefix>__<id>`, and so does every reference to an id the file defines:
//! `href`/`xlink:href="#id"`, `url(#id)` in any attribute or `<style>`, `id.event` timing values
//! in `begin`/`end`, ARIA id references and `#id` selectors. References to ids the file does not
//! define point at the page and stay as they are. Class names get the prefix only when the file
//! has a `<style>` (otherwise they are hooks for the page's CSS), and selectors only for the
//! names the file uses, so a class the page adds (`<Icon class="spin" />`) still matches.
//!
//! The same pass drops the CSS references to resources outside the file (decision-69): a
//! `url()` or `src()` whose target is not a fragment (`#id`), and an `image-set()` holding a URL,
//! become `none`, and `@import` rules go. Fragment references stay.

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
            // Any function, also an escaped `\75 rl(…)`: a `url()` may hide behind an escape.
            _ if value.contains('(') => self.css(value, Mode::Values),
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
        let mut edits = Vec::new();
        self.walk(css, &mut parser, mode, 0, &mut edits);
        if edits.is_empty() {
            return css.to_owned();
        }
        edits.sort_by_key(|edit| (edit.start, edit.end));
        let mut out = String::with_capacity(css.len() + edits.len() * 16);
        let mut last = 0;
        for edit in edits {
            // An edit inside a range already replaced (a prefix in a dropped `@import`).
            if edit.start < last {
                continue;
            }
            out.push_str(&css[last..edit.start]);
            out.push_str(&edit.text);
            last = edit.end;
        }
        out.push_str(&css[last..]);
        out
    }

    /// Collects the edits for the tokens of `parser`, read in `mode`.
    fn walk(&self, css: &str, parser: &mut Parser, mode: Mode, depth: usize, out: &mut Vec<Edit>) {
        // Rules: whether the current prelude is an at-rule's (with its name) or a selector.
        let mut at_rule: Option<String> = None;
        let mut prelude_started = false;
        // Rules: where the current `@import` starts; the rule goes, up to its `;`.
        let mut import = None;
        // Selectors: whether the previous token was a `.` (so an identifier is a class name).
        let mut after_dot = false;
        loop {
            let start = parser.position().byte_index();
            let Ok(token) = parser.next_including_whitespace_and_comments() else {
                break;
            };
            let token = token.clone();
            let nested = |parser: &mut Parser, mode: Mode, out: &mut Vec<Edit>| {
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
                        if name.eq_ignore_ascii_case("import") {
                            import = Some(start);
                        }
                    }
                    Token::Semicolon => {
                        if let Some(from) = import.take() {
                            out.push(Edit::replace(from, parser.position().byte_index(), ""));
                        }
                        at_rule = None;
                        prelude_started = false;
                    }
                    Token::CurlyBracketBlock if import.is_some() => {
                        let _ =
                            parser.parse_nested_block(|_| -> Result<(), ParseError<()>> { Ok(()) });
                        let from = import.take().unwrap_or(start);
                        out.push(Edit::replace(from, parser.position().byte_index(), ""));
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
                            // `@namespace svg url(…)` names a namespace, it loads nothing.
                            if is_block(&token) && at_rule.as_deref() != Some("namespace") {
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
                        if let Some(id) = url.strip_prefix('#') {
                            if self.ids.contains(id) {
                                let raw = &css[start..parser.position().byte_index()];
                                if let Some(hash) = raw.find('#') {
                                    out.push(Edit::insert(start + hash + 1, self.mark()));
                                }
                            }
                        } else {
                            out.push(Edit::replace(start, parser.position().byte_index(), "none"));
                        }
                    }
                    Token::Function(name)
                        if name.eq_ignore_ascii_case("url") || name.eq_ignore_ascii_case("src") =>
                    {
                        self.url_function(css, parser, start, out);
                    }
                    Token::Function(name)
                        if name.eq_ignore_ascii_case("image-set")
                            || name.eq_ignore_ascii_case("-webkit-image-set") =>
                    {
                        if holds_url(parser) {
                            out.push(Edit::replace(start, parser.position().byte_index(), "none"));
                        }
                    }
                    _ if is_block(&token) => nested(parser, Mode::Values, out),
                    _ => {}
                },
            }
        }
        // An `@import` without its `;`, at the end of the stylesheet or block.
        if let Some(from) = import {
            out.push(Edit::replace(from, parser.position().byte_index(), ""));
        }
    }

    /// `<prefix>__`.
    fn mark(&self) -> String {
        format!("{}__", self.prefix)
    }

    /// Records the edit for a `url("…")` or `src(…)`, from after its name: a reference to an id of
    /// the file gets the prefix, other fragments stay, and anything else becomes `none`.
    fn url_function(&self, css: &str, parser: &mut Parser, start: usize, out: &mut Vec<Edit>) {
        let mut target = None;
        let _ = parser.parse_nested_block(|parser| -> Result<(), ParseError<()>> {
            let at = parser.position().byte_index();
            if let Ok(Token::QuotedString(url)) = parser.next() {
                target = Some((at, url.to_string()));
            }
            Ok(())
        });
        match target {
            Some((at, url)) if is_fragment(&url) => {
                // The raw token is `"#id"`: insert after the quote and the `#`.
                if url
                    .strip_prefix('#')
                    .is_some_and(|id| self.ids.contains(id))
                    && css.get(at + 1..at + 2) == Some("#")
                {
                    out.push(Edit::insert(at + 2, self.mark()));
                }
            }
            _ => out.push(Edit::replace(start, parser.position().byte_index(), "none")),
        }
    }

    /// Records the insertion for `token` (an id or class selector); returns whether it is a `.`.
    fn selector_token(
        &self,
        token: &Token,
        start: usize,
        after_dot: bool,
        out: &mut Vec<Edit>,
    ) -> bool {
        match token {
            Token::IDHash(id) if self.ids.contains(id.as_ref()) => {
                out.push(Edit::insert(start + 1, self.mark()));
            }
            Token::Ident(class) if after_dot && self.classes.contains(class.as_ref()) => {
                out.push(Edit::insert(start, self.mark()));
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
    /// Declarations and values: `url(#id)` gets the prefix, URLs of other resources go.
    Values,
}

/// A change to CSS text: `text` replaces `start..end`, or goes at `start` when they are equal.
struct Edit {
    start: usize,
    end: usize,
    text: String,
}

impl Edit {
    fn insert(at: usize, text: String) -> Self {
        Self {
            start: at,
            end: at,
            text,
        }
    }

    fn replace(start: usize, end: usize, text: &str) -> Self {
        Self {
            start,
            end,
            text: text.to_owned(),
        }
    }
}

/// Whether `url` is a fragment, a reference inside the document (`#id`), as a URL parser reads
/// it: leading spaces and control characters are ignored.
fn is_fragment(url: &str) -> bool {
    url.trim_start_matches(|c: char| c <= ' ').starts_with('#')
}

/// Whether the arguments of the function `parser` is at (an `image-set()`) name an image by URL:
/// a string, a `url()` or a `src()`, or a `var()`, `env()` or `attr()` that could hold one.
fn holds_url(parser: &mut Parser) -> bool {
    parser
        .parse_nested_block(|parser| -> Result<bool, ParseError<()>> {
            let mut found = false;
            while let Ok(token) = parser.next() {
                found |= match token {
                    Token::QuotedString(_) | Token::UnquotedUrl(_) | Token::BadUrl(_) => true,
                    Token::Function(name) => ["url", "src", "var", "env", "attr"]
                        .iter()
                        .any(|each| name.eq_ignore_ascii_case(each)),
                    _ => false,
                };
            }
            Ok(found)
        })
        .unwrap_or(true)
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
