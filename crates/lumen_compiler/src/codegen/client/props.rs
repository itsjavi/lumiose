//! Reactive props destructuring (decision-7, spec §4.2): `function C({ a, b = 1, ...rest })`
//! becomes `function C(props)`; reads of `a` become `props.a`, reads of `b` become
//! `(props.b === undefined ? 1 : props.b)` and `rest` becomes `restProps(props, ["a", "b"])`.

use std::collections::{HashMap, HashSet};

use oxc_allocator::TakeIn;
use oxc_ast::ast::*;
use oxc_span::Span;
use oxc_syntax::operator::BinaryOperator;
use oxc_syntax::scope::ScopeId;
use oxc_syntax::symbol::SymbolId;

use super::{Codegen, ComponentCtx, clone_expression};
use crate::analyze::{Component, property_key_name};
use crate::codegen::ast::Ast;

/// How a destructured prop is read: `props.key1.key2…`, each step with an optional default.
pub struct PropPath<'a> {
    segments: Vec<(String, Option<Expression<'a>>)>,
}

impl PropPath<'_> {
    /// The prop it reads (`class` for `{ class: cls }`).
    pub fn first_key(&self) -> Option<&str> {
        self.segments.first().map(|(key, _)| key.as_str())
    }
}

struct Collected<'a> {
    props: HashMap<SymbolId, PropPath<'a>>,
    keys: Vec<String>,
    rest: Option<String>,
    rest_symbol: Option<SymbolId>,
}

impl<'a> Codegen<'a, '_> {
    /// Rewrites the component's parameter and pushes its context.
    pub(super) fn enter_component(
        &mut self,
        component: &Component,
        params: &mut FormalParameters<'a>,
    ) {
        let mut ctx = ComponentCtx {
            name: component.name.clone(),
            scope: component.scope,
            props_name: "props".to_owned(),
            props: HashMap::new(),
            class_carriers: HashSet::new(),
            setup_hoists: Vec::new(),
        };
        let pattern = params.items.first().map(|p| &p.pattern);
        match pattern {
            Some(BindingPattern::BindingIdentifier(ident)) => {
                ctx.props_name = ident.name.to_string();
            }
            Some(BindingPattern::ObjectPattern(_)) if component.props.is_some() => {
                if let Some(collected) = self.take_props_pattern(params) {
                    let span = params.span;
                    ctx.props_name = self.props_name(component.scope);
                    ctx.props = collected.props;
                    // `...rest` carries `class` unless it is destructured on its own.
                    if !collected.keys.iter().any(|key| key == "class") {
                        ctx.class_carriers.extend(collected.rest_symbol);
                    }
                    params.items = self.ast.vec_from([self.ast.param(span, &ctx.props_name)]);
                    if let Some(rest) = collected.rest {
                        let callee = self.runtime("restProps", span);
                        let keys = collected
                            .keys
                            .iter()
                            .map(|k| self.ast.string(span, k))
                            .collect::<Vec<_>>();
                        let call = self.ast.call(
                            span,
                            callee,
                            [
                                self.ast.ident(span, &ctx.props_name),
                                self.ast.array(span, keys),
                            ],
                        );
                        ctx.setup_hoists
                            .push(self.ast.const_decl(span, &rest, call));
                    }
                }
            }
            _ => {}
        }
        if ctx.props.is_empty() {
            self.visit_formal_parameters_of(params);
        }
        self.components.push(ctx);
    }

    fn visit_formal_parameters_of(&mut self, params: &mut FormalParameters<'a>) {
        oxc_ast_visit::VisitMut::visit_formal_parameters(self, params);
    }

    /// Pops the component context; returns the statements to prepend to its body.
    pub(super) fn leave_component(&mut self) -> Vec<Statement<'a>> {
        self.components
            .pop()
            .map(|ctx| ctx.setup_hoists)
            .unwrap_or_default()
    }

    /// `props`, unless a binding named `props` is visible in the component (then a fresh name).
    fn props_name(&mut self, scope: Option<ScopeId>) -> String {
        let scoping = self.scoping;
        let conflict = scoping.root_unresolved_references().contains_key("props")
            || self.props_symbols.iter().any(|&symbol| {
                scope.is_none_or(|scope| {
                    let declared = scoping.symbol_scope_id(symbol);
                    declared == scope
                        || scoping.scope_is_descendant_of(declared, scope)
                        || scoping.scope_is_descendant_of(scope, declared)
                })
            });
        if conflict {
            self.names.fresh("_props")
        } else {
            "props".to_owned()
        }
    }

    /// Takes the destructuring pattern out of the parameter list when every binding can be
    /// rewritten (no array patterns, computed keys or reassigned bindings).
    fn take_props_pattern(&mut self, params: &mut FormalParameters<'a>) -> Option<Collected<'a>> {
        let param = params.items.first_mut()?;
        let BindingPattern::ObjectPattern(pattern) = &param.pattern else {
            return None;
        };
        if !self.pattern_is_rewritable(pattern) {
            return None;
        }
        let BindingPattern::ObjectPattern(pattern) = param.pattern.take_in(self.ast) else {
            unreachable!("checked above");
        };
        let mut collected = Collected {
            props: HashMap::new(),
            keys: Vec::new(),
            rest: None,
            rest_symbol: None,
        };
        let pattern = pattern.unbox();
        for property in pattern.properties {
            let key = property_key_name(&property.key)?.to_owned();
            collected.keys.push(key.clone());
            collect(self.ast, vec![], key, property.value, &mut collected.props);
        }
        if let Some(rest) = pattern.rest
            && let BindingPattern::BindingIdentifier(ident) = &rest.argument
        {
            collected.rest = Some(ident.name.to_string());
            collected.rest_symbol = ident.symbol_id.get();
        }
        Some(collected)
    }

    fn pattern_is_rewritable(&self, pattern: &ObjectPattern<'a>) -> bool {
        let mut ok = true;
        let mut check = |ident: &BindingIdentifier<'a>| {
            if ident
                .symbol_id
                .get()
                .is_none_or(|symbol| self.scoping.symbol_is_mutated(symbol))
            {
                ok = false;
            }
        };
        for property in &pattern.properties {
            if property.computed || property_key_name(&property.key).is_none() {
                return false;
            }
            if !nested_ok(&property.value) {
                return false;
            }
            for ident in property.value.get_binding_identifiers() {
                check(ident);
            }
        }
        if let Some(rest) = &pattern.rest
            && !matches!(rest.argument, BindingPattern::BindingIdentifier(_))
        {
            return false;
        }
        ok
    }

    /// True when `ident` is a destructured prop or a list index that is rewritten.
    pub(super) fn rewrites_identifier(&self, ident: &IdentifierReference<'a>) -> bool {
        self.symbol_of(ident).is_some_and(|symbol| {
            self.components
                .iter()
                .any(|c| c.props.contains_key(&symbol))
                || self.maps.iter().any(|m| m.index == Some(symbol))
        })
    }

    /// `a` → `props.a` (with defaults); a list index `i` → `i()`.
    pub(super) fn rewrite_identifier(
        &mut self,
        ident: &IdentifierReference<'a>,
    ) -> Option<Expression<'a>> {
        let symbol = self.symbol_of(ident)?;
        let span = ident.span;
        if self.maps.iter().any(|m| m.index == Some(symbol)) {
            let callee = self.ast.ident(span, &ident.name);
            return Some(self.ast.call(span, callee, []));
        }
        let component = self
            .components
            .iter()
            .rposition(|c| c.props.contains_key(&symbol))?;
        let props_name = self.components[component].props_name.clone();
        let segments: Vec<(String, Option<Expression<'a>>)> = self.components[component].props
            [&symbol]
            .segments
            .iter()
            .map(|(key, default)| {
                (
                    key.clone(),
                    default.as_ref().map(|d| clone_expression(self.ast, d)),
                )
            })
            .collect();
        Some(self.prop_access(&props_name, segments, span))
    }

    fn prop_access(
        &mut self,
        props_name: &str,
        segments: Vec<(String, Option<Expression<'a>>)>,
        span: Span,
    ) -> Expression<'a> {
        let mut expr = self.ast.ident(span, props_name);
        for (key, default) in segments {
            let member = self.ast.member(span, expr, &key);
            expr = match default {
                None => member,
                Some(default) => {
                    let default = self.visited(default);
                    let test = self.ast.binary(
                        span,
                        clone_expression(self.ast, &member),
                        BinaryOperator::StrictEquality,
                        self.ast.undefined(span),
                    );
                    self.ast.conditional(span, test, default, member)
                }
            };
        }
        expr
    }
}

