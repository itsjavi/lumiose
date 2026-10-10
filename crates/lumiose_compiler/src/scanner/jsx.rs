//! JSX modes of the lexer: element tags, children text and closing tags.

use super::block::{BlockPosition, Misplaced};
use super::chars::{is_ident_start, is_style_open};
use super::lexer::{BraceKind, Frame, JsxElement, Lexer, Prev, Step, Stop};
use super::{JsxParent, JsxParentKind};
use crate::diagnostics::{Code, Diagnostic};
use crate::span::Span;

impl<'s> Lexer<'s> {
    /// At an expression-start `<`: does JSX begin here? Applies TypeScript's TSX rule for
    /// generic arrow functions: `<T,>`, `<T = …>` and `<T extends U>` are type parameters.
    pub(super) fn jsx_root_ahead(&self, at: usize) -> bool {
        let mut probe = Lexer::probe(self, at + 1);
        probe.skip_trivia();
        match probe.cur() {
            Some(b'>') => true,
            Some(byte) if is_ident_start(byte) && byte != b'\\' => {
                let mut name = probe.read_ident();
                probe.skip_trivia();
                if name == "const" && probe.cur().is_some_and(is_ident_start) {
                    name = probe.read_ident();
                    probe.skip_trivia();
                }
                if name.is_empty() {
                    return false;
                }
                match probe.cur() {
                    Some(b',' | b'=') => false,
                    Some(b'e') => {
                        let checkpoint = probe.pos;
                        if probe.read_ident() == "extends" {
                            probe.skip_trivia();
                            matches!(probe.cur(), Some(b'=' | b'>' | b'/'))
                        } else {
                            probe.pos = checkpoint;
                            true
                        }
                    }
                    _ => true,
                }
            }
            _ => false,
        }
    }

    /// A lightweight copy of the cursor for lookahead.
    fn probe(lexer: &Lexer<'s>, pos: usize) -> Lexer<'s> {
        let mut probe = Lexer::new(lexer.src, lexer.kind);
        probe.pos = pos;
        probe
    }

    fn read_ident(&mut self) -> &'s str {
        let start = self.pos;
        self.skip_ident_chars();
        &self.src[start..self.pos]
    }

    /// Opens a JSX root element (one not nested in another element's children).
    pub(super) fn open_root(&mut self, at: usize, attribute_value: bool) -> Step {
        let checkpoint = self.push_checkpoint(at);
        let dynamic = attribute_value || self.cond_context() || self.inside_jsx();
        let svg = self.enclosing_svg();
        self.open_element(at, Some(checkpoint), dynamic, svg)
    }

    fn open_element(
        &mut self,
        at: usize,
        checkpoint: Option<usize>,
        dynamic: bool,
        in_svg: bool,
    ) -> Step {
        self.pos = at + 1;
        self.skip_trivia();
        let mut element = JsxElement {
            name: Span::from_usize(at, at),
            kind: JsxParentKind::Fragment,
            checkpoint,
            dynamic,
            svg_children: in_svg,
            has_content: false,
            styles: Vec::new(),
        };
        if self.eat(b'>') {
            self.frames.push(Frame::JsxChildren(element));
            return Ok(());
        }
        let name_start = self.pos;
        self.skip_jsx_name();
        if self.pos == name_start {
            return self.fail_or_skip();
        }
        let name = &self.src[name_start..self.pos];
        element.name = Span::from_usize(name_start, self.pos);
        element.kind = classify(name);
        element.svg_children = match name {
            "svg" => true,
            "foreignObject" => false,
            _ => in_svg,
        };
        self.skip_trivia();
        if self.cur() == Some(b'<') {
            self.skip_type_arguments();
        }
        self.frames.push(Frame::JsxTag(element));
        Ok(())
    }

    /// Identifier characters plus `-`, `:` and `.` (`my-el`, `svg:g`, `ui.Card`).
    fn skip_jsx_name(&mut self) {
        loop {
            self.skip_ident_chars();
            match self.cur() {
                Some(b'-' | b':' | b'.') => self.pos += 1,
                _ => return,
            }
        }
    }

