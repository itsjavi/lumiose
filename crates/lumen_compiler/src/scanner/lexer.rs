//! The mode-stack lexer: JS, template literal, JSX tag, JSX children and JSX expression
//! containers are frames on a stack; strings, comments and regexes are scanned atomically.
//!
//! It does not build an AST. In JS mode it only tracks whether an expression may start at
//! the current position (`Prev`), which decides whether `/` begins a regex and whether `<`
//! begins JSX. TypeScript type syntax is mostly transparent to that rule; the remaining
//! ambiguity (generic function types such as `type F = <T>(x: T) => T`) is resolved by
//! speculation: every JSX root records a checkpoint, and JSX text that TSX rejects (`>`,
//! `}`) or a malformed tag rewinds to it and re-reads the `<` as an operator.

use super::FileKind;
use super::JsxParentKind;
use super::StyleBlock;
use super::block::BlockPosition;
use super::chars::{char_at, is_ident_part, is_ident_start, is_js_whitespace, is_style_open};
use crate::diagnostics::{Code, Diagnostic, Severity};
use crate::span::Span;

/// What the previous significant JS token allows next.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Prev {
    /// Start of a statement: file start, `;`, a block's `{` or `}`, `else`, a control `)`.
    Start,
    /// After an operator or keyword that expects an expression.
    Expr,
    /// After `(` or `[`.
    Open,
    /// After a conditional operator: `?`, `:`, `&&`, `||`, `??`.
    Cond,
    /// After `=>`.
    Arrow,
    /// After an operand: identifier, literal, `)`, `]`, an expression's `}`.
    Operand,
    /// After `.` or `?.`: the next word is a property name.
    Dot,
}

impl Prev {
    pub(super) fn expr_allowed(self) -> bool {
        !matches!(self, Self::Operand | Self::Dot)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum BraceKind {
    Block,
    ArrowBody,
    Object,
    TemplateExpr,
    JsxChild,
    JsxAttr,
}

#[derive(Debug, Clone)]
pub(super) struct JsxElement {
    /// Tag name span; empty at the `<` for fragments.
    pub(super) name: Span,
    pub(super) kind: JsxParentKind,
    /// Index of this root's speculation checkpoint; `None` for nested elements.
    pub(super) checkpoint: Option<usize>,
    /// Inside a `{…}` container, an attribute value or a conditional expression.
    pub(super) dynamic: bool,
    /// Children are in an SVG context.
    pub(super) svg_children: bool,
    /// Has a child other than style blocks (text, element or container).
    pub(super) has_content: bool,
    /// Indices of style blocks that are direct children.
    pub(super) styles: Vec<usize>,
}

#[derive(Debug, Clone)]
pub(super) enum Frame {
    Paren { control: bool, cond: bool },
    Bracket { cond: bool },
    Brace(BraceKind),
    Template { start: usize },
    JsxTag(JsxElement),
    JsxChildren(JsxElement),
}

impl Frame {
    fn is_js(&self) -> bool {
        matches!(
            self,
            Self::Paren { .. } | Self::Bracket { .. } | Self::Brace(_)
        )
    }
}

struct Checkpoint {
    pos: usize,
    frames: usize,
    blocks: usize,
    diagnostics: usize,
    prev: Prev,
    newline: bool,
}

pub(super) enum Stop {
    Eof,
    /// The innermost JSX speculation was wrong.
    Fail,
}

pub(super) type Step = Result<(), Stop>;

pub(super) struct Lexer<'s> {
    pub(super) src: &'s str,
    pub(super) bytes: &'s [u8],
    pub(super) pos: usize,
    pub(super) kind: FileKind,
    pub(super) frames: Vec<Frame>,
    prev: Prev,
    /// A line terminator separates the previous token from the current position.
    newline: bool,
    /// The previous token was `if`/`while`/`for`/`with`/`switch`/`catch`.
    control: bool,
    /// The previous token was a lone `>` (closing type arguments before a body `{`).
    gt: bool,
    checkpoints: Vec<Checkpoint>,
    /// `<` positions proven not to start JSX.
    not_jsx: Vec<usize>,
    pub(super) blocks: Vec<StyleBlock>,
    pub(super) diagnostics: Vec<Diagnostic>,
}

impl<'s> Lexer<'s> {
    pub(super) fn new(src: &'s str, kind: FileKind) -> Self {
        Self {
            src,
            bytes: src.as_bytes(),
            pos: 0,
            kind,
            frames: Vec::new(),
            prev: Prev::Start,
            newline: true,
            control: false,
            gt: false,
            checkpoints: Vec::new(),
            not_jsx: Vec::new(),
            blocks: Vec::new(),
            diagnostics: Vec::new(),
        }
    }

