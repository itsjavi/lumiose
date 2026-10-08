//! Class passthrough (spec §4.6.2, TASK-75): an element whose class value may carry the
//! component's `props.class` also gets the parent's scope (`applyScope(el, props.$$scope)`, or
//! the scope attributes on the server), so the parent's scoped selectors match it.
//!
//! The value may carry it when it reads `props.class` (or `props[key]`), passes `props` itself
//! (`class={variantClass(props)}`), reads a destructured `class` prop, the rest of a destructured
//! props parameter, or a binding of the component whose value does, transitively
//! (`const classes = () => ["btn", props.class]`). Applying the scope to an element that ends up
//! without the passed class only lets the parent's selectors match it if they match its classes
//! anyway, so the analysis errs on the side of applying it.

use std::collections::{HashMap, HashSet};

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::SymbolId;

use super::props::PropPath;
use crate::analyze::reactivity::symbol_of;

/// Whether an expression may carry the component's `class` prop.
pub(super) struct ClassFlow<'s, 'a> {
    /// The props object's name.
    pub props_name: &'s str,
    /// Destructured props (before the rewrite to `props.<key>`): those under `class` carry it.
    pub props: &'s HashMap<SymbolId, PropPath<'a>>,
    /// Bindings of the component that may carry it.
    pub carriers: &'s HashSet<SymbolId>,
    pub scoping: &'s Scoping,
    pub found: bool,
}

impl ClassFlow<'_, '_> {
    pub fn check(mut self, expr: &Expression<'_>) -> bool {
        self.visit_expression(expr);
        self.found
    }

    fn is_props(&self, expr: &Expression<'_>) -> bool {
        matches!(expr.without_parentheses(), Expression::Identifier(ident) if ident.name == self.props_name)
    }
}

impl<'a> Visit<'a> for ClassFlow<'_, '_> {
    fn visit_static_member_expression(&mut self, it: &StaticMemberExpression<'a>) {
        if self.is_props(&it.object) {
            self.found |= it.property.name == "class";
            return;
        }
        walk::walk_static_member_expression(self, it);
    }

    fn visit_computed_member_expression(&mut self, it: &ComputedMemberExpression<'a>) {
        if self.is_props(&it.object) {
            self.found |=
                !matches!(&it.expression, Expression::StringLiteral(key) if key.value != "class");
            self.visit_expression(&it.expression);
            return;
        }
        walk::walk_computed_member_expression(self, it);
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if it.name == self.props_name {
            // `props` itself, passed on (`variantClass(props)`, `{ ...props }`).
            self.found = true;
            return;
        }
        if let Some(symbol) = symbol_of(self.scoping, it) {
            self.found |= self.carriers.contains(&symbol)
                || self
                    .props
                    .get(&symbol)
                    .is_some_and(|path| path.first_key() == Some("class"));
        }
    }
}

/// The bindings of a component body that may carry its `class` prop: variables and functions
/// whose value or body may (see [`ClassFlow`]), and assigned variables, to a fixpoint. `carriers`
/// holds the initial ones (the rest of a destructured props parameter).
pub(super) fn carriers(
    body: &FunctionBody<'_>,
    props_name: &str,
    props: &HashMap<SymbolId, PropPath<'_>>,
    scoping: &Scoping,
    mut carriers: HashSet<SymbolId>,
) -> HashSet<SymbolId> {
    loop {
        let mut pass = Carriers {
            props_name,
            props,
            scoping,
            carriers: &mut carriers,
            changed: false,
        };
        pass.visit_function_body(body);
        if !pass.changed {
            return carriers;
        }
    }
}

struct Carriers<'s, 'a> {
    props_name: &'s str,
    props: &'s HashMap<SymbolId, PropPath<'a>>,
    scoping: &'s Scoping,
    carriers: &'s mut HashSet<SymbolId>,
    changed: bool,
}

impl Carriers<'_, '_> {
    fn flows(&self, visit: impl FnOnce(&mut ClassFlow<'_, '_>)) -> bool {
        let mut flow = ClassFlow {
            props_name: self.props_name,
            props: self.props,
            carriers: self.carriers,
            scoping: self.scoping,
            found: false,
        };
        visit(&mut flow);
        flow.found
    }

    fn mark(&mut self, symbols: impl IntoIterator<Item = SymbolId>) {
        for symbol in symbols {
            self.changed |= self.carriers.insert(symbol);
        }
    }
}

impl<'a> Visit<'a> for Carriers<'_, 'a> {
    fn visit_variable_declarator(&mut self, it: &VariableDeclarator<'a>) {
        if let Some(init) = &it.init
            && self.flows(|flow| flow.visit_expression(init))
        {
            let symbols: Vec<_> = it
                .id
                .get_binding_identifiers()
                .iter()
                .filter_map(|ident| ident.symbol_id.get())
                .collect();
            self.mark(symbols);
        }
        walk::walk_variable_declarator(self, it);
    }

    fn visit_function(&mut self, it: &Function<'a>, flags: ScopeFlags) {
        if let Some(symbol) = it.id.as_ref().and_then(|id| id.symbol_id.get())
            && !self.carriers.contains(&symbol)
            && let Some(body) = &it.body
            && self.flows(|flow| flow.visit_function_body(body))
        {
            self.mark([symbol]);
        }
        walk::walk_function(self, it, flags);
    }

    fn visit_assignment_expression(&mut self, it: &AssignmentExpression<'a>) {
        if let AssignmentTarget::AssignmentTargetIdentifier(target) = &it.left
            && let Some(symbol) = symbol_of(self.scoping, target)
            && !self.carriers.contains(&symbol)
            && self.flows(|flow| flow.visit_expression(&it.right))
        {
            self.mark([symbol]);
        }
        walk::walk_assignment_expression(self, it);
    }
}
