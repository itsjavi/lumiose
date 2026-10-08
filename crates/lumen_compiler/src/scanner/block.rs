//! Style block recognition: the opening tag and its attributes, the raw-text content up to
//! the first `</style>`, placement and the block-level diagnostics.

use super::chars::{char_at, is_line_terminator};
use super::css_refs;
use super::lexer::{Lexer, Prev};
use super::{AttributeValue, FileKind, JsxParent, Placement, StyleAttribute, StyleBlock};
use crate::diagnostics::{Code, Diagnostic, Fix, TextEdit};
use crate::span::Span;

/// Where the lexer found a `<style` token.
pub(super) enum BlockPosition {
    TopLevel,
    /// An expression position. `statement` is a statement inside a nested scope;
    /// `attribute` is a JSX attribute value.
    Expression {
        statement: bool,
        attribute: bool,
    },
    Jsx {
        parent: JsxParent,
        svg: bool,
        misplaced: Option<Misplaced>,
    },
}

pub(super) enum Misplaced {
    /// The parent is a component element.
    ComponentChild,
    /// Inside a `{…}` container, an attribute value or a conditional.
    Dynamic,
}

/// The lexical shape of a block, before placement is applied.
struct BlockSyntax {
    open_tag: Span,
    open_tag_closed: bool,
    self_closing: bool,
    attributes: Vec<StyleAttribute>,
    /// Characters in the tag that are neither attributes nor whitespace.
    stray: Vec<Span>,
    content: Span,
    close_tag: Option<Span>,
    end: usize,
}

impl BlockSyntax {
    fn parse(src: &str, at: usize) -> Self {
        let bytes = src.as_bytes();
        let mut pos = at + "<style".len();
        let mut attributes = Vec::new();
        let mut stray = Vec::new();
        let (open_end, open_tag_closed, self_closing) = loop {
            pos = skip_tag_trivia(src, pos);
            match bytes.get(pos) {
                None => break (bytes.len(), false, false),
                Some(b'>') => break (pos + 1, true, false),
                Some(b'/') if bytes.get(pos + 1) == Some(&b'>') => break (pos + 2, true, true),
                Some(&byte) if byte.is_ascii_alphabetic() || matches!(byte, b'_' | b'$') => {
                    let (attribute, end) = parse_attribute(src, pos);
                    attributes.push(attribute);
                    pos = end;
                }
                Some(_) => {
                    let len = char_at(src, pos).map_or(1, char::len_utf8);
                    stray.push(Span::from_usize(pos, pos + len));
                    pos += len;
                }
            }
        };
        let open_tag = Span::from_usize(at, open_end);
        if self_closing || !open_tag_closed {
            return Self {
                open_tag,
                open_tag_closed,
                self_closing,
                attributes,
                stray,
                content: Span::from_usize(open_end, open_end),
                close_tag: None,
                end: open_end,
            };
        }
        let (content_end, close_tag, end) = match find_close_tag(src, open_end) {
            Some((start, end)) => (start, Some(Span::from_usize(start, end)), end),
            None => (bytes.len(), None, bytes.len()),
        };
        Self {
            open_tag,
            open_tag_closed,
            self_closing,
            attributes,
            stray,
            content: Span::from_usize(open_end, content_end),
            close_tag,
            end,
        }
    }

    /// In a `.tsx` file, a `<style>` element whose children are JSX (`{css}` or nothing)
    /// is ordinary TSX; anything else is raw CSS.
    fn is_raw_css(&self, src: &str) -> bool {
        let content = self.content.source_text(src).trim();
        !self.self_closing && !content.is_empty() && !content.starts_with('{')
    }
}

/// Whitespace and JS comments inside the opening tag.
fn skip_tag_trivia(src: &str, mut pos: usize) -> usize {
    let bytes = src.as_bytes();
    loop {
        match bytes.get(pos) {
            Some(byte) if byte.is_ascii_whitespace() => pos += 1,
            Some(b'/') if bytes.get(pos + 1) == Some(&b'*') => {
                pos = src[pos + 2..]
                    .find("*/")
                    .map_or(bytes.len(), |offset| pos + 2 + offset + 2);
            }
            Some(b'/') if bytes.get(pos + 1) == Some(&b'/') => {
                pos = src[pos..]
                    .find(['\n', '\r'])
                    .map_or(bytes.len(), |offset| pos + offset);
            }
            _ => return pos,
        }
    }
}

