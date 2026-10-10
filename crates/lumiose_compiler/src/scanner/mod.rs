//! The `.stsx` scanner (spec §4.1): finds raw-CSS `<style>` blocks, classifies their
//! placement, extracts `$name` references and produces the masked TSX.
//!
//! Every tool (compiler, shadow TSX, language server, lint, format) uses this one scanner.
//!
//! **Masking invariant.** The masked text parses as TSX and has the same length and line
//! structure as the source, in UTF-8 bytes ([`ScanResult::masked`]) and in UTF-16 code
//! units ([`ScanResult::masked_utf16`]). A file without blocks masks to itself.

mod block;
mod chars;
mod css_refs;
mod declarations;
mod jsx;
mod lexer;
mod mask;

#[cfg(test)]
mod tests;

use crate::diagnostics::Diagnostic;
use crate::span::Span;
use mask::MaskPlan;

/// How a file is scanned, derived from its extension.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum FileKind {
    /// `.stsx`: TSX plus raw-CSS `<style>` blocks.
    Stsx,
    /// `.tsx` / `.jsx`: plain TSX. Raw CSS in a `<style>` element is `LUM1006`.
    Tsx,
    /// Anything else (`.ts`, `.js`, …): never contains blocks; scanning is the identity.
    Script,
}

impl FileKind {
    /// Classifies a path or module id (a Vite `?query` suffix is ignored).
    pub fn from_path(path: &str) -> Self {
        let path = path.split(['?', '#']).next().unwrap_or(path);
        let extension = path
            .rsplit_once('.')
            .map(|(_, ext)| ext.to_ascii_lowercase());
        match extension.as_deref() {
            Some("stsx") => Self::Stsx,
            Some("tsx" | "jsx") => Self::Tsx,
            _ => Self::Script,
        }
    }
}

/// Where a block sits, which decides its scope and how it is masked.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(tag = "type", rename_all = "camelCase")
)]
pub enum Placement {
    /// A statement at module top level: the file scope. Masked to whitespace with `;ref;`.
    TopLevel,
    /// A child of a JSX element or fragment. Masked to whitespace with `{ref}`.
    InJsx { parent: JsxParent },
    /// An expression position (`return <style>`, `=> <style>`, `{<style>}`): always an
    /// error (`LUM3010`/`LUM3011`). Masked to `null` followed by whitespace (`{null}` as a
    /// JSX attribute value).
    Expression,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum JsxParentKind {
    /// A lowercase, dashed or namespaced tag (`div`, `my-el`, `svg:g`).
    Intrinsic,
    Fragment,
    /// A component element (`Card`, `ui.Card`).
    Component,
}

/// The JSX element that directly contains a block.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct JsxParent {
    pub kind: JsxParentKind,
    /// The tag name as written; empty for fragments.
    pub name: String,
    /// The tag name span; for fragments, the empty span at the `<` of `<>`.
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct StyleAttribute {
    pub name: String,
    /// The whole attribute, `name` through the end of its value.
    pub span: Span,
    pub value: Option<AttributeValue>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(tag = "type", rename_all = "camelCase")
)]
pub enum AttributeValue {
    /// A quoted string; the span excludes the quotes.
    String { span: Span },
    /// A `{…}` expression; the span includes the braces.
    Expression { span: Span },
}

/// A `$name` or `$name.member` reference inside a block's CSS.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct StyleRef {
    /// From the `$` through the last path segment.
    pub span: Span,
    /// The dotted path, e.g. `["radius", "lg"]` for `$radius.lg`.
    pub path: Vec<String>,
    /// The offset of the character masked as the closing `;` or `}`: the first character
    /// after the reference that is not a line terminator. `None` when the reference is not
    /// masked (expression-position blocks) or nothing follows it.
    pub close: Option<u32>,
}

impl StyleRef {
    pub fn dotted(&self) -> String {
        self.path.join(".")
    }

    /// The span of the JS expression (`radius.lg`), without the `$`.
    pub fn expression_span(&self) -> Span {
        Span::new(self.span.start + 1, self.span.end)
    }
}

