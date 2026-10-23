//! Heuristics for "reads a reactive value" used by the reactivity diagnostics (LUM2001-LUM2003).
//!
//! A read is reactive when it is, outside nested functions:
//! - a zero-argument call of a local or imported binding (`count()`, `user.name()`), which is how
//!   signals, computeds and ref accessors are read; calls of unresolved globals (`Date.now()`) are
//!   not, nor are calls of server-only bindings ([`server_only_imports`]: `lumiose`'s request APIs
//!   and imports of server-only modules), which are plain values wherever they can run;
//! - a member read of the component's props object or its `...rest` (`props.title`);
//! - a reference to a destructured prop (`title` from `({ title })`).
//!
//! The first kind is a [`ReadKind::Signal`] read and the others are [`ReadKind::Prop`] reads:
//! a prop changes only when the component renders in the browser and its parent passes a value
//! that changes, which the compiler cannot see from the component (decision-77).

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_span::GetSpan;
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::{SymbolFlags, SymbolId};
use std::collections::{HashMap, HashSet};

use crate::span::Span;

/// What a reactive read reads. Ordered by strength: a signal read is reactive wherever the
/// component renders, a prop read only when a parent passes a changing value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReadKind {
    /// `props.kind`, a destructured prop, or a local derived from them.
    Prop,
    /// A zero-argument call (`count()`, `props.user()`), or a local derived from one.
    Signal,
}

/// A reactive read: where it is and what it reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Read {
    pub span: Span,
    pub kind: ReadKind,
    /// The declarator of the derived local it reads through ([`DerivedLocals`]), if any.
    pub local: Option<Span>,
}

/// Locals of a component body declared from a reactive value (`const kind = props.kind`): the
/// strongest kind of read their value derives from, and their declarator.
pub type DerivedLocals = HashMap<SymbolId, (ReadKind, Span)>;

/// The props bindings of one component.
#[derive(Debug, Clone, Default)]
pub struct PropsSymbols {
    /// `props` in `function C(props)`.
    pub object: Option<SymbolId>,
    /// Bindings destructured from the props parameter, or from the props object in the
    /// component body (`const { title } = props`, TASK-348).
    pub destructured: HashSet<SymbolId>,
    /// `rest` in `({ a, ...rest })` and in `const { a, ...rest } = props`.
    pub rest: HashSet<SymbolId>,
    /// The destructured `children` bindings.
    pub children: HashSet<SymbolId>,
    /// The `rest` bindings whose pattern takes `children` out (`{ children, ...rest }`).
    pub rest_without_children: HashSet<SymbolId>,
}

impl PropsSymbols {
    pub fn is_props_object(&self, symbol: SymbolId) -> bool {
        self.object == Some(symbol) || self.rest.contains(&symbol)
    }

    /// Whether `symbol` is a props object that still carries `children`.
    pub fn carries_children(&self, symbol: SymbolId) -> bool {
        self.is_props_object(symbol) && !self.rest_without_children.contains(&symbol)
    }
}

/// Resolves an identifier reference to its symbol (`None` for globals and unresolved names).
pub fn symbol_of(scoping: &Scoping, ident: &IdentifierReference<'_>) -> Option<SymbolId> {
    let reference_id = ident.reference_id.get()?;
    scoping.get_reference(reference_id).symbol_id()
}

/// The root identifier of a member chain (`a` in `a.b.c`, `a.b()` callee).
pub fn root_identifier<'b, 'a>(expr: &'b Expression<'a>) -> Option<&'b IdentifierReference<'a>> {
    match expr.without_parentheses() {
        Expression::Identifier(ident) => Some(ident),
        Expression::StaticMemberExpression(member) => root_identifier(&member.object),
        Expression::ComputedMemberExpression(member) => root_identifier(&member.object),
        Expression::PrivateFieldExpression(member) => root_identifier(&member.object),
        Expression::ChainExpression(chain) => match &chain.expression {
            ChainElement::CallExpression(call) => root_identifier(&call.callee),
            ChainElement::StaticMemberExpression(member) => root_identifier(&member.object),
            ChainElement::ComputedMemberExpression(member) => root_identifier(&member.object),
            ChainElement::PrivateFieldExpression(member) => root_identifier(&member.object),
            ChainElement::TSNonNullExpression(_) => None,
        },
        Expression::CallExpression(call) => root_identifier(&call.callee),
        _ => None,
    }
}

