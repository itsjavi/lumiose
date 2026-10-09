//! Node bindings (napi-rs) for the Lumen compiler. See spec doc-1 §5.5.
//!
//! JavaScript works in UTF-16 code units, so every offset crossing this boundary is a
//! UTF-16 offset, and `masked` is the UTF-16 masked text (offset-identical to the source
//! string the caller passed in).

use std::collections::HashMap;

use lumen_compiler::Utf16Index;
use lumen_compiler::prepare::StyleRefBindingKind;
use lumen_compiler::scanner::{self, AttributeValue, JsxParentKind, Placement};
use napi::Either;
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
    /// Docs topic, e.g. `errors/LUM1004` (`lumen docs errors/LUM1004`).
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

/// A module loaded by the host for folding imported `$name` constants.
#[napi(object)]
pub struct HostModule {
    /// The id of the importing module (the compiled file, or another host module).
    pub importer: String,
    /// The import specifier as written.
    pub specifier: String,
    /// Omitted when the module cannot be resolved or read (reported as `LUM3008`).
    pub resolved: Option<ResolvedModule>,
}

#[napi(object)]
pub struct ResolvedModule {
    /// The resolved id (a file path): reported in `cssDeps`, and the importer of its imports.
    pub id: String,
    pub source: String,
}

/// A module the compiler needs to fold an imported constant: resolve `specifier` from
/// `importer`, load it, and compile again with it in `modules`.
#[napi(object)]
pub struct ModuleRequest {
    pub importer: String,
    pub specifier: String,
}

#[napi(object)]
pub struct CompileOptions {
    /// Default `"client"`: `lumen/dom` code; `"server"`: `lumen/server` code.
    pub target: Option<CompileTarget>,
    /// Source maps for the JS and the CSS. Default `true`.
    pub source_map: Option<bool>,
    /// Import `<id>?lumen&type=style&lang.css` when the file has style blocks. Default `true`.
    pub style_import: Option<bool>,
    /// Compile the style blocks into `css`. Default `true`.
    pub emit_css: Option<bool>,
    /// Browserslist queries for CSS nesting lowering and prefixes (`["chrome 100"]`). Default:
    /// modern syntax is kept.
    pub css_targets: Option<Vec<String>>,
    /// Minify `css`. Default `false`.
    pub css_minify: Option<bool>,
    /// The project root: island refs name modules inside it root-relatively (`/src/x.stsx#X`),
    /// and scope tokens hash the root-relative path.
    pub root: Option<String>,
    /// Packages outside `root` (linked workspace packages): island refs and scope tokens name
    /// their modules package-relatively (`@acme/ui/src/Nav.stsx#Nav`), so builds do not depend
    /// on where the package sits on disk. The innermost package containing a module wins.
    pub packages: Option<Vec<PackageRoot>>,
    /// Modules answering earlier `moduleRequests`.
    pub modules: Option<Vec<HostModule>>,
    /// Fill `meta.contract` (execution contracts, for hovers). Default `false`.
    pub contract: Option<bool>,
}

/// A package outside the project root (see `CompileOptions.packages`).
#[napi(object)]
pub struct PackageRoot {
    /// The package name (`@acme/ui`).
    pub name: String,
    /// The package directory (absolute).
    pub dir: String,
}

/// An island call site (`<X client:* />`).
#[napi(object)]
pub struct IslandMeta {
    /// `<module>#<export>`, as passed to the server's `island()`.
    #[napi(js_name = "ref")]
    pub reference: String,
    /// The module that exports the component.
    pub module: String,
    /// The export name (`default` for default exports).
    pub export: String,
    /// `load`, `idle`, `visible`, `media` or `only`.
    pub strategy: String,
    pub span: Span,
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
    /// The folded constant, when it could be folded.
    pub value: Option<Either<String, f64>>,
}

/// The `data-l-*` scope attributes of a file.
#[napi(object)]
pub struct ScopeTokens {
    /// The file scope attribute (top-level `<style>` blocks).
    pub file: Option<String>,
    /// By component name, the scopes of its `<style>` blocks: one per element that contains
    /// blocks, in source order (decision-23).
    pub components: HashMap<String, Vec<SubtreeScope>>,
}

/// The scope of the `<style>` blocks inside one element of a component: the element and every
/// element lexically inside it in that component carry `attribute`.
#[napi(object)]
pub struct SubtreeScope {
    pub attribute: String,
    /// The element (or fragment) that contains the blocks.
    pub span: Span,
}