    pub(super) fn run(mut self) -> (Vec<StyleBlock>, Vec<Diagnostic>) {
        loop {
            let step = match self.frames.last() {
                Some(Frame::Template { .. }) => self.step_template(),
                Some(Frame::JsxTag(_)) => self.step_jsx_tag(),
                Some(Frame::JsxChildren(_)) => self.step_jsx_children(),
                _ => self.step_js(),
            };
            match step {
                Ok(()) => {}
                Err(Stop::Fail) => self.rewind(),
                Err(Stop::Eof) => break,
            }
        }
        self.report_unterminated_template();
        (self.blocks, self.diagnostics)
    }

    // ----- cursor helpers -----

    pub(super) fn cur(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    pub(super) fn peek(&self, ahead: usize) -> Option<u8> {
        self.bytes.get(self.pos + ahead).copied()
    }

    pub(super) fn eat(&mut self, byte: u8) -> bool {
        let matched = self.cur() == Some(byte);
        if matched {
            self.pos += 1;
        }
        matched
    }

    fn starts_with(&self, text: &str) -> bool {
        self.bytes[self.pos..].starts_with(text.as_bytes())
    }

    /// Records the class of the token just consumed.
    pub(super) fn set(&mut self, prev: Prev) {
        self.prev = prev;
        self.newline = false;
        self.control = false;
        self.gt = false;
    }

    // ----- speculation -----

    pub(super) fn speculating(&self) -> bool {
        !self.checkpoints.is_empty()
    }

    /// Fails the speculation, or skips one character when there is none to fail.
    pub(super) fn fail_or_skip(&mut self) -> Step {
        if self.speculating() {
            return Err(Stop::Fail);
        }
        self.pos += char_at(self.src, self.pos).map_or(1, char::len_utf8);
        Ok(())
    }

    pub(super) fn push_checkpoint(&mut self, at: usize) -> usize {
        self.checkpoints.push(Checkpoint {
            pos: at,
            frames: self.frames.len(),
            blocks: self.blocks.len(),
            diagnostics: self.diagnostics.len(),
            prev: self.prev,
            newline: self.newline,
        });
        self.checkpoints.len() - 1
    }

    pub(super) fn pop_checkpoint(&mut self, index: usize) {
        self.checkpoints.truncate(index);
    }

    fn rewind(&mut self) {
        let checkpoint = self
            .checkpoints
            .pop()
            .expect("a failure always has a checkpoint");
        self.pos = checkpoint.pos;
        self.frames.truncate(checkpoint.frames);
        self.blocks.truncate(checkpoint.blocks);
        self.diagnostics.truncate(checkpoint.diagnostics);
        self.prev = checkpoint.prev;
        self.newline = checkpoint.newline;
        self.control = false;
        self.gt = false;
        self.not_jsx.push(checkpoint.pos);
    }

    pub(super) fn is_not_jsx(&self, at: usize) -> bool {
        self.not_jsx.contains(&at)
    }

    // ----- context queries -----

    /// A conditional operator precedes the current position, possibly through `(`/`[`.
    pub(super) fn cond_context(&self) -> bool {
        match self.prev {
            Prev::Cond => true,
            Prev::Open => matches!(
                self.frames.last(),
                Some(Frame::Paren { cond: true, .. } | Frame::Bracket { cond: true })
            ),
            _ => false,
        }
    }

    pub(super) fn inside_jsx(&self) -> bool {
        self.frames
            .iter()
            .any(|frame| matches!(frame, Frame::JsxTag(_) | Frame::JsxChildren(_)))
    }

    pub(super) fn enclosing_svg(&self) -> bool {
        self.frames
            .iter()
            .rev()
            .find_map(|frame| match frame {
                Frame::JsxTag(element) | Frame::JsxChildren(element) => Some(element.svg_children),
                _ => None,
            })
            .unwrap_or(false)
    }

    // ----- trivia -----

    /// Skips whitespace and comments, noting line terminators.
    pub(super) fn skip_trivia(&mut self) {
        while let Some(byte) = self.cur() {
            match byte {
                b' ' | b'\t' | 0x0B | 0x0C => self.pos += 1,
                b'\n' | b'\r' => {
                    self.pos += 1;
                    self.newline = true;
                }
                b'/' if self.peek(1) == Some(b'/') => self.skip_line_comment(),
                b'/' if self.peek(1) == Some(b'*') => self.skip_block_comment(),
                0x80.. => match char_at(self.src, self.pos) {
                    Some(ch @ ('\u{2028}' | '\u{2029}')) => {
                        self.pos += ch.len_utf8();
                        self.newline = true;
                    }
                    Some(ch) if is_js_whitespace(ch) => self.pos += ch.len_utf8(),
                    _ => return,
                },
                _ => return,
            }
        }
    }

    fn skip_line_comment(&mut self) {
        while let Some(byte) = self.cur() {
            if matches!(byte, b'\n' | b'\r') {
                return;
            }
            self.pos += 1;
        }
    }

    fn skip_block_comment(&mut self) {
        let start = self.pos;
        self.pos += 2;
        match self.src[self.pos..].find("*/") {
            Some(offset) => {
                let end = self.pos + offset + 2;
                if self.src[start..end].contains(['\n', '\r', '\u{2028}', '\u{2029}']) {
                    self.newline = true;
                }
                self.pos = end;
            }
            None => {
                self.report_swallowed(start, "block comment");
                self.pos = self.bytes.len();
            }
        }
    }

    // ----- atomic tokens -----

    pub(super) fn skip_string(&mut self, quote: u8) {
        self.pos += 1;
        while let Some(byte) = self.cur() {
            match byte {
                b'\\' => {
                    self.pos += if self.peek(1) == Some(b'\r') && self.peek(2) == Some(b'\n') {
                        3
                    } else {
                        2
                    };
                }
                b'\n' | b'\r' => return,
                _ if byte == quote => {
                    self.pos += 1;
                    return;
                }
                _ => self.pos += 1,
            }
        }
        self.pos = self.pos.min(self.bytes.len());
    }

    fn skip_regex(&mut self) {
        self.pos += 1;
        let mut class = false;
        while let Some(byte) = self.cur() {
            match byte {
                b'\\' => self.pos += 2,
                b'[' => {
                    class = true;
                    self.pos += 1;
                }
                b']' => {
                    class = false;
                    self.pos += 1;
                }
                b'/' if !class => {
                    self.pos += 1;
                    self.skip_ident_chars();
                    return;
                }
                b'\n' | b'\r' => return,
                _ => self.pos += 1,
            }
        }
        self.pos = self.pos.min(self.bytes.len());
    }

    fn skip_number(&mut self) {
        let start = self.pos;
        while let Some(byte) = self.cur() {
            let exponent_sign = matches!(byte, b'+' | b'-')
                && matches!(self.bytes[self.pos - 1], b'e' | b'E')
                && !matches!(self.bytes.get(start + 1), Some(b'x' | b'X'));
            if byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.') || exponent_sign {
                self.pos += 1;
            } else {
                return;
            }
        }
    }

