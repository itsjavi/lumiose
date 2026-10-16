//! Analysis on the type-stripped AST: components, their props shapes and await sites, and the
//! diagnostics that need the AST (LUM2001-LUM2005, plus `<style>` placement inside callbacks and
//! conditionals, LUM3010, which the scanner cannot see).

pub mod browser_globals;
mod components;
pub mod reactivity;

use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_span::GetSpan;
use oxc_syntax::scope::{ScopeFlags, ScopeId};
use oxc_syntax::symbol::SymbolId;

pub use components::{is_component_name, is_jsx_like, property_key_name};
use reactivity::{
    PropsSymbols, first_reactive_read, is_import_member, server_only_imports, symbol_of,
};

use crate::diagnostics::{Code, Diagnostic};
use crate::scanner::{Placement, StyleBlock};
use crate::span::Span;

/// A component found in the module.
#[derive(Debug, Clone)]
pub struct Component {
    pub name: String,
    /// The function's span (also its lookup key).
    pub span: Span,
    pub scope: Option<ScopeId>,
    pub is_async: bool,
    pub exported: bool,
    /// The props bindings, or `None` when the parameter shape is not rewritable.
    pub props: Option<PropsSymbols>,
    /// Declarators of the body that destructure the props object and are rewritten like a
    /// destructured parameter ([`components::component_props`]).
    pub body_props: Vec<Span>,
    /// The default export of a route module rendered only on the server
    /// ([`crate::CompileOptions::server_route`]): its props are plain values, never reactive reads.
    pub server_props: bool,
    /// `await` expressions whose nearest function is the component, in source order
    /// (the static site indices of TASK-15's await rewrite).
    pub await_sites: Vec<Span>,
}

#[derive(Debug, Default)]
pub struct Analysis {
    pub components: Vec<Component>,
    pub diagnostics: Vec<Diagnostic>,
    /// Module-level `const` array literals that are never mutated: their rows never move, so a
    /// `.map()` index over them is stable (no LUM2006).
    pub constant_arrays: HashSet<SymbolId>,
    by_span: HashMap<u32, usize>,
}

impl Analysis {
    /// The component whose function starts at `span_start`.
    pub fn component_at(&self, span_start: u32) -> Option<&Component> {
        self.by_span.get(&span_start).map(|&i| &self.components[i])
    }
}

/// Analyses a type-stripped program. `scanner_diagnostics` avoids duplicate LUM3010 reports;
/// `is_server_only` tells whether an import specifier names a server-only module. `server_route`:
/// the module is a route module rendered only on the server, whose default export's props are
/// plain values.
pub fn analyze(
    program: &Program<'_>,
    scoping: &Scoping,
    blocks: &[StyleBlock],
    scanner_diagnostics: &[Diagnostic],
    is_server_only: impl Fn(&str) -> bool,
    server_route: bool,
) -> Analysis {
    let jsx_blocks = blocks
        .iter()
        .filter(|block| matches!(block.placement, Placement::InJsx { .. }) && !block.svg)
        .filter(|block| {
            !scanner_diagnostics.iter().any(|d| {
                matches!(d.code, Code::MisplacedStyle | Code::StyleAsRootOrExpression)
                    && block.span.start <= d.span.start
                    && d.span.end <= block.span.end
            })
        })
        .map(|block| block.span)
        .collect();
    let mut analyzer = Analyzer {
        scoping,
        jsx_blocks,
        analysis: Analysis::default(),
        frames: Vec::new(),
        pending: None,
        exported_names: HashSet::new(),
        component_symbols: HashSet::new(),
        component_imports: HashSet::new(),
        signals: HashSet::new(),
        server_only: server_only_imports(program, is_server_only),
        component_calls: Vec::new(),
        server_route,
        default_name: server_route.then(|| default_export_name(program)).flatten(),
    };
    analyzer.visit_program(program);
    let mut analysis = analyzer.finish();
    analysis.constant_arrays = constant_arrays(program, scoping);
    analysis
}

/// Array methods that reorder, add or remove elements.
const MUTATING_METHODS: [&str; 9] = [
    "copyWithin",
    "fill",
    "pop",
    "push",
    "reverse",
    "shift",
    "sort",
    "splice",
    "unshift",
];