fn parse_attribute(src: &str, start: usize) -> (StyleAttribute, usize) {
    let bytes = src.as_bytes();
    let mut pos = start;
    while bytes.get(pos).is_some_and(|&byte| {
        byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$' | b'-' | b':')
    }) {
        pos += 1;
    }
    let name = src[start..pos].to_owned();
    let after_name = pos;
    pos = skip_tag_trivia(src, pos);
    if bytes.get(pos) != Some(&b'=') {
        let attribute = StyleAttribute {
            name,
            span: Span::from_usize(start, after_name),
            value: None,
        };
        return (attribute, after_name);
    }
    pos = skip_tag_trivia(src, pos + 1);
    let (value, end) = match bytes.get(pos) {
        Some(&quote @ (b'"' | b'\'')) => {
            let close = bytes[pos + 1..].iter().position(|&byte| byte == quote);
            let inner_end = close.map_or(bytes.len(), |offset| pos + 1 + offset);
            let span = Span::from_usize(pos + 1, inner_end);
            (
                Some(AttributeValue::String { span }),
                (inner_end + 1).min(bytes.len()),
            )
        }
        Some(b'{') => {
            let end = skip_braces(src, pos);
            (
                Some(AttributeValue::Expression {
                    span: Span::from_usize(pos, end),
                }),
                end,
            )
        }
        _ => (None, pos),
    };
    (
        StyleAttribute {
            name,
            span: Span::from_usize(start, end),
            value,
        },
        end,
    )
}

/// Skips a balanced `{…}` attribute expression, honouring strings and template literals.
fn skip_braces(src: &str, start: usize) -> usize {
    let bytes = src.as_bytes();
    let mut depth = 0usize;
    let mut pos = start;
    while let Some(&byte) = bytes.get(pos) {
        match byte {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return pos + 1;
                }
            }
            b'"' | b'\'' | b'`' => {
                pos += 1;
                while let Some(&inner) = bytes.get(pos) {
                    if inner == b'\\' {
                        pos += 1;
                    } else if inner == byte {
                        break;
                    }
                    pos += 1;
                }
            }
            _ => {}
        }
        pos += 1;
    }
    bytes.len()
}

/// The first `</style` followed by optional whitespace and `>`.
fn find_close_tag(src: &str, from: usize) -> Option<(usize, usize)> {
    let bytes = src.as_bytes();
    let mut search = from;
    while let Some(offset) = src[search..].find("</style") {
        let start = search + offset;
        let mut end = start + "</style".len();
        while bytes.get(end).is_some_and(u8::is_ascii_whitespace) {
            end += 1;
        }
        if bytes.get(end) == Some(&b'>') {
            return Some((start, end + 1));
        }
        search = start + 1;
    }
    None
}