    /// Skips identifier characters, stopping at non-ASCII whitespace.
    pub(super) fn skip_ident_chars(&mut self) {
        while let Some(byte) = self.cur() {
            if byte < 0x80 {
                if !is_ident_part(byte) {
                    return;
                }
                self.pos += 1;
            } else {
                match char_at(self.src, self.pos) {
                    Some(ch) if !is_js_whitespace(ch) => self.pos += ch.len_utf8(),
                    _ => return,
                }
            }
        }
    }

    // ----- JS mode -----

    fn step_js(&mut self) -> Step {
        self.skip_trivia();
        let Some(byte) = self.cur() else {
            return Err(Stop::Eof);
        };
        match byte {
            b'\'' | b'"' => {
                self.skip_string(byte);
                self.set(Prev::Operand);
            }
            b'`' => {
                self.frames.push(Frame::Template { start: self.pos });
                self.pos += 1;
            }
            b'/' => {
                if self.prev.expr_allowed() {
                    self.skip_regex();
                    self.set(Prev::Operand);
                } else {
                    self.pos += 1;
                    self.eat(b'=');
                    self.set(Prev::Expr);
                }
            }
            b'<' => return self.js_less_than(),
            b'(' => {
                let frame = Frame::Paren {
                    control: self.control,
                    cond: self.cond_context(),
                };
                self.frames.push(frame);
                self.pos += 1;
                self.set(Prev::Open);
            }
            b'[' => {
                self.frames.push(Frame::Bracket {
                    cond: self.cond_context(),
                });
                self.pos += 1;
                self.set(Prev::Open);
            }
            b'{' => self.open_brace(),
            b')' | b']' | b'}' => self.close_js(byte),
            b'.' => {
                if self.peek(1).is_some_and(|next| next.is_ascii_digit()) {
                    self.skip_number();
                    self.set(Prev::Operand);
                } else if self.starts_with("...") {
                    self.pos += 3;
                    self.set(Prev::Expr);
                } else {
                    self.pos += 1;
                    self.set(Prev::Dot);
                }
            }
            b'?' => {
                if self.peek(1) == Some(b'.') && !self.peek(2).is_some_and(|b| b.is_ascii_digit()) {
                    self.pos += 2;
                    self.set(Prev::Dot);
                } else if self.peek(1) == Some(b'?') {
                    self.pos += 2;
                    let prev = if self.eat(b'=') {
                        Prev::Expr
                    } else {
                        Prev::Cond
                    };
                    self.set(prev);
                } else {
                    self.pos += 1;
                    self.set(Prev::Cond);
                }
            }
            b':' => {
                self.pos += 1;
                self.set(Prev::Cond);
            }
            b';' => {
                self.pos += 1;
                self.set(Prev::Start);
            }
            b'=' => {
                if self.peek(1) == Some(b'>') {
                    self.pos += 2;
                    self.set(Prev::Arrow);
                } else {
                    self.pos += 1;
                    self.eat(b'=');
                    self.eat(b'=');
                    self.set(Prev::Expr);
                }
            }
            b'&' | b'|' => {
                if self.peek(1) == Some(byte) {
                    self.pos += 2;
                    let prev = if self.eat(b'=') {
                        Prev::Expr
                    } else {
                        Prev::Cond
                    };
                    self.set(prev);
                } else {
                    self.pos += 1;
                    self.eat(b'=');
                    self.set(Prev::Expr);
                }
            }
            b'+' | b'-' => {
                if self.peek(1) == Some(byte) {
                    self.pos += 2;
                    // Postfix `x++` keeps the operand; prefix `++x` expects one.
                    let prev = if self.prev == Prev::Operand {
                        Prev::Operand
                    } else {
                        Prev::Expr
                    };
                    self.set(prev);
                } else {
                    self.pos += 1;
                    self.eat(b'=');
                    self.set(Prev::Expr);
                }
            }
            b'!' => {
                // TS non-null assertion `x!` keeps the operand.
                if self.prev == Prev::Operand && self.peek(1) != Some(b'=') {
                    self.pos += 1;
                    self.set(Prev::Operand);
                } else {
                    self.pos += 1;
                    self.eat(b'=');
                    self.eat(b'=');
                    self.set(Prev::Expr);
                }
            }
            b'>' => {
                self.pos += 1;
                let lone = !matches!(self.cur(), Some(b'>' | b'='));
                while matches!(self.cur(), Some(b'>' | b'=')) {
                    self.pos += 1;
                }
                self.set(Prev::Expr);
                self.gt = lone;
            }
            b'#' => {
                self.pos += 1;
                if self.pos == 1 && self.cur() == Some(b'!') {
                    self.skip_line_comment();
                    self.set(Prev::Start);
                } else {
                    self.skip_ident_chars();
                    self.set(Prev::Operand);
                }
            }
            b'0'..=b'9' => {
                self.skip_number();
                self.set(Prev::Operand);
            }
            _ if is_ident_start(byte) => self.word(),
            _ => {
                self.pos += char_at(self.src, self.pos).map_or(1, char::len_utf8);
                self.set(Prev::Expr);
            }
        }
        Ok(())
    }

