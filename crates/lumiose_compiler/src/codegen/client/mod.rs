//! JSX codegen for both targets.
//!
//! - Client (contract doc-2 §2, spec §5.2): JSX becomes hoisted templates, path walks and
//!   fine-grained bindings on the `lumiose/dom` runtime.
//! - Server (contract doc-2 §3, spec §5.3): JSX becomes `ssr(parts, ...holes)` string
//!   concatenation on the `lumiose/server` runtime (`ssr.rs`).
//!
//! The transform is a `VisitMut` over the type-stripped program. JSX roots are compiled in one go
//! (`compile_*`); every user expression moved into the output is visited exactly once, which
//! applies the reactive props rewrite, the list index rewrite and the selector rewrite to it.
//! Components, props objects and the list/branch/selector idioms are shared by both targets, so
//! that the server output has the same dynamic regions as the client walk (hydration relies on it).

mod asyncs;
mod children;
mod class_flow;
mod components;
mod contract;
mod element;
mod events;
mod html;
mod idioms;
mod islands;
mod props;
mod row_items;
mod rows;
mod ssr;
mod template;
mod text;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use oxc_allocator::{ArenaVec, CloneIn, TakeIn};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, VisitMut, walk, walk_mut};
use oxc_semantic::Scoping;
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::{ScopeFlags, ScopeId};
use oxc_syntax::symbol::SymbolId;

pub use children::has_content;
pub use contract::{ContractEntry, ContractKind, ContractSite, execution_contract};
pub use element::{is_intrinsic, is_written_content, tag_name, takes_markup};

use crate::analyze::{Analysis, is_jsx_like};
use crate::codegen::ast::Ast;
use crate::diagnostics::Diagnostic;
use crate::scanner::StyleBlock;
use crate::{IslandMeta, Target};
use html::Namespace;
use idioms::MapCtx;
use props::PropPath;

/// `data-l-*` scope attributes per scope (computed from the style blocks, see `crate::css`).
/// Every element of a scope carries its attribute(s); component call sites that pass `class`
/// also pass the caller's attributes there as `$$scope` (spec §4.6.2).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct ScopeTokens {
    /// The file scope attribute (top-level blocks), applied to every template in the file.
    pub file: Option<String>,
    /// By component name, the subtree scopes of its style-bearing elements, by start offset.
    pub components: BTreeMap<String, Vec<SubtreeScope>>,
}

/// The scope of the `<style>` blocks inside one element of a component (decision-23): the
/// element and every element lexically inside it in that component carry `attribute`.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct SubtreeScope {
    pub attribute: String,
    /// The enclosing element (or fragment) of the blocks.
    pub span: crate::span::Span,
}

impl SubtreeScope {
    /// Whether the JSX at `span` is inside the subtree (the enclosing element included).
    pub fn covers(&self, span: Span) -> bool {
        self.span.start <= span.start && span.end <= self.span.end
    }
}

impl ScopeTokens {
    /// The attributes of the JSX at `span` in `component` (`None` outside components): the file
    /// attribute, then those of the component's subtrees around it, outermost first. `strict`
    /// leaves out a subtree whose element is exactly `span`.
    pub fn at(&self, component: Option<&str>, span: Span, strict: bool) -> Vec<String> {
        let mut result: Vec<String> = self.file.iter().cloned().collect();
        let subtrees = component.and_then(|name| self.components.get(name));
        for subtree in subtrees.into_iter().flatten() {
            let exact = subtree.span.start == span.start && subtree.span.end == span.end;
            if subtree.covers(span) && !(strict && exact) {
                result.push(subtree.attribute.clone());
            }
        }
        result
    }
}

pub struct TransformOptions<'o> {
    pub target: Target,
    /// The project root: island refs name modules inside it root-relatively (`/src/x.stsx`).
    pub root: Option<&'o str>,
    /// Packages outside the root: island refs name their modules package-relatively.
    pub packages: &'o [crate::PackageRoot],
    /// The module id, used for the CSS module import.
    pub filename: &'o str,
    pub scope_tokens: &'o ScopeTokens,
    /// Emit `import "<id>?lumiose&type=style&lang.css"` when the file has style blocks.
    pub style_import: bool,
    /// See [`crate::CompileOptions::strict_csp`].
    pub strict_csp: bool,
    /// See [`crate::CompileOptions::dev_source`].
    pub dev_source: Option<&'o crate::dev_source::DevSource>,
}

#[derive(Debug, Default)]
pub struct TransformOutput {
    pub diagnostics: Vec<Diagnostic>,
    /// Hoisted templates (client) or static part arrays (server).
    pub templates: usize,
    pub delegated_events: Vec<String>,
    pub runtime_helpers: Vec<String>,
    pub islands: Vec<IslandMeta>,
}

