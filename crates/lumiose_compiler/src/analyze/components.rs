//! Component detection (spec §4.2): a PascalCase function that returns JSX.

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_syntax::scope::ScopeFlags;

use super::reactivity::PropsSymbols;

/// `Card`, `TeamPanel`: an uppercase ASCII first letter.
pub fn is_component_name(name: &str) -> bool {
    name.chars().next().is_some_and(|c| c.is_ascii_uppercase())
}

/// True when `expr` evaluates to JSX: an element, a fragment, or a conditional / logical
/// expression with a JSX operand.
pub fn is_jsx_like(expr: &Expression<'_>) -> bool {
    match expr.without_parentheses() {
        Expression::JSXElement(_) | Expression::JSXFragment(_) => true,
        Expression::ConditionalExpression(cond) => {
            is_jsx_like(&cond.consequent) || is_jsx_like(&cond.alternate)
        }
        Expression::LogicalExpression(logical) => {
            is_jsx_like(&logical.left) || is_jsx_like(&logical.right)
        }
        _ => false,
    }
}

/// True when a function body returns JSX (not counting nested functions).
pub fn body_returns_jsx(body: &FunctionBody<'_>) -> bool {
    let mut finder = ReturnFinder { found: false };
    finder.visit_function_body(body);
    finder.found
}

pub fn arrow_returns_jsx(arrow: &ArrowFunctionExpression<'_>) -> bool {
    match &arrow.body {
        ArrowFunctionBody::FunctionBody(body) => body_returns_jsx(body),
        body => body.as_expression().is_some_and(is_jsx_like),
    }
}

struct ReturnFinder {
    found: bool,
}

impl<'a> Visit<'a> for ReturnFinder {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}
    fn visit_expression(&mut self, _: &Expression<'a>) {}

    fn visit_return_statement(&mut self, it: &ReturnStatement<'a>) {
        if it.argument.as_ref().is_some_and(is_jsx_like) {
            self.found = true;
        }
        walk::walk_return_statement(self, it);
    }
}

/// The props bindings of a component's parameter list, or `None` when the parameter shape is
/// not supported by the reactive destructuring rewrite (array patterns, computed keys, several
/// parameters).
pub fn props_symbols(params: &FormalParameters<'_>) -> Option<PropsSymbols> {
    let mut symbols = PropsSymbols::default();
    if params.rest.is_some() || params.items.len() > 1 {
        return None;
    }
    let Some(param) = params.items.first() else {
        return Some(symbols);
    };
    match &param.pattern {
        BindingPattern::BindingIdentifier(ident) => {
            symbols.object = ident.symbol_id.get();
            Some(symbols)
        }
        BindingPattern::ObjectPattern(pattern) => {
            collect_object_pattern(pattern, true, &mut symbols).then_some(symbols)
        }
        _ => None,
    }
}

fn collect_object_pattern(
    pattern: &ObjectPattern<'_>,
    top_level: bool,
    symbols: &mut PropsSymbols,
) -> bool {
    for property in &pattern.properties {
        if property.computed || property_key_name(&property.key).is_none() {
            return false;
        }
        let is_children = top_level && property_key_name(&property.key) == Some("children");
        if !collect_binding(&property.value, is_children, symbols) {
            return false;
        }
    }
    if let Some(rest) = &pattern.rest {
        if !top_level {
            return false;
        }
        let BindingPattern::BindingIdentifier(ident) = &rest.argument else {
            return false;
        };
        symbols.rest = ident.symbol_id.get();
    }
    true
}

fn collect_binding(
    pattern: &BindingPattern<'_>,
    is_children: bool,
    symbols: &mut PropsSymbols,
) -> bool {
    match pattern {
        BindingPattern::BindingIdentifier(ident) => {
            if let Some(symbol) = ident.symbol_id.get() {
                symbols.destructured.insert(symbol);
                if is_children {
                    symbols.children = Some(symbol);
                }
            }
            true
        }
        BindingPattern::AssignmentPattern(assign) => {
            collect_binding(&assign.left, is_children, symbols)
        }
        BindingPattern::ObjectPattern(pattern) => collect_object_pattern(pattern, false, symbols),
        BindingPattern::ArrayPattern(_) => false,
    }
}

/// The static name of an object key (`a`, `"a"`, `"aria-label"`), if it has one.
pub fn property_key_name<'b>(key: &'b PropertyKey<'_>) -> Option<&'b str> {
    match key {
        PropertyKey::StaticIdentifier(ident) => Some(ident.name.as_str()),
        PropertyKey::StringLiteral(lit) => Some(lit.value.as_str()),
        _ => None,
    }
}
