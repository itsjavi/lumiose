//! `compile()`: the per-module pipeline (spec §5.1).
//!
//! ```text
//! scan → oxc_parser(masked) → semantic → $ref bindings + constant folding → strip placeholders
//!      → TypeScript strip → semantic → analyze → scope tokens + inventories
//!      → client | server codegen → oxc_codegen + source map
//!      → lumen_css (blocks, folded refs, inventories) → css + map
//! ```
//!
//! Spans everywhere are byte offsets into the original source: the masked text the parser sees
//! has identical offsets, so mapping back is the identity.

use oxc_allocator::Allocator;
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;

use crate::analyze;
use crate::codegen::ast::Ast;
use crate::codegen::client::{self, ScopeTokens, TransformOptions};
use crate::css::{self, CssOptions, ScopePlan};
use crate::diagnostics::{Code, Diagnostic};
use crate::prepare::{self, HostModule, ModuleRequest, ResolvedStyleRef};
use crate::scanner::{self, FileKind};
use crate::span::Span;

/// The output environment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum Target {
    /// Browser code on `lumen/dom`.
    #[default]
    Client,
    /// SSR code on `lumen/server`.
    Server,
}

#[derive(Debug, Clone)]
pub struct CompileOptions {
    pub target: Target,
    /// Produce source maps (for the JS and the CSS).
    pub source_map: bool,
    /// Import the file's CSS module (`<id>?lumen&type=style&lang.css`) when it has style blocks.
    pub style_import: bool,
    /// Compile the style blocks into [`CompileResult::css`].
    pub emit_css: bool,
    pub css: CssOptions,
    /// The project root (Vite's `root`). Island refs name modules inside it root-relatively
    /// (`/src/components/Team.stsx#TeamPanel`) and scope tokens hash the root-relative path;
    /// without it both use the module id as given.
    pub root: Option<String>,
    /// Modules the host loaded for folding imported `$name` constants, answering earlier
    /// [`CompileResult::module_requests`].
    pub modules: Vec<HostModule>,
}

impl Default for CompileOptions {
    fn default() -> Self {
        Self {
            target: Target::Client,
            source_map: true,
            style_import: true,
            emit_css: true,
            css: CssOptions::default(),
            root: None,
            modules: Vec::new(),
        }
    }
}

/// A component of the module.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ComponentMeta {
    pub name: String,
    pub span: Span,
    pub exported: bool,
    pub is_async: bool,
    /// Spans of the `await`s the async rewrite (TASK-15) indexes as sites `0..n`.
    pub await_sites: Vec<Span>,
}

/// An island call site (`<X client:* />`).
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct IslandMeta {
    /// `<module>#<export>`, as passed to the server's `island()`.
    #[cfg_attr(feature = "serde", serde(rename = "ref"))]
    pub reference: String,
    /// The module that exports the component (root-relative, an absolute id or a bare specifier).
    pub module: String,
    /// The export name (`default` for default exports).
    pub export: String,
    /// `load`, `idle`, `visible`, `media` or `only`.
    pub strategy: String,
    /// The component name in the JSX tag.
    pub span: Span,
}

#[derive(Debug, Clone, Default, PartialEq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct CompileMeta {
    pub components: Vec<ComponentMeta>,
    /// Number of hoisted templates.
    pub templates: usize,
    /// Events registered with `delegateEvents`.
    pub delegated_events: Vec<String>,
    /// `lumen/dom` (client) or `lumen/server` (server) helpers the module imports.
    pub runtime_helpers: Vec<String>,
    /// Every `$name` style reference with its binding and folded value.
    pub style_refs: Vec<ResolvedStyleRef>,
    /// True when the module imports its CSS module.
    pub has_styles: bool,
    /// The `data-l-*` attributes stamped on the file's and its components' elements.
    pub scope_tokens: ScopeTokens,
    /// Island call sites, in source order (both targets).
    pub islands: Vec<IslandMeta>,
}

#[derive(Debug, Clone, Default)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct CompileResult {
    /// JavaScript (types stripped). Empty when the source could not be parsed.
    pub code: String,
    /// Source map v3 JSON.
    pub map: Option<String>,
    /// The file's stylesheet: file-level blocks first, then component blocks in source order
    /// (spec §4.6.2). `None` when the file has no style blocks, CSS is disabled, or
    /// `module_requests` is not empty.
    pub css: Option<String>,
    /// Source map v3 JSON from `css` to the `.stsx` source.
    pub css_map: Option<String>,
    /// Ids of the modules imported constants were folded from: edits to them change `css`.
    pub css_deps: Vec<String>,
    /// Modules needed to fold imported `$name` constants. When not empty, `css` is withheld:
    /// load each one and compile again with them in [`CompileOptions::modules`].
    pub module_requests: Vec<ModuleRequest>,
    pub diagnostics: Vec<Diagnostic>,
    pub meta: CompileMeta,
}

impl CompileResult {
    pub fn has_errors(&self) -> bool {
        self.diagnostics.iter().any(Diagnostic::is_error)
    }
}