/// See [`Analysis::constant_arrays`]: `const X = [...]` at the top level, never reassigned, and
/// never written through (`X[i] = …`, `X.length = 0`, `delete X[i]`, `X.push(…)`, …).
fn constant_arrays(program: &Program<'_>, scoping: &Scoping) -> HashSet<SymbolId> {
    let mut candidates = HashSet::new();
    for statement in &program.body {
        let declaration = match statement {
            Statement::VariableDeclaration(declaration) => declaration,
            Statement::ExportDeclaration(export) => match &export.declaration {
                Declaration::VariableDeclaration(declaration) => declaration,
                _ => continue,
            },
            _ => continue,
        };
        if declaration.kind != VariableDeclarationKind::Const {
            continue;
        }
        for declarator in &declaration.declarations {
            if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                (&declarator.id, &declarator.init)
                && matches!(init.without_parentheses(), Expression::ArrayExpression(_))
                && let Some(symbol) = id.symbol_id.get()
                && !scoping.symbol_is_mutated(symbol)
            {
                candidates.insert(symbol);
            }
        }
    }
    if candidates.is_empty() {
        return candidates;
    }
    let mut finder = ArrayWrites {
        scoping,
        written: HashSet::new(),
    };
    finder.visit_program(program);
    candidates.retain(|symbol| !finder.written.contains(symbol));
    candidates
}

struct ArrayWrites<'s> {
    scoping: &'s Scoping,
    written: HashSet<SymbolId>,
}

impl ArrayWrites<'_> {
    /// Records the array a member expression writes through (`X[i]`, `X.length`).
    fn member_target(&mut self, object: &Expression<'_>) {
        if let Expression::Identifier(ident) = object.without_parentheses()
            && let Some(symbol) = symbol_of(self.scoping, ident)
        {
            self.written.insert(symbol);
        }
    }

    fn simple_target(&mut self, target: &SimpleAssignmentTarget<'_>) {
        match target {
            SimpleAssignmentTarget::StaticMemberExpression(member) => {
                self.member_target(&member.object)
            }
            SimpleAssignmentTarget::ComputedMemberExpression(member) => {
                self.member_target(&member.object)
            }
            _ => {}
        }
    }
}

impl<'a> Visit<'a> for ArrayWrites<'_> {
    fn visit_assignment_expression(&mut self, it: &AssignmentExpression<'a>) {
        if let Some(target) = it.left.as_simple_assignment_target() {
            self.simple_target(target);
        }
        walk::walk_assignment_expression(self, it);
    }

    fn visit_update_expression(&mut self, it: &UpdateExpression<'a>) {
        self.simple_target(&it.argument);
        walk::walk_update_expression(self, it);
    }

    fn visit_unary_expression(&mut self, it: &UnaryExpression<'a>) {
        if it.operator == UnaryOperator::Delete
            && let Some(member) = it.argument.as_member_expression()
        {
            self.member_target(member.object());
        }
        walk::walk_unary_expression(self, it);
    }

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        if let Expression::StaticMemberExpression(member) = it.callee.without_parentheses()
            && MUTATING_METHODS.contains(&member.property.name.as_str())
        {
            self.member_target(&member.object);
        }
        walk::walk_call_expression(self, it);
    }
}

struct Pending {
    name: String,
    exported: bool,
    symbol: Option<SymbolId>,
}

#[derive(Default)]
struct Frame {
    /// Set on the frame of a component's own function.
    component: Option<usize>,
    /// Depth of JSX `{…}` containers / attribute values entered in this function.
    jsx_depth: u32,
    /// Depth of conditional / logical expressions entered in this function.
    cond_depth: u32,
    /// Symbols referenced inside JSX (component frames only).
    jsx_refs: HashSet<SymbolId>,
    /// LUM2001 candidates: (symbols, span, name).
    stale: Vec<(Vec<SymbolId>, Span, String)>,
    /// LUM2005: spans of children inserts.
    children_inserts: Vec<Span>,
}

struct Analyzer<'s> {
    scoping: &'s Scoping,
    /// Spans of JSX-placed blocks not already reported by the scanner.
    jsx_blocks: Vec<Span>,
    analysis: Analysis,
    frames: Vec<Frame>,
    pending: Option<Pending>,
    exported_names: HashSet<String>,
    component_symbols: HashSet<SymbolId>,
    component_imports: HashSet<SymbolId>,
    signals: HashSet<SymbolId>,
    /// Imports whose calls are never reactive reads (see [`server_only_imports`]).
    server_only: HashSet<SymbolId>,
    component_calls: Vec<(Span, SymbolId, String)>,
    /// See [`analyze`].
    server_route: bool,
    /// `Page` in `export default Page` / `export { Page as default }` (server routes only).
    default_name: Option<String>,
}