/// One raw-CSS `<style>` block.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct StyleBlock {
    /// `<style …>` through `</style>` (or the end of the file when unclosed).
    pub span: Span,
    pub open_tag: Span,
    /// The CSS text between the tags.
    pub content: Span,
    /// `None` when the block is unclosed (`LUM1004`) or self-closing.
    pub close_tag: Option<Span>,
    pub placement: Placement,
    pub global: bool,
    /// Inside an `<svg>` subtree: native SVG CSS, emitted verbatim and never extracted.
    /// Its `$` characters are plain CSS, so `refs` is empty.
    pub svg: bool,
    pub attributes: Vec<StyleAttribute>,
    pub refs: Vec<StyleRef>,
    /// An expression block that is a JSX attribute value: masked to `{null}`, since a bare
    /// `null` is not a valid attribute value.
    #[cfg_attr(feature = "serde", serde(skip))]
    pub(crate) attribute_value: bool,
}

/// The scanner output for one file.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct ScanResult {
    pub kind: FileKind,
    pub blocks: Vec<StyleBlock>,
    pub diagnostics: Vec<Diagnostic>,
    #[cfg_attr(feature = "serde", serde(skip))]
    masked: String,
    #[cfg_attr(feature = "serde", serde(skip))]
    mask: MaskPlan,
}

impl ScanResult {
    /// The masked TSX in the UTF-8 offset space (used by the compiler's OXC parse).
    pub fn masked(&self) -> &str {
        &self.masked
    }

    /// The masked TSX as UTF-16 code units, offset-identical to `source` in UTF-16
    /// (used for the shadow TSX that TypeScript reads). `source` must be the scanned text.
    pub fn masked_utf16(&self, source: &str) -> Vec<u16> {
        debug_assert_eq!(
            source.len(),
            self.masked.len(),
            "masked_utf16 needs the scanned source"
        );
        self.mask.render_utf16(source)
    }

    /// True when the masked text equals the source (no blocks).
    pub fn is_identity(&self) -> bool {
        self.blocks.is_empty()
    }

    pub fn has_errors(&self) -> bool {
        self.diagnostics.iter().any(Diagnostic::is_error)
    }

    /// Applies an offset mapping (for example byte → UTF-16) to every public span. The mask
    /// itself stays in byte offsets.
    pub fn map_spans(&mut self, f: &impl Fn(u32) -> u32) {
        for block in &mut self.blocks {
            block.span = block.span.map(f);
            block.open_tag = block.open_tag.map(f);
            block.content = block.content.map(f);
            block.close_tag = block.close_tag.map(|span| span.map(f));
            if let Placement::InJsx { parent } = &mut block.placement {
                parent.span = parent.span.map(f);
            }
            for attribute in &mut block.attributes {
                attribute.span = attribute.span.map(f);
                attribute.value = attribute.value.map(|value| match value {
                    AttributeValue::String { span } => AttributeValue::String { span: span.map(f) },
                    AttributeValue::Expression { span } => {
                        AttributeValue::Expression { span: span.map(f) }
                    }
                });
            }
            for reference in &mut block.refs {
                reference.span = reference.span.map(f);
                reference.close = reference.close.map(f);
            }
        }
        for diagnostic in &mut self.diagnostics {
            diagnostic.map_spans(f);
        }
    }
}

/// Scans `source`, choosing the file kind from `filename`'s extension.
pub fn scan(source: &str, filename: &str) -> ScanResult {
    scan_kind(source, FileKind::from_path(filename))
}

/// Scans `source` as the given file kind.
pub fn scan_kind(source: &str, kind: FileKind) -> ScanResult {
    // Every block and every scanner diagnostic starts at a `<style` token.
    if kind == FileKind::Script || !source.contains("<style") {
        return ScanResult {
            kind,
            blocks: Vec::new(),
            diagnostics: Vec::new(),
            masked: source.to_owned(),
            mask: MaskPlan::default(),
        };
    }
    let (blocks, mut diagnostics) = lexer::Lexer::new(source, kind).run();
    let mask = MaskPlan::new(&blocks);
    let masked = mask.render_utf8(source);
    declarations::check_ref_order(&masked, &blocks, &mut diagnostics);
    diagnostics.sort_by_key(|diagnostic| (diagnostic.span.start, diagnostic.span.end));
    ScanResult {
        kind,
        blocks,
        diagnostics,
        masked,
        mask,
    }
}
