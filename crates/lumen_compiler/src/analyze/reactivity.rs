//! Heuristics for "reads a reactive value" used by the reactivity diagnostics (LUM2001-LUM2003).
//!
//! A read is reactive when it is, outside nested functions:
//! - a zero-argument call of a local or imported binding (`count()`, `user.name()`), which is how
//!   signals, computeds and ref accessors are read; calls of unresolved globals (`Date.now()`) are
//!   not;
//! - a member read of the component's props object or its `...rest` (`props.title`);
//! - a reference to a destructured prop (`title` from `({ title })`).

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_span::GetSpan;
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::SymbolId;
use std::collections::HashSet;

use crate::span::Span;

/// The props bindings of one component.
#[derive(Debug, Clone, Default)]
pub struct PropsSymbols {
    /// `props` in `function C(props)`.
    pub object: Option<SymbolId>,
    /// Bindings destructured from the props parameter.
    pub destructured: HashSet<SymbolId>,
    /// `rest` in `({ a, ...rest })`.
    pub rest: Option<SymbolId>,
    /// The destructured `children` binding, if any.
    pub children: Option<SymbolId>,
}

impl PropsSymbols {
    pub fn is_props_object(&self, symbol: SymbolId) -> bool {
        self.object == Some(symbol) || self.rest == Some(symbol)
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

/// The span of the first reactive read in `expr`, if any.
pub fn first_reactive_read(
    scoping: &Scoping,
    props: &PropsSymbols,
    expr: &Expression<'_>,
) -> Option<Span> {
    let mut finder = ReadFinder {
        scoping,
        props,
        found: None,
    };
    finder.visit_expression(expr);
    finder.found
}

struct ReadFinder<'s> {
    scoping: &'s Scoping,
    props: &'s PropsSymbols,
    found: Option<Span>,
}

impl ReadFinder<'_> {
    fn hit(&mut self, span: oxc_span::Span) {
        if self.found.is_none() {
            self.found = Some(span.into());
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
                .is_some()
        {
            self.hit(call.span);
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
        if let Expression::Identifier(ident) = member.object.without_parentheses()
            && symbol_of(self.scoping, ident).is_some_and(|s| self.props.is_props_object(s))
        {
            self.hit(member.span);
        }
        walk::walk_static_member_expression(self, member);
    }

    fn visit_computed_member_expression(&mut self, member: &ComputedMemberExpression<'a>) {
        if let Expression::Identifier(ident) = member.object.without_parentheses()
            && symbol_of(self.scoping, ident).is_some_and(|s| self.props.is_props_object(s))
        {
            self.hit(member.span);
        }
        walk::walk_computed_member_expression(self, member);
    }

    fn visit_identifier_reference(&mut self, ident: &IdentifierReference<'a>) {
        if symbol_of(self.scoping, ident).is_some_and(|s| self.props.destructured.contains(&s)) {
            self.hit(ident.span());
        }
    }
}