impl<'s> Analyzer<'s> {
    fn finish(mut self) -> Analysis {
        for component in &mut self.analysis.components {
            if self.exported_names.contains(&component.name) {
                component.exported = true;
            }
        }
        for (span, symbol, name) in std::mem::take(&mut self.component_calls) {
            if self.component_symbols.contains(&symbol) || self.component_imports.contains(&symbol)
            {
                self.analysis.diagnostics.push(
                    Diagnostic::new(
                        Code::ComponentCalledAsFunction,
                        span,
                        format!("the component `{name}` is called as a function"),
                    )
                    .with_help(format!(
                        "Render it as JSX (`<{name} … />`): a direct call runs it without its own owner, so its effects and cleanups attach to the caller."
                    )),
                );
            }
        }
        self.analysis
            .diagnostics
            .sort_by_key(|d| (d.span.start, d.span.end));
        self.analysis
    }

    /// The innermost component frame and whether it is the current (innermost) frame.
    fn component_frame(&self) -> Option<(usize, bool)> {
        let last = self.frames.len().checked_sub(1)?;
        self.frames
            .iter()
            .enumerate()
            .rev()
            .find_map(|(i, f)| f.component.map(|c| (c, i == last)))
    }

    fn current_component(&self) -> Option<&Component> {
        let frame = self.frames.last()?;
        frame.component.map(|i| &self.analysis.components[i])
    }

    /// The current component's props bindings, as reactive reads, and the bindings whose calls
    /// are not reads: server-only imports, plus the props of a `server_props` component (plain
    /// values: `props.slug.toUpperCase()` derives nothing reactive).
    fn reactive_context(&self) -> (PropsSymbols, Cow<'_, HashSet<SymbolId>>) {
        let component = self.current_component();
        let props = component.and_then(|c| c.props.clone()).unwrap_or_default();
        if !component.is_some_and(|c| c.server_props) {
            return (props, Cow::Borrowed(&self.server_only));
        }
        let mut plain = self.server_only.clone();
        plain.extend(props.object);
        plain.extend(props.rest);
        plain.extend(props.destructured.iter().copied());
        (PropsSymbols::default(), Cow::Owned(plain))
    }

    fn enter_function(
        &mut self,
        span: oxc_span::Span,
        id: Option<&BindingIdentifier<'_>>,
        is_async: bool,
        scope: Option<ScopeId>,
        returns_jsx: bool,
        props: impl FnOnce() -> (Option<PropsSymbols>, Vec<Span>),
    ) {
        let pending = self.pending.take();
        let from_default = pending.as_ref().is_some_and(|p| p.name == "default");
        let (name, exported, symbol) = match (id, pending) {
            (Some(id), pending) => (
                id.name.to_string(),
                pending.as_ref().is_some_and(|p| p.exported),
                id.symbol_id.get(),
            ),
            (None, Some(p)) => (p.name, p.exported, p.symbol),
            (None, None) => (String::new(), false, None),
        };
        let is_component =
            returns_jsx && (is_component_name(&name) || (name == "default" && exported));
        let mut frame = Frame::default();
        if is_component {
            let index = self.analysis.components.len();
            let server_props = self.server_route
                && (from_default || self.default_name.as_deref() == Some(name.as_str()));
            let (props, body_props) = props();
            self.analysis.components.push(Component {
                name,
                span: span.into(),
                scope,
                is_async,
                exported,
                props,
                body_props,
                server_props,
                await_sites: Vec::new(),
            });
            self.analysis.by_span.insert(span.start, index);
            if let Some(symbol) = symbol {
                self.component_symbols.insert(symbol);
            }
            frame.component = Some(index);
        }
        self.frames.push(frame);
    }

