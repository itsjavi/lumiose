//! Row keys of compiled `.map()` lists (TASK-553): the `key` on the element a row callback
//! returns becomes the list's key function, `(item, index?) => key`.
//!
//! A key compiles when it reads only the item parameter (or the bindings of its destructuring
//! pattern), the index parameter, bindings it declares itself (a nested arrow's parameters, as in
//! `row.map((p) => p.id).join("|")`), plain row consts (inlined: `const id = row.id`) and bindings
//! outside the callback. A callback with several returns compiles when its returned elements carry
//! the same key. Any other key, and a key on an element the callback does not return, is LUM2008:
//! the list matches rows by reference, as without a key, and the warning says so.

use std::collections::{HashMap, HashSet};

use oxc_allocator::{CloneIn, GetAllocator};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, VisitMut, walk, walk_mut};
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::{ScopeFlags, ScopeId};
use oxc_syntax::symbol::SymbolId;

use super::element::attribute_name;
use super::{Codegen, clone_expression};
use crate::analyze::property_key_name;
use crate::codegen::ast::Ast;
use crate::diagnostics::{Code, Diagnostic};

/// The parameters of a row callback.
pub struct RowParams {
    /// The bindings of the item parameter: the identifier, or every binding of its pattern.
    pub item: Vec<SymbolId>,
    pub index: Option<SymbolId>,
}

impl RowParams {
    pub fn of(callback: &Expression<'_>) -> Self {
        let params = callback_params(callback);
        let item = params
            .items
            .first()
            .map(|param| {
                param
                    .pattern
                    .get_binding_identifiers()
                    .iter()
                    .filter_map(|ident| ident.symbol_id.get())
                    .collect()
            })
            .unwrap_or_default();
        let index = params.items.get(1).and_then(|p| match &p.pattern {
            BindingPattern::BindingIdentifier(ident) => ident.symbol_id.get(),
            _ => None,
        });
        Self { item, index }
    }
}

/// An item field path: an item binding and the static keys read from it (`row.meta.id`).
pub type ItemPath = (SymbolId, Vec<String>);

/// A row key that compiles (see [`Codegen::check_row_key`]).
pub struct KeyPlan {
    /// The key expression of the first keyed root (the others are the same text).
    expr: Span,
    /// Whether the key reads the index parameter.
    pub reads_index: bool,
    /// References to the index parameter inside the roots' keys.
    pub index_refs: usize,
    /// References to the item's bindings inside the roots' keys.
    pub item_refs: usize,
    /// The item path the key is, when it is one (`key={row.id}`, `key={id}` with `({ id })` or
    /// `const id = row.id`): a kept row's value there never changes (decision-83).
    pub stable: Option<ItemPath>,
}

/// A `key` attribute in a row callback's JSX.
struct FoundKey {
    span: Span,
    /// Whether it is on an element the callback returns.
    root: bool,
    /// The span of its expression, if its value is a non-empty `{…}`.
    expr: Option<Span>,
    /// For a root key: what its expression reads.
    refs: Option<KeyRefs>,
}

/// What a root key's expression reads.
#[derive(Default)]
struct KeyRefs {
    index_refs: usize,
    item_refs: usize,
    /// The first binding it reads that a key function cannot get.
    local: Option<(String, Span)>,
    /// The item path the expression is, if it is one.
    stable: Option<ItemPath>,
}

pub(super) fn callback_params<'b, 'a>(callback: &'b Expression<'a>) -> &'b FormalParameters<'a> {
    match callback {
        Expression::ArrowFunctionExpression(arrow) => &arrow.params,
        Expression::FunctionExpression(function) => &function.params,
        _ => unreachable!("checked by is_list"),
    }
}