    /// Skips TS type arguments on an element: `<Select<Option> …>`.
    fn skip_type_arguments(&mut self) {
        let mut depth = 0usize;
        while let Some(byte) = self.cur() {
            match byte {
                b'<' => depth += 1,
                b'>' => {
                    depth -= 1;
                    if depth == 0 {
                        self.pos += 1;
                        return;
                    }
                }
                b'=' if self.peek(1) == Some(b'>') => self.pos += 1,
                b'\'' | b'"' => {
                    self.skip_string(byte);
                    continue;
                }
                _ => {}
            }
            self.pos += 1;
        }
    }

    pub(super) fn step_jsx_tag(&mut self) -> Step {
        self.skip_trivia();
        let Some(byte) = self.cur() else {
            return Err(Stop::Eof);
        };
        match byte {
            b'/' if self.peek(1) == Some(b'>') => {
                self.pos += 2;
                let Some(Frame::JsxTag(element)) = self.frames.pop() else {
                    unreachable!("JSX tag mode without a tag frame");
                };
                self.finish_element(element);
            }
            b'>' => {
                self.pos += 1;
                let Some(Frame::JsxTag(element)) = self.frames.pop() else {
                    unreachable!("JSX tag mode without a tag frame");
                };
                self.frames.push(Frame::JsxChildren(element));
            }
            b'{' => {
                self.pos += 1;
                self.frames.push(Frame::Brace(BraceKind::JsxAttr));
                self.set(Prev::Open);
            }
            _ if is_ident_start(byte) => {
                self.skip_jsx_name();
                self.skip_trivia();
                if self.eat(b'=') {
                    self.skip_trivia();
                    return self.attribute_value();
                }
            }
            _ => return self.fail_or_skip(),
        }
        Ok(())
    }

    fn attribute_value(&mut self) -> Step {
        let at = self.pos;
        match self.cur() {
            Some(quote @ (b'"' | b'\'')) => {
                self.pos += 1;
                match self.bytes[self.pos..]
                    .iter()
                    .position(|&byte| byte == quote)
                {
                    Some(offset) => self.pos += offset + 1,
                    None => self.pos = self.bytes.len(),
                }
                Ok(())
            }
            Some(b'{') => {
                self.pos += 1;
                self.frames.push(Frame::Brace(BraceKind::JsxAttr));
                self.set(Prev::Open);
                Ok(())
            }
            Some(b'<') if is_style_open(self.bytes, at) => {
                let position = BlockPosition::Expression {
                    statement: false,
                    attribute: true,
                };
                match self.style_block(at, position) {
                    Some(_) => Ok(()),
                    None => self.open_root(at, true),
                }
            }
            Some(b'<') if !self.is_not_jsx(at) => self.open_root(at, true),
            _ => self.fail_or_skip(),
        }
    }

    pub(super) fn step_jsx_children(&mut self) -> Step {
        let mut text = false;
        loop {
            match self.cur() {
                None => {
                    self.mark_content(text);
                    return Err(Stop::Eof);
                }
                Some(b'{' | b'<') => break,
                // TSX rejects these in text: this is not JSX after all.
                Some(b'>' | b'}') => {
                    self.fail_or_skip()?;
                    text = true;
                }
                Some(byte) => {
                    text |= !byte.is_ascii_whitespace();
                    self.pos += 1;
                }
            }
        }
        self.mark_content(text);
        let at = self.pos;
        if self.eat(b'{') {
            self.mark_content(true);
            self.frames.push(Frame::Brace(BraceKind::JsxChild));
            self.set(Prev::Open);
            return Ok(());
        }
        if self.peek(1) == Some(b'/') {
            return self.closing_tag(at);
        }
        if is_style_open(self.bytes, at) && self.style_child(at) {
            return Ok(());
        }
        self.open_child(at)
    }