    fn leave_function(&mut self) {
        let Some(frame) = self.frames.pop() else {
            return;
        };
        let Some(index) = frame.component else {
            return;
        };
        if self.analysis.components[index].is_async {
            return;
        }
        for (symbols, span, name) in frame.stale {
            if symbols.iter().any(|s| frame.jsx_refs.contains(s)) {
                self.analysis.diagnostics.push(
                    Diagnostic::new(
                        Code::StaleDerivedValue,
                        span,
                        format!("`{name}` is computed once from a reactive value, so the JSX that uses it never updates"),
                    )
                    .with_help("Derive it lazily: `const x = () => …` (called as `x()` in JSX) or `computed(() => …)`."),
                );
            }
        }
        if frame.children_inserts.len() > 1 {
            for span in &frame.children_inserts[1..] {
                self.analysis.diagnostics.push(
                    Diagnostic::new(
                        Code::ChildrenInsertedTwice,
                        *span,
                        "`children` is inserted more than once; children are created lazily and can only be placed once",
                    )
                    .with_help("Accept a render function instead (`render: () => JSX.Element`) and call it for each copy."),
                );
            }
        }
    }

    fn check_misplaced_block(&mut self, text_span: oxc_span::Span) {
        // `jsx_blocks` is sorted by start.
        let index = self
            .jsx_blocks
            .partition_point(|b| b.start < text_span.start);
        let Some(&block) = self
            .jsx_blocks
            .get(index)
            .filter(|b| b.start < text_span.end)
        else {
            return;
        };
        let reason = match self.frames.last() {
            None => Some("module-level JSX, which belongs to no component"),
            Some(frame) if frame.component.is_none() => Some(if self.component_frame().is_some() {
                "a callback or nested function (such as a `.map()` callback)"
            } else {
                "a function that is not a component"
            }),
            Some(frame) if frame.cond_depth > 0 || frame.jsx_depth > 0 => {
                Some("a conditional or a `{…}` container")
            }
            Some(_) => None,
        };
        if let Some(reason) = reason {
            self.jsx_blocks.retain(|b| *b != block);
            self.analysis.diagnostics.push(
                Diagnostic::new(
                    Code::MisplacedStyle,
                    block,
                    format!("a `<style>` block must be part of a component's static JSX; this one is inside {reason}"),
                )
                .with_help("CSS is static: keep the block in the component's static JSX (or at the module top level) and use classes for variation."),
            );
        }
    }

    fn check_stale_declarator(&mut self, declarator: &VariableDeclarator<'_>) {
        let Some((_, is_own)) = self.component_frame() else {
            return;
        };
        if !is_own {
            return;
        }
        let Some(init) = &declarator.init else {
            return;
        };
        let (props, plain) = self.reactive_context();
        let (symbols, name) = binding_symbols(&declarator.id);
        if symbols.is_empty() {
            return;
        }
        let inner = init.without_parentheses();
        let rewritten = self
            .current_component()
            .is_some_and(|c| c.body_props.contains(&declarator.span.into()));
        let destructures_props = !rewritten
            && !matches!(declarator.id, BindingPattern::BindingIdentifier(_))
            && matches!(inner, Expression::Identifier(ident)
                if symbol_of(self.scoping, ident).is_some_and(|s| props.is_props_object(s)));
        // Factory calls (`signal(props.start)`, `computed(…)`) read their arguments on purpose;
        // method calls (`props.name.toUpperCase()`) derive a value.
        let factory_call = matches!(inner, Expression::CallExpression(call)
            if matches!(call.callee.without_parentheses(), Expression::Identifier(_)));
        // So are calls on an imported module object (`Toast.createToastManager()`), unless their
        // arguments read a reactive value (`format.date(props.date)`) (TASK-401).
        let module_call = match inner {
            Expression::CallExpression(call) if is_import_member(self.scoping, &call.callee) => {
                Some(call)
            }
            _ => None,
        };
        let derived = if let Some(call) = module_call {
            call.arguments.iter().any(|argument| {
                let expr = match argument {
                    Argument::SpreadElement(spread) => &spread.argument,
                    argument => argument.to_expression(),
                };
                first_reactive_read(self.scoping, &props, &plain, expr).is_some()
            })
        } else {
            !factory_call
                && !matches!(
                    inner,
                    Expression::NewExpression(_)
                        | Expression::AwaitExpression(_)
                        | Expression::ArrowFunctionExpression(_)
                        | Expression::FunctionExpression(_)
                        | Expression::ClassExpression(_)
                        | Expression::JSXElement(_)
                        | Expression::JSXFragment(_)
                )
                && first_reactive_read(self.scoping, &props, &plain, init).is_some()
        };
        if (destructures_props || derived)
            && let Some(frame) = self.frames.last_mut()
        {
            frame.stale.push((symbols, declarator.span.into(), name));
        }
    }