    fn word(&mut self) {
        let start = self.pos;
        self.skip_ident_chars();
        if self.pos == start {
            // A lone `\` or a non-identifier character.
            self.pos += char_at(self.src, self.pos).map_or(1, char::len_utf8);
            self.set(Prev::Expr);
            return;
        }
        if self.prev == Prev::Dot {
            self.set(Prev::Operand);
            return;
        }
        let after_for = self.control;
        match &self.src[start..self.pos] {
            // `void` is left out: in TS it is mostly a type (`() => void`), an operand.
            "return" | "typeof" | "instanceof" | "in" | "of" | "new" | "delete" | "throw"
            | "case" | "yield" | "extends" | "default" | "keyof" | "as" | "satisfies"
            | "import" => self.set(Prev::Expr),
            "await" => {
                self.set(Prev::Expr);
                self.control = after_for; // `for await (`
            }
            // `const` also ends `as const`.
            "else" | "do" | "try" | "finally" | "export" | "const" | "let" | "var" => {
                self.set(Prev::Start);
            }
            "if" | "while" | "for" | "with" | "switch" | "catch" => {
                self.set(Prev::Expr);
                self.control = true;
            }
            _ => self.set(Prev::Operand),
        }
    }

    fn open_brace(&mut self) {
        let kind = match self.prev {
            Prev::Arrow => BraceKind::ArrowBody,
            Prev::Start | Prev::Operand | Prev::Dot => BraceKind::Block,
            _ if self.gt => BraceKind::Block,
            _ => BraceKind::Object,
        };
        self.frames.push(Frame::Brace(kind));
        self.pos += 1;
        self.set(if kind == BraceKind::Object {
            Prev::Expr
        } else {
            Prev::Start
        });
    }