/// Whether `callee` is a member of an imported module object (`Toast.createToastManager`,
/// `ns.a.b`): a static member chain whose root is an import binding.
pub fn is_import_member(scoping: &Scoping, callee: &Expression<'_>) -> bool {
    let Expression::StaticMemberExpression(member) = callee.without_parentheses() else {
        return false;
    };
    match member.object.without_parentheses() {
        Expression::Identifier(ident) => symbol_of(scoping, ident)
            .is_some_and(|s| scoping.symbol_flags(s).contains(SymbolFlags::Import)),
        object => is_import_member(scoping, object),
    }
}

/// The request APIs of `lumiose` (the app layer). They read the current request during a server
/// render and throw LUM4003 in the browser; SPA routes read `url()` and `params()` from
/// `lumiose/router`, whose accessors are reactive.
const SERVER_REQUEST_APIS: [&str; 7] = [
    "cookies",
    "locals",
    "params",
    "publicEnv",
    "request",
    "response",
    "url",
];

/// `lumiose`'s control-flow APIs: they throw and never return a value (TASK-135), so
/// `getProject(slug) ?? notFound()` derives nothing reactive.
const CONTROL_FLOW_APIS: [&str; 3] = ["error", "notFound", "redirect"];

/// `lumiose`'s APIs whose calls make a value or return a constant without reading a signal, so
/// `const context = { id: useId(), open: signal() }` derives nothing reactive (TASK-349).
const CONSTANT_APIS: [&str; 5] = ["createContext", "getAbortSignal", "ref", "signal", "useId"];

/// Bindings whose calls never read a signal (TASK-86): `lumiose`'s request, control-flow and
/// constant APIs, and every import of a server-only module (`is_server_only(specifier)`), which
/// cannot reach a client graph (LUM4003).
pub fn server_only_imports(
    program: &Program<'_>,
    is_server_only: impl Fn(&str) -> bool,
) -> HashSet<SymbolId> {
    let mut symbols = HashSet::new();
    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        let source = import.source.value.as_str();
        let all = is_server_only(source);
        for specifier in import.specifiers.iter().flatten() {
            let request_api = source == "lumiose"
                && matches!(specifier, ImportDeclarationSpecifier::ImportSpecifier(s)
                    if SERVER_REQUEST_APIS.contains(&s.imported.name().as_str())
                        || CONTROL_FLOW_APIS.contains(&s.imported.name().as_str())
                        || CONSTANT_APIS.contains(&s.imported.name().as_str()));
            if (all || request_api)
                && let Some(symbol) = specifier.local().symbol_id.get()
            {
                symbols.insert(symbol);
            }
        }
    }
    symbols
}

/// Every reactive read in `expr` (outside nested functions), outermost first; a read inside
/// another one (`props.items` in `props.items()`) is left out. Calls rooted at `server_only`
/// bindings are not reads.
pub fn reactive_reads(
    scoping: &Scoping,
    props: &PropsSymbols,
    server_only: &HashSet<SymbolId>,
    expr: &Expression<'_>,
) -> Vec<Span> {
    let no_locals = DerivedLocals::new();
    find_reads(scoping, props, server_only, &no_locals, expr)
        .into_iter()
        .map(|read| read.span)
        .collect()
}

/// The first of the strongest reactive reads in `exprs`, where a reference to one of `locals`
/// reads what that local derives from.
pub fn strongest_read<'e, 'a: 'e>(
    scoping: &Scoping,
    props: &PropsSymbols,
    server_only: &HashSet<SymbolId>,
    locals: &DerivedLocals,
    exprs: impl IntoIterator<Item = &'e Expression<'a>>,
) -> Option<Read> {
    exprs
        .into_iter()
        .flat_map(|expr| find_reads(scoping, props, server_only, locals, expr))
        .reduce(|strongest, read| {
            if read.kind > strongest.kind {
                read
            } else {
                strongest
            }
        })
}