/// Runtime helpers in `lumiose/dom` contract order (also the import order).
const CLIENT_RUNTIME: &[&str] = &[
    "template",
    "outputTemplate",
    "bind",
    "setText",
    "setAttr",
    "setProp",
    "setClass",
    "toggleClass",
    "setStyle",
    "setStyleProperty",
    "setNonce",
    "insert",
    "insertText",
    "list",
    "branch",
    "branchValue",
    "listValue",
    "insertValue",
    "selector",
    "createComponent",
    "restProps",
    "mergeProps",
    "spread",
    "applyScope",
    "delegateEvents",
    "listen",
    "bindValue",
    "bindChecked",
    "bindProperty",
    "attach",
    "useRef",
    "$await",
    "$leave",
    "$async",
];

/// Runtime helpers in `lumiose/server` contract order (also the import order).
const SERVER_RUNTIME: &[&str] = &[
    "ssr",
    "SSRHtml",
    "text",
    "insert",
    "insertText",
    "insertValue",
    "attr",
    "classAttr",
    "styleAttr",
    "nonceAttr",
    "spreadAttrs",
    "escape",
    "rawText",
    "list",
    "branch",
    "branchArm",
    "selector",
    "createComponent",
    "restProps",
    "mergeProps",
    "island",
    "$await",
    "$leave",
    "$async",
];

/// Transforms `program` in place into client or server JS.
pub fn transform<'a>(
    ast: &Ast<'a>,
    program: &mut Program<'a>,
    scoping: &Scoping,
    analysis: &Analysis,
    source: &str,
    blocks: &[StyleBlock],
    options: &TransformOptions<'_>,
) -> TransformOutput {
    let mut codegen = Codegen {
        ast,
        scoping,
        analysis,
        source,
        blocks,
        options,
        names: Names::new(scoping),
        bindings: islands::ModuleBindings::collect(program, scoping),
        islands: Vec::new(),
        props_symbols: scoping
            .symbol_ids()
            .filter(|&symbol| scoping.symbol_name(symbol) == "props")
            .collect(),
        text_consts: children::text_consts(program, scoping),
        templates: HashMap::new(),
        ssr_concats: HashMap::new(),
        template_decls: Vec::new(),
        apply_decls: Vec::new(),
        hoisted: Vec::new(),
        apply_fns: HashMap::new(),
        runtime: BTreeMap::new(),
        delegated: BTreeSet::new(),
        functions: Vec::new(),
        awaits: Vec::new(),
        row_callback: false,
        components: Vec::new(),
        maps: Vec::new(),
        namespaces: Vec::new(),
        select_values: Vec::new(),
        diagnostics: Vec::new(),
    };
    codegen.visit_program(program);
    codegen.finish_module(program)
}

/// Compiled JSX: setup statements plus the resulting value.
pub struct Compiled<'a> {
    pub setup: Vec<Statement<'a>>,
    pub value: Expression<'a>,
}

impl<'a> Compiled<'a> {
    pub fn value(value: Expression<'a>) -> Self {
        Self {
            setup: Vec::new(),
            value,
        }
    }

    /// An expression: the value, or an IIFE when there is setup.
    pub fn into_expression(self, ast: &Ast<'a>, span: Span) -> Expression<'a> {
        ast.iife(span, self.setup, self.value)
    }
}

/// Fresh, collision-free names.
pub struct Names {
    used: HashSet<String>,
    /// The next numeric suffix to try per base name (keeps `fresh` O(1) amortised).
    next: HashMap<String, u32>,
}

impl Names {
    fn new(scoping: &Scoping) -> Self {
        let mut used: HashSet<String> = scoping.symbol_names().map(str::to_owned).collect();
        used.extend(
            scoping
                .root_unresolved_references()
                .keys()
                .map(|name| name.to_string()),
        );
        Self {
            used,
            next: HashMap::new(),
        }
    }

    pub fn fresh(&mut self, base: &str) -> String {
        if self.used.insert(base.to_owned()) {
            return base.to_owned();
        }
        let next = self.next.entry(base.to_owned()).or_insert(2);
        loop {
            let name = format!("{base}{next}");
            *next += 1;
            if self.used.insert(name.clone()) {
                return name;
            }
        }
    }
}

/// A component whose body is being transformed.
struct ComponentCtx<'a> {
    name: String,
    scope: Option<ScopeId>,
    /// The props parameter's name (`props` unless taken).
    props_name: String,
    /// Destructured prop bindings → their access paths.
    props: HashMap<SymbolId, PropPath<'a>>,
    /// Bindings of the component that may carry its `class` prop (class_flow.rs).
    class_carriers: HashSet<SymbolId>,
    /// The props object and the `...rest` of a destructured props parameter: objects whose keys
    /// are fixed for the component's lifetime.
    props_objects: HashSet<SymbolId>,
    /// Statements hoisted to the start of the component body (delegated handlers).
    setup_hoists: Vec<Statement<'a>>,
}