/// A custom property set in a `style` prop.
#[napi(object)]
pub struct CustomPropertySet {
    /// The name, including `--`.
    pub name: String,
    /// The name as written.
    pub span: Span,
}

/// Custom properties of a file, for a project-wide `LUM3012` check.
#[napi(object)]
pub struct CustomPropertiesMeta {
    /// Set in `style` props (elements and components), in source order.
    pub set: Vec<CustomPropertySet>,
    /// Read through `var()` in the file's CSS, sorted; empty when `css` is `null`.
    pub read: Vec<String>,
}

/// An import of the module (type-only imports are stripped).
#[napi(object)]
pub struct ImportMeta {
    pub specifier: String,
    /// The specifier as written, without its quotes.
    pub span: Span,
    /// `import("…")`.
    pub dynamic: bool,
}

/// How the client runs an expression.
#[napi(string_enum = "lowercase")]
pub enum ContractKind {
    Tracked,
    Untracked,
    Once,
    Deferred,
}

/// Where an expression sits.
#[napi(string_enum = "lowercase")]
pub enum ContractSite {
    Child,
    Attribute,
    Property,
    Class,
    Style,
    Prop,
    Event,
    Ref,
    Spread,
    Await,
}

/// The execution contract of one expression (spec §5.1).
#[napi(object)]
pub struct ContractEntry {
    pub span: Span,
    pub kind: ContractKind,
    pub site: ContractSite,
    /// The component it belongs to.
    pub component: Option<String>,
    /// The runtime helper or mechanism that runs it (`insert`, `setAttr`, `getter`, …).
    pub via: Option<String>,
    /// The reactive reads that make it tracked.
    pub reads: Vec<Span>,
}

#[napi(object)]
pub struct CompileMeta {
    pub components: Vec<ComponentMeta>,
    pub templates: u32,
    pub delegated_events: Vec<String>,
    pub runtime_helpers: Vec<String>,
    pub style_refs: Vec<ResolvedStyleRef>,
    pub has_styles: bool,
    /// The `data-l-*` attributes stamped on the file's and its components' elements.
    pub scope_tokens: ScopeTokens,
    /// Island call sites, in source order.
    pub islands: Vec<IslandMeta>,
    /// Custom properties set in `style` props and read by the file's CSS.
    pub custom_properties: CustomPropertiesMeta,
    /// With `contract: true`: the execution contract of each JSX expression and `await`, by
    /// start offset (entries nest; hovers take the innermost).
    pub contract: Option<Vec<ContractEntry>>,
    /// The module's imports, in source order.
    pub imports: Vec<ImportMeta>,
}

#[napi(object)]
pub struct CompileResult {
    /// JavaScript with types stripped; empty when the source could not be parsed.
    pub code: String,
    /// Source map v3 JSON.
    pub map: Option<String>,
    /// The file's stylesheet; `null` without style blocks, with `emitCss: false`, or while
    /// `moduleRequests` is not empty.
    pub css: Option<String>,
    /// Source map v3 JSON from `css` to the source (UTF-16 columns).
    pub css_map: Option<String>,
    /// Ids of the modules imported constants were folded from.
    pub css_deps: Vec<String>,
    /// Modules needed to fold imported constants; compile again with them in `modules`.
    pub module_requests: Vec<ModuleRequest>,
    pub diagnostics: Vec<Diagnostic>,
    pub meta: CompileMeta,
}