    /// Handles `)`, `]` and `}` in JS mode. A closer that does not match the innermost
    /// frame closes the nearest matching JS frame, or is ignored.
    fn close_js(&mut self, closer: u8) {
        self.pos += 1;
        let matches = |frame: &Frame| match closer {
            b')' => matches!(frame, Frame::Paren { .. }),
            b']' => matches!(frame, Frame::Bracket { .. }),
            _ => matches!(frame, Frame::Brace(_)),
        };
        let target = self
            .frames
            .iter()
            .rposition(|frame| matches(frame) || !frame.is_js())
            .filter(|&index| matches(&self.frames[index]));
        let Some(index) = target else {
            self.set(if closer == b'}' {
                Prev::Start
            } else {
                Prev::Operand
            });
            return;
        };
        self.frames.truncate(index + 1);
        match self.frames.pop() {
            Some(Frame::Paren { control: true, .. }) => self.set(Prev::Start),
            Some(Frame::Brace(kind)) => match kind {
                BraceKind::Block => self.set(Prev::Start),
                BraceKind::ArrowBody | BraceKind::Object => self.set(Prev::Operand),
                // Back in template, JSX children or JSX tag mode.
                BraceKind::TemplateExpr | BraceKind::JsxChild | BraceKind::JsxAttr => {
                    self.set(Prev::Operand);
                }
            },
            _ => self.set(Prev::Operand),
        }
    }