impl<'a> Codegen<'a, '_> {
    /// Checks the `key` of a row callback's returned element(s), on both targets: `Some` when it
    /// compiles. LUM2008 reports a key that does not, and keys on elements the callback does not
    /// return (both would otherwise be dropped without a word).
    pub(super) fn check_row_key(
        &mut self,
        callback: &Expression<'a>,
        scope: Option<ScopeId>,
        params: &RowParams,
        row_consts: &[SymbolId],
    ) -> Option<KeyPlan> {
        let const_paths = row_const_paths(self, callback, &params.item, row_consts);
        let mut finder = KeyFinder {
            codegen: self,
            scope,
            params,
            row_consts,
            const_paths: &const_paths,
            found: Vec::new(),
        };
        match callback {
            Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
                ArrowFunctionBody::FunctionBody(body) => finder.visit_function_body(body),
                body => {
                    if let Some(expr) = body.as_expression() {
                        finder.returned(expr);
                    }
                }
            },
            Expression::FunctionExpression(function) => {
                if let Some(body) = &function.body {
                    finder.visit_function_body(body);
                }
            }
            _ => {}
        }
        let found = finder.found;
        for key in found.iter().filter(|key| !key.root) {
            self.diagnostics.push(
                Diagnostic::new(
                    Code::UnsupportedListKey,
                    key.span.into(),
                    "this `key` is not on the element the `.map()` callback returns, so the list never reads it",
                )
                .with_help("Put the key on the returned element (`items().map((item) => <li key={item.id}>…</li>)`). A conditional or a fragment cannot carry it: return one element and move the condition inside it."),
            );
        }
        let roots: Vec<&FoundKey> = found.iter().filter(|key| key.root).collect();
        let first = roots.first()?;
        let unsupported = |message: String, help: &str, span: Span| {
            Diagnostic::new(Code::UnsupportedListKey, span.into(), message).with_help(help)
        };
        let Some(expr) = first.expr else {
            self.diagnostics.push(unsupported(
                "this `key` is a constant, so every row would get the same key; the list matches rows by reference".to_owned(),
                "Compute the key from the item: `key={item.id}`.",
                first.span,
            ));
            return None;
        };
        let text = self.text_of(expr).to_owned();
        for other in &roots[1..] {
            if other.expr.is_none_or(|span| self.text_of(span) != text) {
                let diagnostic = unsupported(
                    "the elements this `.map()` callback returns have different keys, so the list ignores them and matches rows by reference".to_owned(),
                    "Give every returned element the same key, computed from the item (`key={item.id}`).",
                    other.span,
                )
                .with_label(first.span.into(), "first key");
                self.diagnostics.push(diagnostic);
                return None;
            }
        }
        let mut index_refs = 0;
        let mut item_refs = 0;
        for root in &roots {
            let refs = root.refs.as_ref().expect("root keys are checked");
            if let Some((name, span)) = &refs.local {
                self.diagnostics.push(unsupported(
                    format!("this `key` reads `{name}`, a value computed in the row callback, so the list cannot compute it and matches rows by reference"),
                    "A key function gets only the item and the index: compute the key from them (`key={item.id}`, `key={`${item.kind}:${item.id}`}`), or call a function declared outside the callback.",
                    *span,
                ));
                return None;
            }
            index_refs += refs.index_refs;
            item_refs += refs.item_refs;
        }
        let refs = first.refs.as_ref();
        Some(KeyPlan {
            expr,
            reads_index: refs.is_some_and(|refs| refs.index_refs > 0),
            index_refs,
            item_refs,
            stable: refs.and_then(|refs| refs.stable.clone()),
        })
    }

    /// Removes the `key` attribute from every element the callback returns and returns the key
    /// function `(item, index?) => key`, with row consts inlined.
    pub(super) fn take_key(
        &mut self,
        callback: &mut Expression<'a>,
        plan: &KeyPlan,
        row_consts: &[SymbolId],
    ) -> Expression<'a> {
        let definitions = row_const_values(self.ast, callback, row_consts);
        let mut taker = KeyTaker {
            expr: plan.expr,
            key: None,
        };
        match callback {
            Expression::ArrowFunctionExpression(arrow) => match &mut arrow.body {
                ArrowFunctionBody::FunctionBody(body) => taker.visit_function_body(body),
                body => {
                    if let Some(expr) = body.as_expression_mut() {
                        taker.returned(expr);
                    }
                }
            },
            Expression::FunctionExpression(function) => {
                if let Some(body) = &mut function.body {
                    taker.visit_function_body(body);
                }
            }
            _ => {}
        }
        let mut key = taker.key.expect("the planned key is on a returned element");
        if !definitions.is_empty() {
            InlineRowConsts {
                definitions: &definitions,
                codegen: self,
            }
            .visit_expression(&mut key);
        }
        let allocator = self.ast.allocator();
        let source = callback_params(callback);
        let span = key.span();
        let mut items = self.ast.vec();
        let count = if plan.reads_index { 2 } else { 1 };
        for param in source.items.iter().take(count) {
            items.push(FormalParameter::new(
                span,
                self.ast.vec(),
                param.pattern.clone_in_with_semantic_ids(allocator),
                None,
                None,
                false,
                None,
                false,
                false,
                self.ast,
            ));
        }
        let params = FormalParameters::boxed(
            span,
            FormalParameterKind::ArrowFormalParameters,
            items,
            None,
            self.ast,
        );
        let body = self.visited(key);
        Expression::new_arrow_function_expression(
            span,
            false,
            None,
            params,
            None,
            ArrowFunctionBody::from(body),
            self.ast,
        )
    }
}