fn find_reads(
    scoping: &Scoping,
    props: &PropsSymbols,
    server_only: &HashSet<SymbolId>,
    locals: &DerivedLocals,
    expr: &Expression<'_>,
) -> Vec<Read> {
    let mut finder = ReadFinder {
        scoping,
        props,
        server_only,
        locals,
        found: Vec::new(),
    };
    finder.visit_expression(expr);
    finder.found
}

struct ReadFinder<'s> {
    scoping: &'s Scoping,
    props: &'s PropsSymbols,
    server_only: &'s HashSet<SymbolId>,
    locals: &'s DerivedLocals,
    found: Vec<Read>,
}

impl ReadFinder<'_> {
    fn hit(&mut self, span: oxc_span::Span, kind: ReadKind, local: Option<Span>) {
        let inside = self
            .found
            .last()
            .is_some_and(|last| last.span.start <= span.start && span.end <= last.span.end);
        if !inside {
            self.found.push(Read {
                span: span.into(),
                kind,
                local,
            });
        }
    }
}

impl<'a> Visit<'a> for ReadFinder<'_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if call.arguments.is_empty()
            && root_identifier(&call.callee)
                .and_then(|ident| symbol_of(self.scoping, ident))
                .is_some_and(|symbol| !self.server_only.contains(&symbol))
        {
            let (kind, local) = self.call_kind(&call.callee);
            self.hit(call.span, kind, local);
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
        if let Expression::Identifier(ident) = member.object.without_parentheses()
            && symbol_of(self.scoping, ident).is_some_and(|s| self.props.is_props_object(s))
        {
            self.hit(member.span, ReadKind::Prop, None);
        }
        walk::walk_static_member_expression(self, member);
    }

    fn visit_computed_member_expression(&mut self, member: &ComputedMemberExpression<'a>) {
        if let Expression::Identifier(ident) = member.object.without_parentheses()
            && symbol_of(self.scoping, ident).is_some_and(|s| self.props.is_props_object(s))
        {
            self.hit(member.span, ReadKind::Prop, None);
        }
        walk::walk_computed_member_expression(self, member);
    }

    fn visit_identifier_reference(&mut self, ident: &IdentifierReference<'a>) {
        let Some(symbol) = symbol_of(self.scoping, ident) else {
            return;
        };
        if self.props.destructured.contains(&symbol) {
            self.hit(ident.span(), ReadKind::Prop, None);
        } else if let Some(&(kind, local)) = self.locals.get(&symbol) {
            self.hit(ident.span(), kind, Some(local));
        }
    }
}

impl ReadFinder<'_> {
    /// What a zero-argument call reads. A method of a prop's value (`props.title.trim()`, or
    /// `title.trim()` on a destructured prop or a local derived from props) reads that prop; any
    /// other call reads a signal: `count()`, `user.name()`, an accessor prop (`props.user()`).
    fn call_kind(&self, callee: &Expression<'_>) -> (ReadKind, Option<Span>) {
        let signal = (ReadKind::Signal, None);
        let (mut object, mut depth) = match callee.without_parentheses() {
            Expression::StaticMemberExpression(member) => (&member.object, 0),
            Expression::ComputedMemberExpression(member) => (&member.object, 0),
            _ => return signal,
        };
        let ident = loop {
            match object.without_parentheses() {
                Expression::StaticMemberExpression(member) => object = &member.object,
                Expression::ComputedMemberExpression(member) => object = &member.object,
                Expression::Identifier(ident) => break ident,
                _ => return signal,
            }
            depth += 1;
        };
        let Some(symbol) = symbol_of(self.scoping, ident) else {
            return signal;
        };
        if (depth > 0 && self.props.is_props_object(symbol))
            || self.props.destructured.contains(&symbol)
        {
            return (ReadKind::Prop, None);
        }
        match self.locals.get(&symbol) {
            Some(&(ReadKind::Prop, local)) => (ReadKind::Prop, Some(local)),
            _ => signal,
        }
    }
}