pub struct Codegen<'a, 's> {
    pub ast: &'s Ast<'a>,
    pub scoping: &'s Scoping,
    pub analysis: &'s Analysis,
    /// The original source (JSX text and SVG blocks are read from it).
    pub source: &'s str,
    pub blocks: &'s [StyleBlock],
    pub options: &'s TransformOptions<'s>,
    pub names: Names,
    /// Imports and exports, for island refs.
    bindings: islands::ModuleBindings,
    islands: Vec<IslandMeta>,
    /// Symbols named `props` (for the props parameter name choice).
    props_symbols: Vec<SymbolId>,
    /// Consts with a provably text value (`children::text_consts`).
    text_consts: HashSet<SymbolId>,
    /// Hoisted templates (client) or static part arrays (server) by content.
    templates: HashMap<(String, u8), String>,
    /// Hoisted server template concatenations (`ssr_concat`) by parts and hole kinds.
    ssr_concats: HashMap<String, String>,
    /// Module-scope declarations, emitted after the imports: templates (or part arrays), apply
    /// functions, then hoisted handlers.
    template_decls: Vec<Statement<'a>>,
    apply_decls: Vec<Statement<'a>>,
    hoisted: Vec<Statement<'a>>,
    apply_fns: HashMap<String, String>,
    /// Runtime helper → local name.
    runtime: BTreeMap<usize, String>,
    delegated: BTreeSet<String>,
    /// Per enclosing function: whether it renders once (a component or a `.map()` row callback),
    /// so that a returned reactive conditional must stay a tracked function.
    functions: Vec<bool>,
    /// Per enclosing function: the await sites when it is an async component (asyncs.rs).
    awaits: Vec<Option<Vec<u32>>>,
    /// Set by `compile_list` for the row callback it is about to visit.
    row_callback: bool,
    components: Vec<ComponentCtx<'a>>,
    maps: Vec<MapCtx<'a>>,
    /// The namespace of the element whose dynamic children are being compiled.
    namespaces: Vec<Namespace>,
    /// Server: the local holding the value of each enclosing `<select value>`, which marks the
    /// matching `<option>` selected (ssr.rs).
    select_values: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}