    fn js_less_than(&mut self) -> Step {
        let at = self.pos;
        if is_style_open(self.bytes, at) {
            let top_level = self.frames.is_empty();
            // A line that ends in an operand or in closing type arguments (`satisfies
            // Props<T>`) has ended its statement for a `<style` on the next line.
            let ended = self.newline && (self.prev == Prev::Operand || self.gt);
            let position = if top_level && (self.prev == Prev::Start || ended) {
                Some(BlockPosition::TopLevel)
            } else if self.prev.expr_allowed() {
                Some(BlockPosition::Expression {
                    statement: self.prev == Prev::Start,
                    attribute: false,
                })
            } else {
                None
            };
            match position {
                Some(position) => {
                    if self.style_block(at, position).is_some() {
                        return Ok(());
                    }
                }
                None => self.report_ambiguous_style(at),
            }
        }
        if self.prev.expr_allowed() && !self.is_not_jsx(at) && self.jsx_root_ahead(at) {
            return self.open_root(at, false);
        }
        self.pos += 1;
        self.eat(b'<');
        self.eat(b'=');
        self.set(Prev::Expr);
        Ok(())
    }

    /// `<style` that reads as a comparison, while a `</style>` follows before any other
    /// `<style`: probably a block the author placed right after an expression.
    fn report_ambiguous_style(&mut self, at: usize) {
        if self.kind != FileKind::Stsx {
            return;
        }
        let rest = &self.src[at + 1..];
        let Some(close) = rest.find("</style") else {
            return;
        };
        if rest[..close].contains("<style") {
            return;
        }
        let span = Span::from_usize(at, at + 6);
        self.diagnostics.push(
            Diagnostic::new(
                Code::ScannerAmbiguity,
                span,
                "`<style` follows an expression, so it is read as a `<` comparison, not a style block",
            )
            .with_help(
                "If this is a style block, start it on its own line at the top level, or end the previous statement with `;`.",
            ),
        );
    }

    /// An unterminated template literal or block comment that contains `<style`: the
    /// blocks after it were not recognised.
    pub(super) fn report_swallowed(&mut self, start: usize, what: &str) {
        if self.kind != FileKind::Stsx || !self.src[start..].contains("<style") {
            return;
        }
        let span = Span::from_usize(start, start + 1);
        self.diagnostics.push(
            Diagnostic::new(
                Code::ScannerAmbiguity,
                span,
                format!(
                    "unterminated {what}: `<style>` blocks after this point are not recognised"
                ),
            )
            .with_severity(Severity::Error)
            .with_help(format!("Close the {what}.")),
        );
    }

    fn report_unterminated_template(&mut self) {
        let start = self.frames.iter().find_map(|frame| match frame {
            Frame::Template { start } => Some(*start),
            _ => None,
        });
        if let Some(start) = start {
            self.report_swallowed(start, "template literal");
        }
    }

    // ----- template literals -----

    fn step_template(&mut self) -> Step {
        while let Some(byte) = self.cur() {
            match byte {
                b'\\' => self.pos += 2,
                b'`' => {
                    self.pos += 1;
                    self.frames.pop();
                    self.set(Prev::Operand);
                    return Ok(());
                }
                b'$' if self.peek(1) == Some(b'{') => {
                    self.pos += 2;
                    self.frames.push(Frame::Brace(BraceKind::TemplateExpr));
                    self.set(Prev::Open);
                    return Ok(());
                }
                _ => self.pos += 1,
            }
        }
        self.pos = self.bytes.len();
        Err(Stop::Eof)
    }
}