/// Compiles a `.stsx` / `.tsx` module to JavaScript (and its style blocks to CSS) for the given
/// target. Spans are UTF-16 offsets into `source`. Throws on invalid `cssTargets`.
#[napi]
pub fn compile(
    source: String,
    filename: String,
    options: Option<CompileOptions>,
) -> napi::Result<CompileResult> {
    let options = match options {
        None => lumen_compiler::CompileOptions::default(),
        Some(o) => {
            let defaults = lumen_compiler::CompileOptions::default();
            let targets = match o.css_targets {
                Some(queries) if !queries.is_empty() => lumen_css::browserslist_targets(&queries)
                    .map_err(|error| {
                    napi::Error::from_reason(format!("invalid cssTargets: {error}"))
                })?,
                _ => lumen_compiler::CssTargets::default(),
            };
            lumen_compiler::CompileOptions {
                target: match o.target {
                    Some(CompileTarget::Server) => lumen_compiler::Target::Server,
                    _ => lumen_compiler::Target::Client,
                },
                source_map: o.source_map.unwrap_or(defaults.source_map),
                style_import: o.style_import.unwrap_or(defaults.style_import),
                emit_css: o.emit_css.unwrap_or(defaults.emit_css),
                css: lumen_compiler::CssOptions {
                    targets,
                    minify: o.css_minify.unwrap_or(false),
                },
                root: o.root,
                packages: o
                    .packages
                    .unwrap_or_default()
                    .into_iter()
                    .map(|package| lumen_compiler::PackageRoot {
                        name: package.name,
                        dir: package.dir,
                    })
                    .collect(),
                modules: o
                    .modules
                    .unwrap_or_default()
                    .into_iter()
                    .map(|module| lumen_compiler::HostModule {
                        importer: module.importer,
                        specifier: module.specifier,
                        resolved: module
                            .resolved
                            .map(|resolved| lumen_compiler::ResolvedModule {
                                id: resolved.id,
                                source: resolved.source,
                            }),
                    })
                    .collect(),
                contract: o.contract.unwrap_or(defaults.contract),
            }
        }
    };
    let mut result = lumen_compiler::compile(&source, &filename, &options);
    let index = Utf16Index::new(&source);
    if !index.is_identity() {
        result.map_spans(&|offset| index.to_utf16(offset));
    }
    let meta = result.meta;
    Ok(CompileResult {
        code: result.code,
        map: result.map,
        css: result.css,
        css_map: result.css_map,
        css_deps: result.css_deps,
        module_requests: result
            .module_requests
            .into_iter()
            .map(|request| ModuleRequest {
                importer: request.importer,
                specifier: request.specifier,
            })
            .collect(),
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
                    value: r.value.map(|value| match value {
                        lumen_compiler::ConstValue::String(text) => Either::A(text),
                        lumen_compiler::ConstValue::Number(number) => Either::B(number),
                    }),
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
            scope_tokens: ScopeTokens {
                file: meta.scope_tokens.file,
                components: meta
                    .scope_tokens
                    .components
                    .into_iter()
                    .map(|(name, subtrees)| {
                        let subtrees = subtrees
                            .into_iter()
                            .map(|subtree| SubtreeScope {
                                attribute: subtree.attribute,
                                span: span(subtree.span),
                            })
                            .collect();
                        (name, subtrees)
                    })
                    .collect(),
            },
            islands: meta
                .islands
                .into_iter()
                .map(|island| IslandMeta {
                    reference: island.reference,
                    module: island.module,
                    export: island.export,
                    strategy: island.strategy,
                    span: span(island.span),
                })
                .collect(),
            custom_properties: CustomPropertiesMeta {
                set: meta
                    .custom_properties
                    .set
                    .into_iter()
                    .map(|set| CustomPropertySet {
                        name: set.name,
                        span: span(set.span),
                    })
                    .collect(),
                read: meta.custom_properties.read,
            },
            imports: meta
                .imports
                .into_iter()
                .map(|import| ImportMeta {
                    specifier: import.specifier,
                    span: span(import.span),
                    dynamic: import.dynamic,
                })
                .collect(),
            contract: meta
                .contract
                .map(|entries| entries.into_iter().map(convert_contract_entry).collect()),
        },
    })
}

fn convert_contract_entry(entry: lumen_compiler::ContractEntry) -> ContractEntry {
    use lumen_compiler::{ContractKind as K, ContractSite as S};
    ContractEntry {
        span: span(entry.span),
        kind: match entry.kind {
            K::Tracked => ContractKind::Tracked,
            K::Untracked => ContractKind::Untracked,
            K::Once => ContractKind::Once,
            K::Deferred => ContractKind::Deferred,
        },
        site: match entry.site {
            S::Child => ContractSite::Child,
            S::Attribute => ContractSite::Attribute,
            S::Property => ContractSite::Property,
            S::Class => ContractSite::Class,
            S::Style => ContractSite::Style,
            S::Prop => ContractSite::Prop,
            S::Event => ContractSite::Event,
            S::Ref => ContractSite::Ref,
            S::Spread => ContractSite::Spread,
            S::Await => ContractSite::Await,
        },
        component: entry.component,
        via: entry.via,
        reads: entry.reads.into_iter().map(span).collect(),
    }
}