impl Lexer<'_> {
    /// Recognises a block at `at` (a `<style` token). Returns `None` in a `.tsx` file when
    /// the element holds JSX rather than raw CSS; it is then scanned as an ordinary element.
    pub(super) fn style_block(&mut self, at: usize, position: BlockPosition) -> Option<usize> {
        let syntax = BlockSyntax::parse(self.src, at);
        if self.kind == FileKind::Tsx && !syntax.is_raw_css(self.src) {
            return None;
        }
        let svg = matches!(position, BlockPosition::Jsx { svg: true, .. });
        let attribute_value = matches!(
            position,
            BlockPosition::Expression {
                attribute: true,
                ..
            }
        );
        let mut diagnostics = Vec::new();

        if self.kind == FileKind::Tsx {
            diagnostics.push(
                Diagnostic::new(Code::RawCssInTsx, syntax.open_tag, "raw CSS in a `.tsx` file")
                    .with_help("Rename the file to `.stsx`: raw-CSS `<style>` blocks are only valid in `.stsx` files."),
            );
        }
        if !syntax.open_tag_closed || (!syntax.self_closing && syntax.close_tag.is_none()) {
            diagnostics.push(
                Diagnostic::new(Code::UnclosedStyle, syntax.open_tag, "unclosed `<style>` block")
                    .with_help("Add `</style>` after the CSS. Until then the block runs to the end of the file."),
            );
        }
        for span in &syntax.stray {
            diagnostics.push(Diagnostic::new(
                Code::UnknownStyleAttribute,
                *span,
                "unexpected character in the `<style>` tag",
            ));
        }
        let global = self.check_attributes(&syntax, svg, &mut diagnostics);
        diagnostics.extend(placement_diagnostic(&position, syntax.open_tag));

        let (placement, masked_refs) = match position {
            BlockPosition::TopLevel => (Placement::TopLevel, true),
            BlockPosition::Jsx { parent, .. } => (Placement::InJsx { parent }, !svg),
            BlockPosition::Expression { .. } => (Placement::Expression, false),
        };
        let mut refs = if svg {
            Vec::new()
        } else {
            css_refs::find(self.src, syntax.content)
        };
        if masked_refs {
            for reference in &mut refs {
                reference.close = self.ref_close(reference.span.end as usize);
            }
        }

        self.blocks.push(StyleBlock {
            span: Span::from_usize(at, syntax.end),
            open_tag: syntax.open_tag,
            content: syntax.content,
            close_tag: syntax.close_tag,
            placement,
            global,
            svg,
            attributes: syntax.attributes,
            refs,
            attribute_value,
        });
        self.diagnostics.extend(diagnostics);
        self.pos = syntax.end;
        match self.blocks.last().map(|block| &block.placement) {
            Some(Placement::TopLevel) => self.set(Prev::Start),
            Some(Placement::Expression) => self.set(Prev::Operand),
            _ => {}
        }
        Some(self.blocks.len() - 1)
    }

    /// Validates attributes (`LUM1005`) and returns the `global` flag.
    fn check_attributes(
        &self,
        syntax: &BlockSyntax,
        svg: bool,
        diagnostics: &mut Vec<Diagnostic>,
    ) -> bool {
        let mut global = false;
        for attribute in &syntax.attributes {
            if svg {
                // Native SVG CSS keeps its attributes (`type`, `media`), but they must be static.
                if let Some(AttributeValue::Expression { span }) = attribute.value {
                    diagnostics.push(
                        Diagnostic::new(
                            Code::UnknownStyleAttribute,
                            span,
                            "attributes of an SVG `<style>` must be static",
                        )
                        .with_help("Use a string value."),
                    );
                }
                continue;
            }
            let removal = Fix {
                message: format!("Remove `{}`", attribute.name),
                edits: vec![TextEdit {
                    span: self.attribute_removal_span(attribute.span),
                    text: String::new(),
                }],
            };
            if attribute.name == "global" {
                if attribute.value.is_none() {
                    global = true;
                } else {
                    let fix = Fix {
                        message: "Write `global` without a value".to_owned(),
                        edits: vec![TextEdit {
                            span: attribute.span,
                            text: "global".to_owned(),
                        }],
                    };
                    diagnostics.push(
                        Diagnostic::new(
                            Code::UnknownStyleAttribute,
                            attribute.span,
                            "`global` takes no value",
                        )
                        .with_fix(fix),
                    );
                }
                continue;
            }
            let help = match attribute.name.as_str() {
                "lang" => {
                    "Blocks are plain CSS. Import `.scss` files instead; `$` is reserved for constant references."
                }
                "media" => "Wrap the rules in an `@media` block inside the `<style>` instead.",
                _ => "The only allowed attribute is `global`.",
            };
            diagnostics.push(
                Diagnostic::new(
                    Code::UnknownStyleAttribute,
                    attribute.span,
                    format!("unknown `<style>` attribute `{}`", attribute.name),
                )
                .with_help(help)
                .with_fix(removal),
            );
        }
        global
    }

    /// The attribute plus the whitespace before it.
    fn attribute_removal_span(&self, span: Span) -> Span {
        let mut start = span.start as usize;
        while start > 0 && self.bytes[start - 1].is_ascii_whitespace() {
            start -= 1;
        }
        Span::from_usize(start, span.end as usize)
    }

    /// The first character after a reference that is not a line terminator.
    fn ref_close(&self, from: usize) -> Option<u32> {
        self.src[from..]
            .char_indices()
            .find(|&(_, ch)| !is_line_terminator(ch))
            .map(|(offset, _)| crate::span::to_u32(from + offset))
    }
}

fn placement_diagnostic(position: &BlockPosition, span: Span) -> Option<Diagnostic> {
    let diagnostic = match position {
        BlockPosition::TopLevel | BlockPosition::Jsx { misplaced: None, .. } => return None,
        BlockPosition::Expression { statement: true, .. } => Diagnostic::new(
            Code::MisplacedStyle,
            span,
            "a `<style>` block cannot be a statement inside a function",
        )
        .with_help(
            "Put it in the component's JSX, inside an intrinsic element or fragment, or at the module top level.",
        ),
        BlockPosition::Expression { statement: false, .. } => Diagnostic::new(
            Code::StyleAsRootOrExpression,
            span,
            "a `<style>` block cannot be used as an expression",
        )
        .with_help(
            "A block is not a value. Put it inside an intrinsic element or fragment of the component's JSX.",
        ),
        BlockPosition::Jsx { misplaced: Some(Misplaced::ComponentChild), parent, .. } => {
            Diagnostic::new(
                Code::MisplacedStyle,
                span,
                format!("a `<style>` block cannot be a child of the component element `<{}>`", parent.name),
            )
            .with_label(parent.span, "component element")
            .with_help("Move it into an intrinsic element or fragment.")
        }
        BlockPosition::Jsx { misplaced: Some(Misplaced::Dynamic), .. } => Diagnostic::new(
            Code::MisplacedStyle,
            span,
            "a `<style>` block cannot be inside a `{…}` container, a conditional or a callback",
        )
        .with_help("CSS is static: keep the block in the component's static JSX and use classes for variation."),
    };
    Some(diagnostic)
}