impl<'a> Codegen<'a, '_> {
    // ---- module-level state --------------------------------------------------------------------

    /// True when compiling for `lumiose/server`.
    pub fn server(&self) -> bool {
        self.options.target == Target::Server
    }

    fn runtime_names(&self) -> &'static [&'static str] {
        if self.server() {
            SERVER_RUNTIME
        } else {
            CLIENT_RUNTIME
        }
    }

    /// A reference to a runtime helper of the target (imported on first use).
    pub fn runtime(&mut self, helper: &'static str, span: Span) -> Expression<'a> {
        let index = self
            .runtime_names()
            .iter()
            .position(|&h| h == helper)
            .expect("known runtime helper");
        let names = &mut self.names;
        let local = self
            .runtime
            .entry(index)
            .or_insert_with(|| names.fresh(helper))
            .clone();
        self.ast.ident(span, &local)
    }

    /// The hoisted template factory for `html` (deduplicated).
    pub fn template(&mut self, html: &str, flags: u8, span: Span) -> String {
        let key = (html.to_owned(), flags);
        if let Some(name) = self.templates.get(&key) {
            return name.clone();
        }
        let name = self.names.fresh(&format!("_t{}", self.templates.len()));
        // A form reset replaces an `<output>`'s children in Firefox and WebKit; `outputTemplate`
        // keeps them (TASK-425), and only modules with an output import it.
        let helper = if html.contains("<output") {
            "outputTemplate"
        } else {
            "template"
        };
        let callee = self.runtime(helper, span);
        let mut args = vec![
            self.ast
                .template_literal(span, &html::template_literal_raw(html)),
        ];
        if flags != 0 {
            args.push(self.ast.number(span, f64::from(flags)));
        }
        let init = self.ast.call_pure(span, callee, args);
        self.template_decls
            .push(self.ast.const_decl(span, &name, init));
        self.templates.insert(key, name.clone());
        name
    }

    /// The hoisted static parts array of an `ssr()` call (deduplicated, server target).
    pub fn ssr_parts(&mut self, parts: &[String], span: Span) -> String {
        // Parts never contain NUL (JSX text and attribute values cannot), so it is a safe key
        // separator; flag 255 keeps the keys apart from client templates.
        let key = (parts.join("\0"), u8::MAX);
        if let Some(name) = self.templates.get(&key) {
            return name.clone();
        }
        let name = self.names.fresh(&format!("_s{}", self.templates.len()));
        let elements = parts
            .iter()
            .map(|part| self.ast.string(span, part))
            .collect::<Vec<_>>();
        let init = self.ast.array(span, elements);
        self.template_decls
            .push(self.ast.const_decl(span, &name, init));
        self.templates.insert(key, name.clone());
        name
    }

    /// The hoisted concatenation of the server template `parts` (named `parts_name`) around
    /// holes, deduplicated:
    /// `(h0, h1) => typeof h0 === "string" && h1 instanceof SSRHtml ? new SSRHtml(p0 + h0 + p1 +
    /// h1.t + p2) : ssr(_sN, h0, h1)`. It is `ssr()`'s synchronous outcome without its generic
    /// loop: string holes are HTML and node holes (`nodes[i]`: `list`, `branch`) render their
    /// HTML. Any other value (a promise, an island text hole, null) takes `ssr()` with the same,
    /// already evaluated holes.
    pub fn ssr_concat(
        &mut self,
        parts_name: &str,
        parts: &[String],
        nodes: &[bool],
        span: Span,
    ) -> String {
        let flags: String = nodes
            .iter()
            .map(|&node| if node { 'n' } else { 's' })
            .collect();
        let key = format!("{parts_name}:{flags}");
        if let Some(name) = self.ssr_concats.get(&key) {
            return name.clone();
        }
        // `_s3` → `_c3`, next to its parts.
        let name = self.names.fresh(&format!("_c{}", &parts_name[2..]));
        let params: Vec<String> = (0..nodes.len()).map(|i| format!("h{i}")).collect();
        let Expression::Identifier(node_class) = self.runtime("SSRHtml", span) else {
            unreachable!("runtime helpers are identifiers");
        };
        let node_class = node_class.name.as_str();
        let mut test: Option<Expression<'a>> = None;
        let mut html: Option<Expression<'a>> = None;
        let append = |html: &mut Option<Expression<'a>>, value: Expression<'a>| {
            *html = Some(match html.take() {
                Some(left) => self.ast.binary(span, left, BinaryOperator::Addition, value),
                None => value,
            });
        };
        for (i, part) in parts.iter().enumerate() {
            if !part.is_empty() {
                append(&mut html, self.ast.string(span, part));
            }
            let (Some(param), Some(&node)) = (params.get(i), nodes.get(i)) else {
                continue;
            };
            let hole = self.ast.ident(span, param);
            let check = if node {
                let class = self.ast.ident(span, node_class);
                self.ast
                    .binary(span, hole, BinaryOperator::Instanceof, class)
            } else {
                self.ast.is_string(span, hole)
            };
            test = Some(match test.take() {
                Some(left) => self.ast.and(span, left, check),
                None => check,
            });
            let hole = self.ast.ident(span, param);
            let value = if node {
                self.ast.member(span, hole, "t")
            } else {
                hole
            };
            append(&mut html, value);
        }
        let html = html.expect("a template with holes has content");
        let fast = self
            .ast
            .new_instance(span, self.ast.ident(span, node_class), [html]);
        let callee = self.runtime("ssr", span);
        let args = std::iter::once(self.ast.ident(span, parts_name))
            .chain(params.iter().map(|param| self.ast.ident(span, param)));
        let slow = self.ast.call(span, callee, args);
        let test = test.expect("a template with holes has checks");
        let body = self.ast.conditional(span, test, fast, slow);
        let params: Vec<&str> = params.iter().map(String::as_str).collect();
        let function = self.ast.arrow(span, &params, body);
        self.template_decls
            .push(self.ast.const_decl(span, &name, function));
        self.ssr_concats.insert(key, name.clone());
        name
    }

    /// A hoisted `(el, v) => helper(el, "name", v)` apply function (deduplicated).
    pub fn apply_fn(&mut self, helper: &'static str, name: &str, span: Span) -> Expression<'a> {
        let key = format!("{helper}:{name}");
        if let Some(existing) = self.apply_fns.get(&key) {
            return self.ast.ident(span, existing);
        }
        let var = self.names.fresh(&format!("_a{}", self.apply_fns.len()));
        let callee = self.runtime(helper, span);
        let body = self.ast.call(
            span,
            callee,
            [
                self.ast.ident(span, "el"),
                self.ast.string(span, name),
                self.ast.ident(span, "v"),
            ],
        );
        let function = self.ast.arrow(span, &["el", "v"], body);
        self.apply_decls
            .push(self.ast.const_decl(span, &var, function));
        self.apply_fns.insert(key, var.clone());
        self.ast.ident(span, &var)
    }

    pub fn hoist(&mut self, statement: Statement<'a>) {
        self.hoisted.push(statement);
    }

    pub fn delegate(&mut self, event: &str) {
        self.delegated.insert(event.to_owned());
    }

    fn finish_module(mut self, program: &mut Program<'a>) -> TransformOutput {
        let span = Span::default();
        if !self.delegated.is_empty() {
            let callee = self.runtime("delegateEvents", span);
            let names = self
                .delegated
                .iter()
                .map(|e| self.ast.string(span, e))
                .collect::<Vec<_>>();
            let call = self.ast.call(span, callee, [self.ast.array(span, names)]);
            program.body.push(self.ast.expr_stmt(span, call));
        }
        let mut header = Vec::new();
        let names = self.runtime_names();
        if !self.runtime.is_empty() {
            let pairs: Vec<(&str, &str)> = self
                .runtime
                .iter()
                .map(|(&i, local)| (names[i], local.as_str()))
                .collect();
            let module = if self.server() {
                "lumiose/server"
            } else {
                "lumiose/dom"
            };
            header.push(self.ast.import_named(module, &pairs));
        }
        if self.options.style_import && self.blocks.iter().any(|b| !b.svg) {
            let id = self
                .options
                .filename
                .split(['?', '#'])
                .next()
                .unwrap_or_default();
            header.push(
                self.ast
                    .import_side_effect(&format!("{id}?lumiose&type=style&lang.css")),
            );
        }
        header.append(&mut self.template_decls);
        header.append(&mut self.apply_decls);
        header.append(&mut self.hoisted);
        let body = program.body.take_in(self.ast);
        let split = body
            .iter()
            .position(|s| !matches!(s, Statement::ImportDeclaration(_)))
            .unwrap_or(body.len());
        let mut out = self.ast.vec();
        let mut iter = body.into_iter();
        out.extend(iter.by_ref().take(split));
        out.extend(header);
        out.extend(iter);
        program.body = out;
        TransformOutput {
            diagnostics: self.diagnostics,
            templates: self.templates.len(),
            delegated_events: self.delegated.into_iter().collect(),
            islands: self.islands,
            runtime_helpers: self.runtime.keys().map(|&i| names[i].to_owned()).collect(),
        }
    }

    // ---- context ----------------------------------------------------------------------------

    fn component(&self) -> Option<&ComponentCtx<'a>> {
        self.components.last()
    }

    /// Records the bindings of the current component's (untransformed) body that may carry its
    /// `class` prop.
    fn find_class_carriers(&mut self, body: &FunctionBody<'a>) {
        let Some(ctx) = self.components.last() else {
            return;
        };
        let initial = ctx.class_carriers.clone();
        let carriers =
            class_flow::carriers(body, &ctx.props_name, &ctx.props, self.scoping, initial);
        if let Some(ctx) = self.components.last_mut() {
            ctx.class_carriers = carriers;
        }
    }

    /// The scope attributes of the JSX at `span`: the file's, then those of the current
    /// component's style subtrees that lexically enclose it (decision-23).
    pub fn scope_tokens(&self, span: Span) -> Vec<String> {
        let component = self.component().map(|c| c.name.as_str());
        self.options.scope_tokens.at(component, span, false)
    }

    /// The scope attributes of the `<tbody>` the parser inserts around `rows`: those of the
    /// table, so a subtree that is exactly the rows (a lone styled `<tr>`) is not included.
    pub fn tbody_scope_tokens(&self, rows: Span) -> Vec<String> {
        let component = self.component().map(|c| c.name.as_str());
        self.options.scope_tokens.at(component, rows, true)
    }

    /// The `data-lumiose-source` attribute of the JSX element `tag` at `span`, in dev with the
    /// inspector; none for elements that render no box (see `dev_source::is_located`).
    pub fn source_attribute(&self, tag: &str, span: Span) -> Option<(String, String)> {
        let dev = self.options.dev_source?;
        if !crate::dev_source::is_located(tag) {
            return None;
        }
        Some((
            crate::dev_source::SOURCE_ATTRIBUTE.to_owned(),
            dev.at(self.source, span.start),
        ))
    }

    pub fn namespace(&self) -> Namespace {
        self.namespaces.last().copied().unwrap_or(Namespace::Html)
    }

    pub fn symbol_of(&self, ident: &IdentifierReference<'_>) -> Option<SymbolId> {
        crate::analyze::reactivity::symbol_of(self.scoping, ident)
    }

    /// The source text of an original node.
    pub fn text_of(&self, span: Span) -> &str {
        self.source
            .get(span.start as usize..span.end as usize)
            .unwrap_or_default()
    }

    // ---- expressions --------------------------------------------------------------------------

    /// Visits a user expression (rewrites) and returns it.
    pub fn visited(&mut self, mut expr: Expression<'a>) -> Expression<'a> {
        self.visit_expression(&mut expr);
        expr
    }

    /// `compute` for `bind`/`insert`: the signal itself for `count()`, else `() => expr`.
    pub fn compute(&self, expr: Expression<'a>) -> Expression<'a> {
        let span = expr.span();
        match self.signal_source(expr) {
            Ok(source) => source,
            Err(expr) => self.ast.arrow(span, &[], expr),
        }
    }

    /// `count()` → `Ok(count)` when `count` is a binding that is never reassigned.
    fn signal_source(&self, expr: Expression<'a>) -> Result<Expression<'a>, Expression<'a>> {
        let stable = match expr.without_parentheses() {
            Expression::CallExpression(call) => {
                !call.optional
                    && call.arguments.is_empty()
                    && matches!(&call.callee, Expression::Identifier(ident)
                        if self.symbol_of(ident).is_some_and(|s| !self.scoping.symbol_is_mutated(s)))
            }
            _ => false,
        };
        if !stable {
            return Err(expr);
        }
        let mut expr = expr;
        while let Expression::ParenthesizedExpression(paren) = expr {
            expr = paren.unbox().expression;
        }
        match expr {
            Expression::CallExpression(call) => Ok(call.unbox().callee),
            other => Err(other),
        }
    }

    /// True when `expr` reads reactive state per spec §4.5: it contains a call, a member access,
    /// a tagged template or JSX outside nested functions (`untrack(…)` opts out). Expressions with
    /// `await`/`yield` are evaluated in place.
    pub fn is_dynamic(&self, expr: &Expression<'a>) -> bool {
        is_dynamic_expression(expr)
    }

    /// Compiles any JSX-ish value in a renderable position (component children, props, branch
    /// arms, fragment items, `return`).
    pub fn compile_value(&mut self, expr: Expression<'a>) -> Compiled<'a> {
        match expr {
            Expression::ParenthesizedExpression(paren) => {
                self.compile_value(paren.unbox().expression)
            }
            Expression::JSXElement(element) => self.compile_element_root(element),
            Expression::JSXFragment(fragment) => {
                let span = fragment.span;
                let children = fragment.unbox().children;
                self.compile_fragment(children, span)
            }
            Expression::ConditionalExpression(cond)
                if is_jsx_like(&cond.consequent) || is_jsx_like(&cond.alternate) =>
            {
                let span = cond.span;
                let cond = cond.unbox();
                let test = self.visited(cond.test);
                let consequent = self
                    .compile_arm(cond.consequent)
                    .into_expression(self.ast, span);
                let alternate = self
                    .compile_arm(cond.alternate)
                    .into_expression(self.ast, span);
                Compiled::value(self.ast.conditional(span, test, consequent, alternate))
            }
            Expression::LogicalExpression(logical) if is_jsx_like(&logical.right) => {
                let span = logical.span;
                let logical = logical.unbox();
                let left = self.visited(logical.left);
                let right = self
                    .compile_arm(logical.right)
                    .into_expression(self.ast, span);
                Compiled::value(Expression::new_logical_expression(
                    span,
                    left,
                    logical.operator,
                    right,
                    self.ast,
                ))
            }
            other => Compiled::value(self.visited(other)),
        }
    }

    /// A returned value. In a component or a row callback (both run once), a reactive conditional
    /// or a list is returned as a parentless `branchValue`/`listValue` so that it stays live (the
    /// server's `branch`/`list`).
    fn compile_return(&mut self, expr: Expression<'a>) -> Compiled<'a> {
        let renders_once = self.functions.last().copied().unwrap_or(false);
        let expr = if renders_once {
            match self.live_value(expr) {
                Ok(compiled) => return compiled,
                Err(expr) => expr,
            }
        } else {
            expr
        };
        self.compile_value(expr)
    }

    /// A returned `.map()` that `compile_return` makes a live list.
    fn returns_list(&self, expr: &Expression<'a>) -> bool {
        self.functions.last().copied().unwrap_or(false) && self.is_list(expr)
    }

    /// `is_dynamic` on an expression before it is visited (destructured props count as reads).
    pub(super) fn reads_reactive(&self, expr: &Expression<'a>) -> bool {
        if self.is_dynamic(expr) {
            return true;
        }
        let mut finder = PropRefFinder {
            codegen: self,
            found: false,
        };
        finder.visit_expression(expr);
        finder.found
    }

    fn is_jsx_root(expr: &Expression<'a>) -> bool {
        matches!(
            expr.without_parentheses(),
            Expression::JSXElement(_) | Expression::JSXFragment(_)
        )
    }
}

/// [`Codegen::is_dynamic`] without a codegen: `(dynamic, suspends)`.
pub(super) fn dynamic_and_suspends(expr: &Expression<'_>) -> (bool, bool) {
    let mut finder = DynamicFinder::default();
    finder.visit_expression(expr);
    (finder.dynamic, finder.suspends)
}

fn is_dynamic_expression(expr: &Expression<'_>) -> bool {
    let (dynamic, suspends) = dynamic_and_suspends(expr);
    dynamic && !suspends
}

#[derive(Default)]
struct DynamicFinder {
    dynamic: bool,
    suspends: bool,
}

impl<'a> Visit<'a> for DynamicFinder {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        if matches!(&it.callee, Expression::Identifier(ident) if ident.name == "untrack") {
            return;
        }
        self.dynamic = true;
        walk::walk_call_expression(self, it);
    }
    fn visit_new_expression(&mut self, it: &NewExpression<'a>) {
        self.dynamic = true;
        walk::walk_new_expression(self, it);
    }
    fn visit_static_member_expression(&mut self, it: &StaticMemberExpression<'a>) {
        self.dynamic = true;
        walk::walk_static_member_expression(self, it);
    }
    fn visit_computed_member_expression(&mut self, it: &ComputedMemberExpression<'a>) {
        self.dynamic = true;
        walk::walk_computed_member_expression(self, it);
    }
    fn visit_private_field_expression(&mut self, it: &PrivateFieldExpression<'a>) {
        self.dynamic = true;
        walk::walk_private_field_expression(self, it);
    }
    fn visit_tagged_template_expression(&mut self, it: &TaggedTemplateExpression<'a>) {
        self.dynamic = true;
        walk::walk_tagged_template_expression(self, it);
    }
    fn visit_jsx_element(&mut self, _: &JSXElement<'a>) {
        self.dynamic = true;
    }
    fn visit_jsx_fragment(&mut self, _: &JSXFragment<'a>) {
        self.dynamic = true;
    }
    fn visit_await_expression(&mut self, it: &AwaitExpression<'a>) {
        self.suspends = true;
        walk::walk_await_expression(self, it);
    }
    fn visit_yield_expression(&mut self, it: &YieldExpression<'a>) {
        self.suspends = true;
        walk::walk_yield_expression(self, it);
    }
}

struct PropRefFinder<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    found: bool,
}

impl<'a> Visit<'a> for PropRefFinder<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if let Some(symbol) = self.codegen.symbol_of(it)
            && (self
                .codegen
                .components
                .iter()
                .any(|c| c.props.contains_key(&symbol))
                || self.codegen.maps.iter().any(|m| m.index == Some(symbol))
                || self.codegen.reads_item(symbol))
        {
            self.found = true;
        }
    }
}