/// The kind of a content file (`lumen({ md, html })`).
#[napi(string_enum = "kebab-case")]
pub enum ContentKind {
    Md,
    Html,
}

/// A client script of an HTML or Markdown file: `src` as written, or inline `code`.
#[napi(object)]
pub struct ContentScript {
    pub src: Option<String>,
    pub code: Option<String>,
}

/// The `.stsx` module of a content file ([`content_source`]).
#[napi(object)]
pub struct ContentSource {
    /// Compile it as `<file>.stsx`.
    pub code: String,
    /// The raw YAML frontmatter of a Markdown file.
    pub frontmatter: Option<String>,
    /// The client scripts, in document order, which `./<name>?lumen-script` imports.
    pub scripts: Vec<ContentScript>,
    /// Errors in the file (`LUM1008`: a `<script>` in Markdown); spans are in the file's source.
    pub diagnostics: Vec<Diagnostic>,
}

/// The `.stsx` source of the component a `.md` or `.html` file imports as (`lumen_content`,
/// TASK-69): a static component of the file's content, with its top-level `<style>` elements as
/// file-level blocks and its scripts loaded by an island.
#[napi]
pub fn content_source(
    source: String,
    filename: String,
    kind: ContentKind,
) -> napi::Result<ContentSource> {
    let name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&filename);
    // A panic must not abort the host process (the dev server, the language server).
    let component = std::panic::catch_unwind(|| match kind {
        ContentKind::Md => lumen_content::markdown(&source, name),
        ContentKind::Html => lumen_content::html(&source, name),
    })
    .map_err(|_| {
        napi::Error::from_reason(format!("{filename}: the file could not be processed"))
    })?;
    Ok(ContentSource {
        code: component.source,
        frontmatter: component.frontmatter,
        scripts: component
            .scripts
            .into_iter()
            .map(|script| match script {
                lumen_content::Script::Src(src) => ContentScript {
                    src: Some(src),
                    code: None,
                },
                lumen_content::Script::Inline(code) => ContentScript {
                    src: None,
                    code: Some(code),
                },
            })
            .collect(),
        diagnostics: component
            .diagnostics
            .into_iter()
            .map(|diagnostic| Diagnostic {
                code: diagnostic.code.to_owned(),
                severity: Severity::Error,
                message: diagnostic.message,
                span: Span {
                    start: u32::try_from(diagnostic.span.start).unwrap_or(u32::MAX),
                    end: u32::try_from(diagnostic.span.end).unwrap_or(u32::MAX),
                },
                labels: Vec::new(),
                help: diagnostic.help,
                fix: None,
                docs: format!("errors/{}", diagnostic.code),
            })
            .collect(),
    })
}

/// Options of [`compile_svg`].
#[napi(object)]
pub struct SvgCompileOptions {
    /// Default `"client"`.
    pub target: Option<CompileTarget>,
    /// The project root, as for [`compile`].
    pub root: Option<String>,
}

/// Compiles an `.svg` file to the module of an inline component (`lumen_svg`, TASK-70): the
/// default export renders the SVG, takes SVG props and `title`. Scripts, event handlers and
/// `javascript:` URLs are removed and ids get a per-file prefix; optimising is the host's job
/// (the Vite plugin runs SVGO first). Throws when the file is not a well-formed SVG document.
#[napi]
pub fn compile_svg(
    source: String,
    filename: String,
    options: Option<SvgCompileOptions>,
) -> napi::Result<CompileResult> {
    let options = options.unwrap_or(SvgCompileOptions {
        target: None,
        root: None,
    });
    // A panic must not abort the host process (the dev server, the language server).
    let component = std::panic::catch_unwind(|| lumen_svg::component_source(&source))
        .map_err(|_| {
            napi::Error::from_reason(format!("{filename}: the SVG could not be processed"))
        })?
        .map_err(|error| napi::Error::from_reason(format!("{filename}: {error}")))?;
    compile(
        component,
        format!("{filename}.stsx"),
        Some(CompileOptions {
            target: options.target,
            source_map: Some(false),
            style_import: Some(false),
            emit_css: Some(false),
            css_targets: None,
            css_minify: None,
            root: options.root,
            packages: None,
            modules: None,
            contract: None,
        }),
    )
}