/// Finds the `key` attributes of a row callback's JSX (outside nested functions, which are other
/// rows' callbacks or render props) and checks what the returned elements' keys read.
struct KeyFinder<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    /// The callback's scope.
    scope: Option<ScopeId>,
    params: &'c RowParams,
    row_consts: &'c [SymbolId],
    /// The item paths that row consts copy.
    const_paths: &'c HashMap<SymbolId, ItemPath>,
    found: Vec<FoundKey>,
}

impl<'a> KeyFinder<'_, 'a, '_> {
    /// A returned value: its root element's key is the row key.
    fn returned(&mut self, expr: &Expression<'a>) {
        let Expression::JSXElement(element) = expr.without_parentheses() else {
            self.visit_expression(expr);
            return;
        };
        let key = element
            .opening_element
            .attributes
            .iter()
            .find_map(|item| match item {
                JSXAttributeItem::Attribute(attribute)
                    if attribute_name(&attribute.name) == "key" =>
                {
                    Some(attribute)
                }
                _ => None,
            });
        if let Some(attribute) = key {
            let value = match &attribute.value {
                Some(JSXAttributeValue::ExpressionContainer(container)) => {
                    container.expression.as_expression()
                }
                _ => None,
            };
            let refs = value.map(|value| self.key_refs(value)).unwrap_or_default();
            self.found.push(FoundKey {
                span: attribute.span,
                root: true,
                expr: value.map(GetSpan::span),
                refs: Some(refs),
            });
        }
        for item in &element.opening_element.attributes {
            match item {
                JSXAttributeItem::Attribute(attribute)
                    if attribute_name(&attribute.name) == "key" => {}
                item => self.visit_jsx_attribute_item(item),
            }
        }
        for child in &element.children {
            self.visit_jsx_child(child);
        }
    }

    fn key_refs(&self, expr: &Expression<'a>) -> KeyRefs {
        let mut own = OwnBindings(HashSet::new());
        own.visit_expression(expr);
        let mut checker = KeyRefChecker {
            codegen: self.codegen,
            scope: self.scope,
            params: self.params,
            row_consts: self.row_consts,
            own: own.0,
            refs: KeyRefs::default(),
        };
        checker.visit_expression(expr);
        let mut refs = checker.refs;
        refs.stable = match expr.without_parentheses() {
            Expression::Identifier(ident) => self
                .codegen
                .symbol_of(ident)
                .and_then(|symbol| self.const_paths.get(&symbol))
                .cloned(),
            _ => None,
        }
        .or_else(|| item_path(self.codegen, expr, &self.params.item));
        refs
    }
}

impl<'a> Visit<'a> for KeyFinder<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_return_statement(&mut self, it: &ReturnStatement<'a>) {
        if let Some(argument) = &it.argument {
            self.returned(argument);
        }
    }

    fn visit_jsx_attribute(&mut self, it: &JSXAttribute<'a>) {
        if attribute_name(&it.name) == "key" {
            self.found.push(FoundKey {
                span: it.span,
                root: false,
                expr: None,
                refs: None,
            });
        }
        walk::walk_jsx_attribute(self, it);
    }
}

/// The bindings an expression declares (nested arrows' parameters and locals).
struct OwnBindings(HashSet<SymbolId>);

impl<'a> Visit<'a> for OwnBindings {
    fn visit_binding_identifier(&mut self, it: &BindingIdentifier<'a>) {
        self.0.extend(it.symbol_id.get());
    }
}