impl<'a> VisitMut<'a> for Codegen<'a, '_> {
    fn visit_statements(&mut self, statements: &mut ArenaVec<'a, Statement<'a>>) {
        let old = statements.take_in(self.ast);
        let mut out = self.ast.vec_from(Vec::with_capacity(old.len()));
        // `$async(X);` tags of hoisted async component declarations: at the start of the scope
        // (after the imports), so they run before anything in it can render `X`.
        let mut tags = Vec::new();
        for mut statement in old {
            if let Some((statement, tag)) = self.async_component_statement(&mut statement) {
                out.push(statement);
                tags.extend(tag);
                continue;
            }
            match &mut statement {
                Statement::ReturnStatement(ret)
                    if ret.argument.as_ref().is_some_and(|a| {
                        Self::is_jsx_root(a) || is_jsx_like(a) || self.returns_list(a)
                    }) =>
                {
                    let argument = ret.argument.take().expect("checked");
                    let compiled = self.compile_return(argument);
                    out.extend(compiled.setup);
                    ret.argument = Some(compiled.value);
                    out.push(statement);
                }
                Statement::VariableDeclaration(decl)
                    if decl.declarations.len() == 1
                        && decl.declarations[0]
                            .init
                            .as_ref()
                            .is_some_and(Self::is_jsx_root) =>
                {
                    let declarator = &mut decl.declarations[0];
                    self.visit_binding_pattern(&mut declarator.id);
                    let init = declarator.init.take().expect("checked");
                    let compiled = self.compile_value(init);
                    out.extend(compiled.setup);
                    declarator.init = Some(compiled.value);
                    out.push(statement);
                }
                _ => {
                    self.visit_statement(&mut statement);
                    out.push(statement);
                }
            }
        }
        if !tags.is_empty() {
            let at = out
                .iter()
                .take_while(|s| matches!(s, Statement::ImportDeclaration(_)))
                .count();
            out.splice(at..at, tags);
        }
        *statements = out;
    }