    fn check_early_return(&mut self, it: &IfStatement<'_>) {
        let Some(component) = self.current_component() else {
            return;
        };
        if component.is_async {
            return;
        }
        let returns = statement_returns(&it.consequent)
            || it.alternate.as_ref().is_some_and(statement_returns);
        if !returns {
            return;
        }
        let (props, plain) = self.reactive_context();
        if let Some(read) = first_reactive_read(self.scoping, &props, &plain, &it.test) {
            self.analysis.diagnostics.push(
                Diagnostic::new(
                    Code::ReactiveEarlyReturn,
                    it.test.span().into(),
                    "this early return depends on a reactive value, but a component body runs once",
                )
                .with_label(read, "reactive read")
                .with_help("Move the condition into the returned JSX: `{cond() ? <A /> : <B />}`."),
            );
        }
    }

    fn check_signal_write(&mut self, call: &CallExpression<'_>) {
        let Expression::StaticMemberExpression(member) = call.callee.without_parentheses() else {
            return;
        };
        if !matches!(member.property.name.as_str(), "set" | "update") {
            return;
        }
        let Expression::Identifier(ident) = member.object.without_parentheses() else {
            return;
        };
        let Some(symbol) = symbol_of(self.scoping, ident) else {
            return;
        };
        if !self.signals.contains(&symbol) {
            return;
        }
        let Some((component, is_own)) = self.component_frame() else {
            return;
        };
        if !is_own {
            return;
        }
        let frame = self.frames.last().expect("component frame");
        let in_jsx = frame.jsx_depth > 0;
        let own_signal =
            self.analysis.components[component].scope == Some(self.scoping.symbol_scope_id(symbol));
        if in_jsx || !own_signal {
            self.analysis.diagnostics.push(
                Diagnostic::new(
                    Code::WriteDuringRender,
                    call.span.into(),
                    format!("`{}` is written while the component renders", ident.name),
                )
                .with_help(if in_jsx {
                    "JSX expressions are tracked computations and must not write signals; write from an event handler or an effect."
                } else {
                    "Writing shared state during setup re-runs other components mid-render; write from an event handler, `onMount` or an effect."
                }),
            );
        }
    }
}