struct KeyRefChecker<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    scope: Option<ScopeId>,
    params: &'c RowParams,
    row_consts: &'c [SymbolId],
    own: HashSet<SymbolId>,
    refs: KeyRefs,
}

impl<'a> Visit<'a> for KeyRefChecker<'_, 'a, '_> {
    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        let Some(symbol) = self.codegen.symbol_of(it) else {
            return;
        };
        if Some(symbol) == self.params.index {
            self.refs.index_refs += 1;
            return;
        }
        if self.params.item.contains(&symbol) {
            self.refs.item_refs += 1;
            return;
        }
        if self.own.contains(&symbol) || self.row_consts.contains(&symbol) {
            return;
        }
        let declared = self.codegen.scoping.symbol_scope_id(symbol);
        if self.refs.local.is_none()
            && self
                .scope
                .is_some_and(|scope| self.codegen.scope_within(declared, scope))
        {
            self.refs.local = Some((it.name.to_string(), it.span));
        }
    }
}

/// Removes the `key` of every returned element; keeps the planned one's expression.
struct KeyTaker<'a> {
    expr: Span,
    key: Option<Expression<'a>>,
}

impl<'a> KeyTaker<'a> {
    fn returned(&mut self, expr: &mut Expression<'a>) {
        let mut expr = expr;
        while let Expression::ParenthesizedExpression(paren) = expr {
            expr = &mut paren.expression;
        }
        let Expression::JSXElement(element) = expr else {
            return;
        };
        let attributes = &mut element.opening_element.attributes;
        let Some(position) = attributes.iter().position(|item| {
            matches!(item, JSXAttributeItem::Attribute(attribute) if attribute_name(&attribute.name) == "key")
        }) else {
            return;
        };
        let JSXAttributeItem::Attribute(attribute) = attributes.remove(position) else {
            unreachable!("matched above");
        };
        if self.key.is_none()
            && let Some(JSXAttributeValue::ExpressionContainer(container)) = attribute.unbox().value
            && let Ok(value) = Expression::try_from(container.unbox().expression)
            && value.span() == self.expr
        {
            self.key = Some(value);
        }
    }
}

