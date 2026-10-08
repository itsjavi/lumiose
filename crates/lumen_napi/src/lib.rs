//! Node bindings (napi-rs) for the Lumen compiler. See spec doc-1 §5.5.
//!
//! JavaScript works in UTF-16 code units, so every offset crossing this boundary is a
//! UTF-16 offset, and `masked` is the UTF-16 masked text (offset-identical to the source
//! string the caller passed in).

use std::collections::HashMap;

use lumen_compiler::Utf16Index;
use lumen_compiler::prepare::StyleRefBindingKind;
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

#[napi(string_enum = "lowercase")]
pub enum CompileTarget {
    Client,
    Server,
}

/// `data-l-*` scope tokens computed by the CSS pipeline.
#[napi(object)]
pub struct ScopeTokens {
    /// The file scope token (top-level `<style>` blocks).
    pub file: Option<String>,
    /// Component scope tokens by component name.
    pub components: Option<HashMap<String, String>>,
}

#[napi(object)]
pub struct CompileOptions {
    /// Default `"client"`. `"server"` is not implemented yet (TASK-14) and reports `LUM1002`.
    pub target: Option<CompileTarget>,
    pub scope_tokens: Option<ScopeTokens>,
    /// Default `true`.
    pub source_map: Option<bool>,
    /// Import `<id>?lumen&type=style&lang.css` when the file has style blocks. Default `true`.
    pub style_import: Option<bool>,
}

#[napi(object)]
pub struct ComponentMeta {
    pub name: String,
    pub span: Span,
    pub exported: bool,
    pub is_async: bool,
    /// The `await`s indexed as sites `0..n` by the async rewrite.
    pub await_sites: Vec<Span>,
}

#[napi(string_enum = "kebab-case")]
pub enum StyleRefBindingType {
    Module,
    Local,
    Import,
}

#[napi(object)]
pub struct StyleRefBinding {
    pub name: String,
    pub declaration: Span,
    pub kind: StyleRefBindingType,
    /// `const` and never reassigned (module and local bindings).
    pub constant: bool,
    /// The module specifier, for imports.
    pub source: Option<String>,
    /// The imported name (`"default"`, `"*"` for namespaces), for imports.
    pub imported: Option<String>,
}

#[napi(object)]
pub struct ResolvedStyleRef {
    /// Index of the block in `scan().blocks`.
    pub block: u32,
    pub path: Vec<String>,
    pub span: Span,
    pub binding: Option<StyleRefBinding>,
}

#[napi(object)]
pub struct CompileMeta {
    pub components: Vec<ComponentMeta>,
    pub templates: u32,
    pub delegated_events: Vec<String>,
    pub runtime_helpers: Vec<String>,
    pub style_refs: Vec<ResolvedStyleRef>,
    pub has_styles: bool,
}

#[napi(object)]
pub struct CompileResult {
    /// JavaScript with types stripped; empty when the source could not be parsed.
    pub code: String,
    /// Source map v3 JSON.
    pub map: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub meta: CompileMeta,
}

/// Compiles a `.stsx` / `.tsx` module to JavaScript for the given target. Spans are UTF-16
/// offsets into `source`.
#[napi]
pub fn compile(source: String, filename: String, options: Option<CompileOptions>) -> CompileResult {
    let options = options.map_or_else(lumen_compiler::CompileOptions::default, |o| {
        let defaults = lumen_compiler::CompileOptions::default();
        lumen_compiler::CompileOptions {
            target: match o.target {
                Some(CompileTarget::Server) => lumen_compiler::Target::Server,
                _ => lumen_compiler::Target::Client,
            },
            scope_tokens: o
                .scope_tokens
                .map(|tokens| lumen_compiler::ScopeTokens {
                    file: tokens.file,
                    components: tokens.components.unwrap_or_default().into_iter().collect(),
                })
                .unwrap_or_default(),
            source_map: o.source_map.unwrap_or(defaults.source_map),
            style_import: o.style_import.unwrap_or(defaults.style_import),
        }
    });
    let mut result = lumen_compiler::compile(&source, &filename, &options);
    let index = Utf16Index::new(&source);
    if !index.is_identity() {
        result.map_spans(&|offset| index.to_utf16(offset));
    }
    let meta = result.meta;
    CompileResult {
        code: result.code,
        map: result.map,
        diagnostics: result
            .diagnostics
            .into_iter()
            .map(convert_diagnostic)
            .collect(),
        meta: CompileMeta {
            components: meta
                .components
                .into_iter()
                .map(|c| ComponentMeta {
                    name: c.name,
                    span: span(c.span),
                    exported: c.exported,
                    is_async: c.is_async,
                    await_sites: c.await_sites.into_iter().map(span).collect(),
                })
                .collect(),
            templates: u32::try_from(meta.templates).unwrap_or(u32::MAX),
            delegated_events: meta.delegated_events,
            runtime_helpers: meta.runtime_helpers,
            style_refs: meta
                .style_refs
                .into_iter()
                .map(|r| ResolvedStyleRef {
                    block: r.block,
                    path: r.path,
                    span: span(r.span),
                    binding: r.binding.map(|b| {
                        let (kind, constant, source, imported) = match b.kind {
                            StyleRefBindingKind::Module { constant } => {
                                (StyleRefBindingType::Module, constant, None, None)
                            }
                            StyleRefBindingKind::Local { constant } => {
                                (StyleRefBindingType::Local, constant, None, None)
                            }
                            StyleRefBindingKind::Import { source, imported } => (
                                StyleRefBindingType::Import,
                                false,
                                Some(source),
                                Some(imported),
                            ),
                        };
                        StyleRefBinding {
                            name: b.name,
                            declaration: span(b.declaration),
                            kind,
                            constant,
                            source,
                            imported,
                        }
                    }),
                })
                .collect(),
            has_styles: meta.has_styles,
        },
    }
}