    fn visit_expression(&mut self, expr: &mut Expression<'a>) {
        match expr {
            Expression::AwaitExpression(await_expr) => {
                let site = self.await_site(await_expr.span.start);
                walk_mut::walk_expression(self, expr);
                if let Some(site) = site {
                    self.rewrite_await(expr, site);
                }
            }
            Expression::ArrowFunctionExpression(arrow)
                if arrow.r#async && self.is_async_component(arrow.span.start) =>
            {
                walk_mut::walk_expression(self, expr);
                let function = expr.take_in(self.ast);
                *expr = self.tag_async(function);
            }
            Expression::FunctionExpression(function)
                if function.r#async && self.is_async_component(function.span.start) =>
            {
                walk_mut::walk_expression(self, expr);
                let function = expr.take_in(self.ast);
                *expr = self.tag_async(function);
            }
            Expression::JSXElement(_) | Expression::JSXFragment(_) => {
                let span = expr.span();
                let taken = expr.take_in(self.ast);
                *expr = self.compile_value(taken).into_expression(self.ast, span);
            }
            Expression::Identifier(ident) => {
                if let Some(replacement) = self.rewrite_identifier(ident) {
                    *expr = replacement;
                }
            }
            Expression::BinaryExpression(_) if !self.maps.is_empty() => {
                if let Some(replacement) = self.rewrite_selector(expr) {
                    *expr = replacement;
                } else {
                    walk_mut::walk_expression(self, expr);
                }
            }
            _ => walk_mut::walk_expression(self, expr),
        }
    }