fn nested_ok(pattern: &BindingPattern<'_>) -> bool {
    match pattern {
        BindingPattern::BindingIdentifier(_) => true,
        BindingPattern::AssignmentPattern(assign) => nested_ok(&assign.left),
        BindingPattern::ObjectPattern(object) => {
            object.rest.is_none()
                && object.properties.iter().all(|p| {
                    !p.computed && property_key_name(&p.key).is_some() && nested_ok(&p.value)
                })
        }
        BindingPattern::ArrayPattern(_) => false,
    }
}

fn collect<'a>(
    ast: &Ast<'a>,
    prefix: Vec<(String, Option<Expression<'a>>)>,
    key: String,
    pattern: BindingPattern<'a>,
    out: &mut HashMap<SymbolId, PropPath<'a>>,
) {
    let (pattern, default) = match pattern {
        BindingPattern::AssignmentPattern(assign) => {
            let assign = assign.unbox();
            (assign.left, Some(assign.right))
        }
        other => (other, None),
    };
    let mut segments = prefix;
    segments.push((key, default));
    match pattern {
        BindingPattern::BindingIdentifier(ident) => {
            if let Some(symbol) = ident.symbol_id.get() {
                out.insert(symbol, PropPath { segments });
            }
        }
        BindingPattern::ObjectPattern(object) => {
            for property in object.unbox().properties {
                let Some(key) = property_key_name(&property.key).map(str::to_owned) else {
                    continue;
                };
                let prefix = segments
                    .iter()
                    .map(|(k, d)| (k.clone(), d.as_ref().map(|d| clone_expression(ast, d))))
                    .collect();
                collect(ast, prefix, key, property.value, out);
            }
        }
        _ => {}
    }
}