impl<'a> VisitMut<'a> for KeyTaker<'a> {
    fn visit_function(&mut self, _: &mut Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &mut ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &mut Class<'a>) {}
    fn visit_expression(&mut self, _: &mut Expression<'a>) {}

    fn visit_return_statement(&mut self, it: &mut ReturnStatement<'a>) {
        if let Some(argument) = &mut it.argument {
            self.returned(argument);
        }
    }
}

/// The item path `expr` is: an item binding, or a static member chain rooted at one.
pub fn item_path(
    codegen: &Codegen<'_, '_>,
    expr: &Expression<'_>,
    item: &[SymbolId],
) -> Option<ItemPath> {
    let mut keys = Vec::new();
    let mut expr = expr.without_parentheses();
    loop {
        match expr {
            Expression::StaticMemberExpression(member) if !member.optional => {
                keys.push(member.property.name.to_string());
                expr = member.object.without_parentheses();
            }
            Expression::Identifier(ident) => {
                let symbol = codegen.symbol_of(ident).filter(|s| item.contains(s))?;
                keys.reverse();
                return Some((symbol, keys));
            }
            _ => return None,
        }
    }
}

/// The item paths that the callback's row consts copy (`const id = row.id`, `const { id } = row`,
/// `const key = id`).
fn row_const_paths(
    codegen: &Codegen<'_, '_>,
    callback: &Expression<'_>,
    item: &[SymbolId],
    row_consts: &[SymbolId],
) -> HashMap<SymbolId, ItemPath> {
    let mut paths: HashMap<SymbolId, ItemPath> = HashMap::new();
    if row_consts.is_empty() {
        return paths;
    }
    let body = match callback {
        Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
            ArrowFunctionBody::FunctionBody(body) => &**body,
            _ => return paths,
        },
        Expression::FunctionExpression(function) => match &function.body {
            Some(body) => &**body,
            None => return paths,
        },
        _ => return paths,
    };
    let path_of = |paths: &HashMap<SymbolId, ItemPath>, init: &Expression<'_>| {
        if let Expression::Identifier(ident) = init.without_parentheses()
            && let Some(path) = codegen.symbol_of(ident).and_then(|s| paths.get(&s))
        {
            return Some(path.clone());
        }
        item_path(codegen, init, item)
    };
    for statement in &body.statements {
        let Statement::VariableDeclaration(declaration) = statement else {
            continue;
        };
        for declarator in &declaration.declarations {
            let Some(init) = &declarator.init else {
                continue;
            };
            match &declarator.id {
                BindingPattern::BindingIdentifier(ident) => {
                    if let Some(symbol) = ident.symbol_id.get().filter(|s| row_consts.contains(s))
                        && let Some(path) = path_of(&paths, init)
                    {
                        paths.insert(symbol, path);
                    }
                }
                BindingPattern::ObjectPattern(object) => {
                    let Some(base) = path_of(&paths, init) else {
                        continue;
                    };
                    for property in &object.properties {
                        let (Some(key), BindingPattern::BindingIdentifier(ident)) =
                            (property_key_name(&property.key), &property.value)
                        else {
                            continue;
                        };
                        if let Some(symbol) =
                            ident.symbol_id.get().filter(|s| row_consts.contains(s))
                        {
                            let mut path = base.clone();
                            path.1.push(key.to_owned());
                            paths.insert(symbol, path);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    paths
}

/// The values of the row consts declared at the top of the callback body: `row.id` for
/// `const id = row.id`, `row.label` for `text` in `const { label: text } = row`.
fn row_const_values<'a>(
    ast: &Ast<'a>,
    callback: &Expression<'a>,
    row_consts: &[SymbolId],
) -> HashMap<SymbolId, Expression<'a>> {
    let mut values = HashMap::new();
    if row_consts.is_empty() {
        return values;
    }
    let body = match callback {
        Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
            ArrowFunctionBody::FunctionBody(body) => &**body,
            _ => return values,
        },
        Expression::FunctionExpression(function) => match &function.body {
            Some(body) => &**body,
            None => return values,
        },
        _ => return values,
    };
    for statement in &body.statements {
        let Statement::VariableDeclaration(declaration) = statement else {
            continue;
        };
        for declarator in &declaration.declarations {
            let Some(init) = &declarator.init else {
                continue;
            };
            match &declarator.id {
                BindingPattern::BindingIdentifier(ident) => {
                    if let Some(symbol) = ident.symbol_id.get().filter(|s| row_consts.contains(s)) {
                        values.insert(symbol, clone_expression(ast, init));
                    }
                }
                BindingPattern::ObjectPattern(object) => {
                    for property in &object.properties {
                        let (Some(key), BindingPattern::BindingIdentifier(ident)) =
                            (property_key_name(&property.key), &property.value)
                        else {
                            continue;
                        };
                        if let Some(symbol) =
                            ident.symbol_id.get().filter(|s| row_consts.contains(s))
                        {
                            let object = clone_expression(ast, init);
                            values.insert(symbol, ast.member(ident.span, object, key));
                        }
                    }
                }
                _ => {}
            }
        }
    }
    values
}

/// Replaces references to row consts with their values (recursively: a value may read an earlier
/// row const).
struct InlineRowConsts<'c, 'a, 's> {
    definitions: &'c HashMap<SymbolId, Expression<'a>>,
    codegen: &'c Codegen<'a, 's>,
}

impl<'a> VisitMut<'a> for InlineRowConsts<'_, 'a, '_> {
    fn visit_expression(&mut self, expr: &mut Expression<'a>) {
        if let Expression::Identifier(ident) = expr
            && let Some(value) = self
                .codegen
                .symbol_of(ident)
                .and_then(|symbol| self.definitions.get(&symbol))
        {
            *expr = clone_expression(self.codegen.ast, value);
            self.visit_expression(expr);
            return;
        }
        walk_mut::walk_expression(self, expr);
    }

    fn visit_object_property(&mut self, property: &mut ObjectProperty<'a>) {
        if property.shorthand
            && let Expression::Identifier(ident) = &property.value
            && self
                .codegen
                .symbol_of(ident)
                .is_some_and(|symbol| self.definitions.contains_key(&symbol))
        {
            property.shorthand = false;
        }
        walk_mut::walk_object_property(self, property);
    }
}