/// Compiles one module. `filename` is the module id (also the source map's `sources` entry and
/// the CSS module import base).
pub fn compile(source: &str, filename: &str, options: &CompileOptions) -> CompileResult {
    let scan = scanner::scan(source, filename);
    let mut diagnostics = scan.diagnostics.clone();

    let allocator = Allocator::default();
    let ast = Ast::new(&allocator);
    let parsed = Parser::new(&allocator, scan.masked(), source_type(scan.kind, filename)).parse();
    diagnostics.extend(
        parsed
            .diagnostics
            .into_vec()
            .iter()
            .map(|d| prepare::from_oxc(Code::SyntaxError, d)),
    );
    if parsed.fatal_error {
        sort(&mut diagnostics);
        return CompileResult {
            diagnostics,
            ..CompileResult::default()
        };
    }
    let mut program = parsed.program;

    // Nodes are only needed to fold `$name` references (declarator lookups).
    let has_refs = scan.blocks.iter().any(|block| !block.refs.is_empty());
    let semantic = SemanticBuilder::new()
        .with_enum_eval(true)
        .with_build_nodes(has_refs)
        .build(&program)
        .semantic;
    let style = prepare::resolve_style_refs(
        &allocator,
        &program,
        &semantic,
        filename,
        &scan.blocks,
        &options.modules,
        &css::hyphenated_refs(source, &scan.blocks),
    );
    let scoping = semantic.into_scoping();
    prepare::strip_style_artifacts(&ast, &mut program, &scan.blocks, &style);
    diagnostics.extend(prepare::strip_types(
        &allocator,
        &mut program,
        scoping,
        filename,
    ));

    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let analysis = analyze::analyze(&program, &scoping, &scan.blocks, &scan.diagnostics);
    diagnostics.extend(analysis.diagnostics.iter().cloned());

    let scopes = ScopePlan::new(
        &scan.blocks,
        &analysis,
        &root_relative(filename, options.root.as_deref()),
    );
    let emit_css = options.emit_css && scopes.has_css() && style.is_complete();
    let inventories = if emit_css {
        css::inventories(&program, &analysis, &scopes)
    } else {
        Vec::new()
    };

    let transform_options = TransformOptions {
        target: options.target,
        root: options.root.as_deref(),
        filename,
        scope_tokens: &scopes.tokens,
        style_import: options.style_import,
    };
    let output = client::transform(
        &ast,
        &mut program,
        &scoping,
        &analysis,
        source,
        &scan.blocks,
        &transform_options,
    );
    diagnostics.extend(output.diagnostics);

    // Print against the original text: source map columns and `sourcesContent` then refer to
    // the authored file (masked style regions are never printed).
    program.source_text = source;
    let codegen_options = CodegenOptions {
        source_map_path: options.source_map.then(|| filename.into()),
        ..CodegenOptions::default()
    };
    let printed = Codegen::new().with_options(codegen_options).build(&program);

    let (css, css_map) = if emit_css {
        let (output, css_diagnostics) = css::process(
            source,
            filename,
            &scopes,
            &style.refs,
            &inventories,
            &options.css,
            options.source_map,
        );
        diagnostics.extend(css_diagnostics);
        (Some(output.css), output.map)
    } else {
        (None, None)
    };
    diagnostics.extend(style.diagnostics);
    sort(&mut diagnostics);
    let has_styles = options.style_import && scan.blocks.iter().any(|b| !b.svg);
    CompileResult {
        code: printed.code,
        map: printed.map.map(|map| map.to_json_string()),
        css,
        css_map,
        css_deps: style.deps,
        module_requests: style.requests,
        diagnostics,
        meta: CompileMeta {
            components: analysis
                .components
                .iter()
                .map(|c| ComponentMeta {
                    name: c.name.clone(),
                    span: c.span,
                    exported: c.exported,
                    is_async: c.is_async,
                    await_sites: c.await_sites.clone(),
                })
                .collect(),
            templates: output.templates,
            delegated_events: output.delegated_events,
            runtime_helpers: output.runtime_helpers,
            style_refs: style.refs,
            has_styles,
            scope_tokens: scopes.tokens,
            islands: output.islands,
        },
    }
}

/// The module path that scope tokens hash: relative to `root` (without a leading `/`) when the
/// module is inside it, otherwise the id as given (without its query).
fn root_relative(filename: &str, root: Option<&str>) -> String {
    let id = filename
        .split(['?', '#'])
        .next()
        .unwrap_or_default()
        .replace('\\', "/");
    let Some(root) = root else {
        return id;
    };
    let root = root.replace('\\', "/");
    match id.strip_prefix(root.trim_end_matches('/')) {
        Some(rest) if rest.starts_with('/') => rest[1..].to_owned(),
        _ => id,
    }
}

fn source_type(kind: FileKind, filename: &str) -> SourceType {
    let path = filename.split(['?', '#']).next().unwrap_or(filename);
    match kind {
        FileKind::Stsx => SourceType::tsx(),
        FileKind::Tsx if path.ends_with(".jsx") => SourceType::jsx(),
        FileKind::Tsx => SourceType::tsx(),
        FileKind::Script if path.ends_with(".ts") || path.ends_with(".mts") => SourceType::ts(),
        FileKind::Script => SourceType::mjs(),
    }
}

fn sort(diagnostics: &mut [Diagnostic]) {
    diagnostics.sort_by_key(|d| (d.span.start, d.span.end));
}

impl CompileResult {
    /// Applies an offset mapping (for example byte → UTF-16) to every span.
    pub fn map_spans(&mut self, f: &impl Fn(u32) -> u32) {
        for diagnostic in &mut self.diagnostics {
            diagnostic.map_spans(f);
        }
        for component in &mut self.meta.components {
            component.span = component.span.map(f);
            for site in &mut component.await_sites {
                *site = site.map(f);
            }
        }
        for island in &mut self.meta.islands {
            island.span = island.span.map(f);
        }
        for reference in &mut self.meta.style_refs {
            reference.span = reference.span.map(f);
            if let Some(binding) = &mut reference.binding {
                binding.declaration = binding.declaration.map(f);
            }
        }
    }
}