    fn visit_statement(&mut self, statement: &mut Statement<'a>) {
        self.visit_statement_lowering(statement);
    }

    fn visit_object_property(&mut self, property: &mut ObjectProperty<'a>) {
        if property.shorthand
            && let Expression::Identifier(ident) = &property.value
            && self.rewrites_identifier(ident)
        {
            property.shorthand = false;
        }
        walk_mut::walk_object_property(self, property);
    }

    fn visit_function(&mut self, func: &mut Function<'a>, flags: ScopeFlags) {
        let component = self.analysis.component_at(func.span.start).cloned();
        let Some(component) = component else {
            let row_callback = std::mem::take(&mut self.row_callback);
            self.functions.push(row_callback);
            self.awaits.push(None);
            walk_mut::walk_function(self, func, flags);
            self.awaits.pop();
            self.functions.pop();
            return;
        };
        self.enter_component(&component, &mut func.params);
        if let Some(body) = &mut func.body {
            self.rewrite_body_props(&component, body);
            self.find_class_carriers(body);
        }
        self.functions.push(true);
        self.awaits.push(Self::await_frame(Some(&component)));
        if let Some(body) = &mut func.body {
            self.visit_function_body(body);
        }
        self.awaits.pop();
        self.functions.pop();
        let hoists = self.leave_component();
        if let Some(body) = &mut func.body {
            prepend(self.ast, &mut body.statements, hoists);
            if component.is_async {
                let statements = body.statements.take_in(self.ast);
                body.statements = self.wrap_async_body(body.span, statements);
            }
        }
    }

