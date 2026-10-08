//! Node bindings (napi-rs) for the Lumen compiler. See spec doc-1 §5.5.
//!
//! JavaScript works in UTF-16 code units, so every offset crossing this boundary is a
//! UTF-16 offset, and `masked` is the UTF-16 masked text (offset-identical to the source
//! string the caller passed in).

use lumen_compiler::Utf16Index;
use lumen_compiler::scanner::{self, AttributeValue, JsxParentKind, Placement};
use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;

/// A half-open `start..end` range in UTF-16 code units.
#[napi(object)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

#[napi(string_enum = "kebab-case")]
pub enum FileKind {
    Stsx,
    Tsx,
    Script,
}

#[napi(string_enum = "kebab-case")]
pub enum PlacementKind {
    /// Module top level: the file scope.
    TopLevel,
    /// A child of a JSX element or fragment: the component scope.
    Jsx,
    /// An expression position (always an error).
    Expression,
}

#[napi(string_enum = "kebab-case")]
pub enum ParentKind {
    Intrinsic,
    Fragment,
    Component,
}

#[napi(object)]
pub struct JsxParent {
    pub kind: ParentKind,
    /// Empty for fragments.
    pub name: String,
    pub span: Span,
}

#[napi(string_enum = "kebab-case")]
pub enum AttributeValueKind {
    String,
    Expression,
}

#[napi(object)]
pub struct StyleAttribute {
    pub name: String,
    pub span: Span,
    pub value_kind: Option<AttributeValueKind>,
    /// The string contents (without quotes) or the `{…}` expression.
    pub value_span: Option<Span>,
}

#[napi(object)]
pub struct StyleRef {
    /// From the `$` through the last path segment.
    pub span: Span,
    /// `["radius", "lg"]` for `$radius.lg`.
    pub path: Vec<String>,
    /// Offset of the character masked as the closing `;` or `}`.
    pub close: Option<u32>,
}

#[napi(object)]
pub struct StyleBlock {
    pub span: Span,
    pub open_tag: Span,
    pub content: Span,
    pub close_tag: Option<Span>,
    pub placement: PlacementKind,
    /// Set when `placement` is `"jsx"`.
    pub parent: Option<JsxParent>,
    pub global: bool,
    pub svg: bool,
    pub attributes: Vec<StyleAttribute>,
    pub refs: Vec<StyleRef>,
}

#[napi(string_enum = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Hint,
}

#[napi(object)]
pub struct Label {
    pub span: Span,
    pub message: String,
}

#[napi(object)]
pub struct TextEdit {
    pub span: Span,
    pub text: String,
}

#[napi(object)]
pub struct Fix {
    pub message: String,
    pub edits: Vec<TextEdit>,
}

#[napi(object)]
pub struct Diagnostic {
    /// A stable code such as `LUM1004`.
    pub code: String,
    pub severity: Severity,
    pub message: String,
    pub span: Span,
    pub labels: Vec<Label>,
    pub help: Option<String>,
    pub fix: Option<Fix>,
    /// Docs topic, e.g. `diagnostics/LUM1004`.
    pub docs: String,
}

#[napi(object)]
pub struct ScanResult {
    pub kind: FileKind,
    /// The masked TSX, offset-identical to the source in UTF-16 code units.
    pub masked: Utf16String,
    pub blocks: Vec<StyleBlock>,
    pub diagnostics: Vec<Diagnostic>,
}

/// The compiler version, for cache keys.
#[napi]
pub fn version() -> String {
    lumen_compiler::VERSION.to_owned()
}

/// Scans a `.stsx` / `.tsx` source: style blocks, `$` references, masked TSX and
/// scanner diagnostics. The file kind comes from `filename`'s extension.
#[napi]
pub fn scan(source: String, filename: String) -> ScanResult {
    let mut result = scanner::scan(&source, &filename);
    let masked = result.masked_utf16(&source);
    let index = Utf16Index::new(&source);
    if !index.is_identity() {
        result.map_spans(&|offset| index.to_utf16(offset));
    }
    ScanResult {
        kind: match result.kind {
            scanner::FileKind::Stsx => FileKind::Stsx,
            scanner::FileKind::Tsx => FileKind::Tsx,
            scanner::FileKind::Script => FileKind::Script,
        },
        masked: Utf16String::from(masked),
        blocks: result.blocks.into_iter().map(convert_block).collect(),
        diagnostics: result
            .diagnostics
            .into_iter()
            .map(convert_diagnostic)
            .collect(),
    }
}

fn span(span: lumen_compiler::Span) -> Span {
    Span {
        start: span.start,
        end: span.end,
    }
}

fn convert_block(block: scanner::StyleBlock) -> StyleBlock {
    let (placement, parent) = match block.placement {
        Placement::TopLevel => (PlacementKind::TopLevel, None),
        Placement::Expression => (PlacementKind::Expression, None),
        Placement::InJsx { parent } => {
            let kind = match parent.kind {
                JsxParentKind::Intrinsic => ParentKind::Intrinsic,
                JsxParentKind::Fragment => ParentKind::Fragment,
                JsxParentKind::Component => ParentKind::Component,
            };
            (
                PlacementKind::Jsx,
                Some(JsxParent {
                    kind,
                    name: parent.name,
                    span: span(parent.span),
                }),
            )
        }
    };
    StyleBlock {
        span: span(block.span),
        open_tag: span(block.open_tag),
        content: span(block.content),
        close_tag: block.close_tag.map(span),
        placement,
        parent,
        global: block.global,
        svg: block.svg,
        attributes: block
            .attributes
            .into_iter()
            .map(|attribute| {
                let (value_kind, value_span) = match attribute.value {
                    None => (None, None),
                    Some(AttributeValue::String { span: value }) => {
                        (Some(AttributeValueKind::String), Some(span(value)))
                    }
                    Some(AttributeValue::Expression { span: value }) => {
                        (Some(AttributeValueKind::Expression), Some(span(value)))
                    }
                };
                StyleAttribute {
                    name: attribute.name,
                    span: span(attribute.span),
                    value_kind,
                    value_span,
                }
            })
            .collect(),
        refs: block
            .refs
            .into_iter()
            .map(|reference| StyleRef {
                span: span(reference.span),
                path: reference.path,
                close: reference.close,
            })
            .collect(),
    }
}

fn convert_diagnostic(diagnostic: lumen_compiler::Diagnostic) -> Diagnostic {
    Diagnostic {
        code: diagnostic.code.id().to_owned(),
        severity: match diagnostic.severity {
            lumen_compiler::Severity::Error => Severity::Error,
            lumen_compiler::Severity::Warning => Severity::Warning,
            lumen_compiler::Severity::Hint => Severity::Hint,
        },
        docs: diagnostic.docs(),
        message: diagnostic.message,
        span: span(diagnostic.span),
        labels: diagnostic
            .labels
            .into_iter()
            .map(|label| Label {
                span: span(label.span),
                message: label.message,
            })
            .collect(),
        help: diagnostic.help,
        fix: diagnostic.fix.map(|fix| Fix {
            message: fix.message,
            edits: fix
                .edits
                .into_iter()
                .map(|edit| TextEdit {
                    span: span(edit.span),
                    text: edit.text,
                })
                .collect(),
        }),
    }
}