    fn mark_content(&mut self, content: bool) {
        if !content {
            return;
        }
        if let Some(Frame::JsxChildren(element)) = self.frames.last_mut() {
            element.has_content = true;
        }
    }

    fn open_child(&mut self, at: usize) -> Step {
        let mut probe = Lexer::probe(self, at + 1);
        probe.skip_trivia();
        let valid = match probe.cur() {
            Some(b'>') => true,
            Some(byte) => is_ident_start(byte) && byte != b'\\',
            None => false,
        };
        if !valid {
            return self.fail_or_skip();
        }
        let Some(Frame::JsxChildren(parent)) = self.frames.last() else {
            unreachable!("JSX children mode without a children frame");
        };
        let (dynamic, svg) = (parent.dynamic, parent.svg_children);
        self.open_element(at, None, dynamic, svg)
    }

    fn style_child(&mut self, at: usize) -> bool {
        let Some(Frame::JsxChildren(parent)) = self.frames.last() else {
            unreachable!("JSX children mode without a children frame");
        };
        let misplaced = if parent.kind == JsxParentKind::Component {
            Some(Misplaced::ComponentChild)
        } else if parent.dynamic {
            Some(Misplaced::Dynamic)
        } else {
            None
        };
        let position = BlockPosition::Jsx {
            parent: JsxParent {
                kind: parent.kind,
                name: parent.name.source_text(self.src).to_owned(),
                span: parent.name,
            },
            svg: parent.svg_children,
            misplaced,
        };
        let Some(index) = self.style_block(at, position) else {
            return false;
        };
        if let Some(Frame::JsxChildren(parent)) = self.frames.last_mut() {
            parent.styles.push(index);
        }
        true
    }

    /// `</name>`: closes the innermost open element of that name in the current JSX tree,
    /// implicitly closing unclosed children. Stray closing tags are ignored (the
    /// TypeScript parser reports them).
    fn closing_tag(&mut self, at: usize) -> Step {
        self.pos = at + 2;
        self.skip_trivia();
        let name_start = self.pos;
        self.skip_jsx_name();
        let name = &self.src[name_start..self.pos];
        self.skip_trivia();
        if !self.eat(b'>') {
            return self.fail_or_skip();
        }
        let mut target = None;
        for (index, frame) in self.frames.iter().enumerate().rev() {
            let Frame::JsxChildren(element) = frame else {
                break;
            };
            if element.name.source_text(self.src) == name {
                target = Some(index);
                break;
            }
            if element.checkpoint.is_some() {
                break;
            }
        }
        if let Some(index) = target {
            while self.frames.len() > index {
                let Some(Frame::JsxChildren(element)) = self.frames.pop() else {
                    unreachable!("only children frames lie above the target");
                };
                self.finish_element(element);
            }
        }
        Ok(())
    }

    fn finish_element(&mut self, element: JsxElement) {
        let Some(checkpoint) = element.checkpoint else {
            self.mark_content(true);
            return;
        };
        self.pop_checkpoint(checkpoint);
        if element.kind == JsxParentKind::Fragment && !element.has_content && !element.dynamic {
            for &index in &element.styles {
                let span = self.blocks[index].open_tag;
                self.diagnostics.push(
                    Diagnostic::new(
                        Code::StyleAsRootOrExpression,
                        span,
                        "a `<style>` block cannot be the only thing a component returns",
                    )
                    .with_help(
                        "Styles apply to the elements around them: put the block inside the element it styles.",
                    ),
                );
            }
        }
        self.set(Prev::Operand);
    }
}

/// TypeScript's rule: lowercase first letter, a dash or a namespace is intrinsic.
fn classify(name: &str) -> JsxParentKind {
    if name.contains('.') {
        JsxParentKind::Component
    } else if name.contains([':', '-']) || name.as_bytes()[0].is_ascii_lowercase() {
        JsxParentKind::Intrinsic
    } else {
        JsxParentKind::Component
    }
}