    fn visit_arrow_function_expression(&mut self, arrow: &mut ArrowFunctionExpression<'a>) {
        let component = self.analysis.component_at(arrow.span.start).cloned();
        if let Some(component) = &component {
            self.enter_component(component, &mut arrow.params);
            if let ArrowFunctionBody::FunctionBody(body) = &mut arrow.body {
                self.rewrite_body_props(component, body);
                self.find_class_carriers(body);
            }
        } else {
            self.visit_formal_parameters(&mut arrow.params);
        }
        let row_callback = std::mem::take(&mut self.row_callback);
        self.functions.push(component.is_some() || row_callback);
        self.awaits.push(Self::await_frame(component.as_ref()));
        let span = arrow.span;
        let body = arrow.body.take_in(self.ast);
        arrow.body = match body {
            ArrowFunctionBody::FunctionBody(mut body) => {
                self.visit_function_body(&mut body);
                ArrowFunctionBody::FunctionBody(body)
            }
            expression => {
                let expression = expression.into_expression();
                let compiled = if (component.is_some() || row_callback)
                    && (is_jsx_like(&expression) || self.returns_list(&expression))
                {
                    self.compile_return(expression)
                } else if Self::is_jsx_root(&expression) {
                    self.compile_value(expression)
                } else {
                    Compiled::value(self.visited(expression))
                };
                if compiled.setup.is_empty() {
                    ArrowFunctionBody::from(compiled.value)
                } else {
                    let mut statements = compiled.setup;
                    statements.push(self.ast.ret(span, compiled.value));
                    ArrowFunctionBody::new_function_body(
                        span,
                        self.ast.vec(),
                        self.ast.vec_from(statements),
                        self.ast,
                    )
                }
            }
        };
        self.awaits.pop();
        self.functions.pop();
        if let Some(component) = &component
            && component.is_async
        {
            // `async (p) => expr` becomes a block body so that it can be wrapped.
            let body = arrow.body.take_in(self.ast);
            arrow.body = match body {
                ArrowFunctionBody::FunctionBody(mut body) => {
                    let statements = body.statements.take_in(self.ast);
                    body.statements = self.wrap_async_body(span, statements);
                    ArrowFunctionBody::FunctionBody(body)
                }
                expression => {
                    let statements = self
                        .ast
                        .vec_from([self.ast.ret(span, expression.into_expression())]);
                    let statements = self.wrap_async_body(span, statements);
                    ArrowFunctionBody::new_function_body(span, self.ast.vec(), statements, self.ast)
                }
            };
        }
        if component.is_some() {
            let hoists = self.leave_component();
            if !hoists.is_empty() {
                let body = arrow.body.take_in(self.ast);
                arrow.body = match body {
                    ArrowFunctionBody::FunctionBody(mut body) => {
                        prepend(self.ast, &mut body.statements, hoists);
                        ArrowFunctionBody::FunctionBody(body)
                    }
                    expression => {
                        let mut statements = hoists;
                        statements.push(self.ast.ret(span, expression.into_expression()));
                        ArrowFunctionBody::new_function_body(
                            span,
                            self.ast.vec(),
                            self.ast.vec_from(statements),
                            self.ast,
                        )
                    }
                };
            }
        }
    }
}

/// Inserts `statements` at the start of a body.
fn prepend<'a>(
    ast: &Ast<'a>,
    body: &mut ArenaVec<'a, Statement<'a>>,
    statements: Vec<Statement<'a>>,
) {
    if statements.is_empty() {
        return;
    }
    let old = body.take_in(ast);
    let mut out = ast.vec_from(statements);
    out.extend(old);
    *body = out;
}

/// Clones a user expression keeping its semantic ids (so it can be resolved and rewritten).
pub fn clone_expression<'a>(ast: &Ast<'a>, expr: &Expression<'a>) -> Expression<'a> {
    expr.clone_in_with_semantic_ids(oxc_allocator::GetAllocator::allocator(ast))
}