impl<'a> Visit<'a> for Analyzer<'_> {
    fn visit_function(&mut self, it: &Function<'a>, flags: ScopeFlags) {
        let returns_jsx = it
            .body
            .as_ref()
            .is_some_and(|b| components::body_returns_jsx(b));
        let scoping = self.scoping;
        self.enter_function(
            it.span,
            it.id.as_ref(),
            it.r#async,
            it.scope_id.get(),
            returns_jsx,
            || components::component_props(&it.params, it.body.as_deref(), scoping),
        );
        walk::walk_function(self, it, flags);
        self.leave_function();
    }

    fn visit_arrow_function_expression(&mut self, it: &ArrowFunctionExpression<'a>) {
        let returns_jsx = components::arrow_returns_jsx(it);
        let scoping = self.scoping;
        let body = match &it.body {
            ArrowFunctionBody::FunctionBody(body) => Some(&**body),
            _ => None,
        };
        self.enter_function(
            it.span,
            None,
            it.r#async,
            it.scope_id.get(),
            returns_jsx,
            || components::component_props(&it.params, body, scoping),
        );
        walk::walk_arrow_function_expression(self, it);
        self.leave_function();
    }

    fn visit_class(&mut self, it: &Class<'a>) {
        self.pending = None;
        self.frames.push(Frame::default());
        walk::walk_class(self, it);
        self.frames.pop();
    }

    fn visit_variable_declarator(&mut self, it: &VariableDeclarator<'a>) {
        self.pending = None;
        self.visit_binding_pattern(&it.id);
        if let (BindingPattern::BindingIdentifier(id), Some(init)) = (&it.id, &it.init) {
            match init.without_parentheses() {
                Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) => {
                    self.pending = Some(Pending {
                        name: id.name.to_string(),
                        exported: false,
                        symbol: id.symbol_id.get(),
                    });
                }
                Expression::CallExpression(call) if matches!(&call.callee, Expression::Identifier(c) if c.name == "signal") => {
                    if let Some(symbol) = id.symbol_id.get() {
                        self.signals.insert(symbol);
                    }
                }
                _ => {}
            }
        }
        self.check_stale_declarator(it);
        if let Some(init) = &it.init {
            self.visit_expression(init);
        }
        self.pending = None;
    }

    fn visit_export_named_declaration(&mut self, it: &ExportNamedDeclaration<'a>) {
        for specifier in &it.specifiers {
            self.exported_names
                .insert(specifier.local.name().to_string());
        }
        walk::walk_export_named_declaration(self, it);
    }

    fn visit_export_declaration(&mut self, it: &ExportDeclaration<'a>) {
        let names: Vec<String> = match &it.declaration {
            Declaration::FunctionDeclaration(f) => {
                f.id.iter().map(|id| id.name.to_string()).collect()
            }
            Declaration::VariableDeclaration(v) => v
                .declarations
                .iter()
                .flat_map(|d| d.id.get_binding_identifiers())
                .map(|id| id.name.to_string())
                .collect(),
            _ => Vec::new(),
        };
        self.exported_names.extend(names);
        walk::walk_export_declaration(self, it);
    }

    fn visit_export_default_declaration(&mut self, it: &ExportDefaultDeclaration<'a>) {
        let anonymous_function = match &it.declaration {
            ExportDefaultDeclarationKind::FunctionDeclaration(f) => {
                if let Some(id) = &f.id {
                    self.exported_names.insert(id.name.to_string());
                }
                true
            }
            ExportDefaultDeclarationKind::ArrowFunctionExpression(_)
            | ExportDefaultDeclarationKind::FunctionExpression(_) => true,
            ExportDefaultDeclarationKind::Identifier(ident) => {
                self.exported_names.insert(ident.name.to_string());
                false
            }
            _ => false,
        };
        if anonymous_function {
            self.pending = Some(Pending {
                name: "default".to_owned(),
                exported: true,
                symbol: None,
            });
        }
        walk::walk_export_default_declaration(self, it);
        self.pending = None;
    }

    fn visit_import_declaration(&mut self, it: &ImportDeclaration<'a>) {
        let source = it.source.value.as_str();
        let component_source = source.starts_with('.')
            || source.starts_with('/')
            || source == "lumiose"
            || [".stsx", ".tsx", ".jsx"]
                .iter()
                .any(|ext| source.ends_with(ext));
        if !component_source {
            return;
        }
        for specifier in it.specifiers.iter().flatten() {
            let local = specifier.local();
            if is_component_name(&local.name)
                && let Some(symbol) = local.symbol_id.get()
            {
                self.component_imports.insert(symbol);
            }
        }
    }

    fn visit_if_statement(&mut self, it: &IfStatement<'a>) {
        self.check_early_return(it);
        walk::walk_if_statement(self, it);
    }

    fn visit_conditional_expression(&mut self, it: &ConditionalExpression<'a>) {
        self.visit_expression(&it.test);
        if let Some(frame) = self.frames.last_mut() {
            frame.cond_depth += 1;
        }
        self.visit_expression(&it.consequent);
        self.visit_expression(&it.alternate);
        if let Some(frame) = self.frames.last_mut() {
            frame.cond_depth -= 1;
        }
    }

    fn visit_logical_expression(&mut self, it: &LogicalExpression<'a>) {
        if let Some(frame) = self.frames.last_mut() {
            frame.cond_depth += 1;
        }
        walk::walk_logical_expression(self, it);
        if let Some(frame) = self.frames.last_mut() {
            frame.cond_depth -= 1;
        }
    }

    fn visit_jsx_expression_container(&mut self, it: &JSXExpressionContainer<'a>) {
        if let Some(frame) = self.frames.last_mut() {
            frame.jsx_depth += 1;
        }
        walk::walk_jsx_expression_container(self, it);
        if let Some(frame) = self.frames.last_mut() {
            frame.jsx_depth -= 1;
        }
    }

    fn visit_jsx_child(&mut self, it: &JSXChild<'a>) {
        if let JSXChild::ExpressionContainer(container) = it
            && let Some(expr) = container.expression.as_expression()
            && self.reads_children(expr)
            && let Some(frame) = self.frames.last_mut()
            && frame.component.is_some()
        {
            frame.children_inserts.push(container.span.into());
        }
        walk::walk_jsx_child(self, it);
    }

    fn visit_jsx_text(&mut self, it: &JSXText<'a>) {
        if !self.jsx_blocks.is_empty() {
            self.check_misplaced_block(it.span);
        }
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if let Some(frame) = self.frames.last_mut()
            && frame.component.is_some()
            && frame.jsx_depth > 0
            && let Some(symbol) = symbol_of(self.scoping, it)
        {
            frame.jsx_refs.insert(symbol);
        }
    }

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        if let Expression::Identifier(callee) = &it.callee
            && is_component_name(&callee.name)
            && let Some(symbol) = symbol_of(self.scoping, callee)
        {
            self.component_calls
                .push((it.span.into(), symbol, callee.name.to_string()));
        }
        self.check_signal_write(it);
        walk::walk_call_expression(self, it);
    }

    fn visit_await_expression(&mut self, it: &AwaitExpression<'a>) {
        if let Some(frame) = self.frames.last()
            && let Some(index) = frame.component
        {
            self.analysis.components[index]
                .await_sites
                .push(it.span.into());
        }
        walk::walk_await_expression(self, it);
    }

    fn visit_variable_declaration(&mut self, it: &VariableDeclaration<'a>) {
        if it.kind == VariableDeclarationKind::AwaitUsing
            && self
                .frames
                .last()
                .is_some_and(|frame| frame.component.is_some())
        {
            self.analysis.diagnostics.push(
                Diagnostic::new(
                    Code::AwaitUsingInComponent,
                    it.span.into(),
                    "`await using` cannot be used in a component: its disposal awaits after the body, outside the component's run",
                )
                .with_help("Move the resource into a helper `async function` and await that helper from the component."),
            );
        }
        walk::walk_variable_declaration(self, it);
    }

    fn visit_for_of_statement(&mut self, it: &ForOfStatement<'a>) {
        if it.r#await
            && let Some(frame) = self.frames.last()
            && let Some(index) = frame.component
        {
            self.analysis.components[index]
                .await_sites
                .push(it.span.into());
        }
        walk::walk_for_of_statement(self, it);
    }
}

impl Analyzer<'_> {
    fn reads_children(&self, expr: &Expression<'_>) -> bool {
        let Some(component) = self.current_component() else {
            return false;
        };
        let Some(props) = &component.props else {
            return false;
        };
        match expr.without_parentheses() {
            Expression::Identifier(ident) => {
                symbol_of(self.scoping, ident).is_some_and(|s| props.children.contains(&s))
            }
            Expression::StaticMemberExpression(member) => {
                member.property.name == "children"
                    && matches!(member.object.without_parentheses(), Expression::Identifier(obj)
                        if symbol_of(self.scoping, obj).is_some_and(|s| props.is_props_object(s)))
            }
            _ => false,
        }
    }
}

/// The symbols a declarator binds and a display name.
fn binding_symbols(pattern: &BindingPattern<'_>) -> (Vec<SymbolId>, String) {
    let mut symbols = Vec::new();
    let mut names = Vec::new();
    for id in pattern.get_binding_identifiers() {
        if let Some(symbol) = id.symbol_id.get() {
            symbols.push(symbol);
            names.push(id.name.to_string());
        }
    }
    (symbols, names.join(", "))
}

/// True when a statement returns from the enclosing function (not counting nested functions).
fn statement_returns(statement: &Statement<'_>) -> bool {
    struct Finder(bool);
    impl<'a> Visit<'a> for Finder {
        fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
        fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
        fn visit_class(&mut self, _: &Class<'a>) {}
        fn visit_return_statement(&mut self, _: &ReturnStatement<'a>) {
            self.0 = true;
        }
    }
    let mut finder = Finder(false);
    finder.visit_statement(statement);
    finder.0
}

/// The local name a module exports as `default` (`export default Page`,
/// `export { Page as default }`), if it names a binding.
fn default_export_name(program: &Program<'_>) -> Option<String> {
    program.body.iter().find_map(|statement| match statement {
        Statement::ExportDefaultDeclaration(export) => match &export.declaration {
            ExportDefaultDeclarationKind::Identifier(ident) => Some(ident.name.to_string()),
            _ => None,
        },
        Statement::ExportNamedDeclaration(export) => export
            .specifiers
            .iter()
            .find_map(|s| (s.exported.name() == "default").then(|| s.local.name().to_string())),
        _ => None,
    })
}
