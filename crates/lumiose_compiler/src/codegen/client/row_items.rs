//! Keyed rows (decision-83, TASK-554): the key alone decides whether a row is kept, so a kept row's
//! item can change in place. On the client the row callback of a keyed list receives the row, whose
//! `v` getter reads its current item, and the compiler makes the callback's reads of the item
//! reactive, the way it treats props: `item` becomes `item.v`, and the bindings of a destructured
//! item, `({ id, label })`, become `_item.v.id` and `_item.v.label`. JSX bindings and effects that
//! read them re-run when the item changes. The server gets plain items.
//!
//! Setup code reads the item once: a `const` at the top of the row that the JSX uses keeps the
//! first value (LUM2001), as an early return on the item keeps the first branch (LUM2003, a
//! warning as for props, decision-77). Reads of the key itself (`const id = row.id` with
//! `key={row.id}`) never go stale: a different value makes a different row. Both are reported on
//! both targets.

use std::collections::{HashMap, HashSet};

use oxc_allocator::TakeIn;
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::SymbolId;

use super::element::attribute_name;
use super::rows::{ItemPath, KeyPlan, RowParams, callback_params, item_path};
use super::{Codegen, clone_expression};
use crate::analyze::property_key_name;
use crate::diagnostics::{Code, Diagnostic, Severity};

/// One step of a destructured item binding's path.
pub enum Segment {
    Key(String),
    Index(usize),
}

/// How a row callback reads its item.
pub enum ItemAccess<'a> {
    /// Unkeyed lists and the server: a plain value.
    Plain,
    /// A keyed row whose item pattern cannot stay live: the pattern is read once from the row
    /// (`let { a, ...rest } = _item.v`), and LUM2001 says so.
    Snapshot,
    /// `(item) => …`: reads of `item` become `item.v`.
    Accessor(SymbolId),
    /// `({ id }) => …` becomes `(_item) => …`: reads of `id` become `_item.v.id`.
    Paths {
        accessor: String,
        paths: HashMap<SymbolId, Vec<(Segment, Option<Expression<'a>>)>>,
    },
}

impl<'a> Codegen<'a, '_> {
    /// Whether `symbol` is the item (or an item binding) of a keyed row on the client.
    pub(super) fn reads_item(&self, symbol: SymbolId) -> bool {
        self.maps.iter().any(|map| match &map.access {
            ItemAccess::Accessor(item) => *item == symbol,
            ItemAccess::Paths { paths, .. } => paths.contains_key(&symbol),
            ItemAccess::Plain | ItemAccess::Snapshot => false,
        })
    }

    /// A read of a keyed row's item: `item.v`, or `_item.v.id` for a destructured binding.
    pub(super) fn rewrite_item_read(
        &mut self,
        symbol: SymbolId,
        ident: &IdentifierReference<'a>,
    ) -> Option<Expression<'a>> {
        let span = ident.span;
        let (accessor, segments) = self.maps.iter().rev().find_map(|map| match &map.access {
            ItemAccess::Accessor(item) if *item == symbol => {
                Some((ident.name.to_string(), Vec::new()))
            }
            ItemAccess::Paths { accessor, paths } => paths.get(&symbol).map(|segments| {
                let segments: Vec<(Segment, Option<Expression<'a>>)> = segments
                    .iter()
                    .map(|(segment, default)| {
                        let segment = match segment {
                            Segment::Key(key) => Segment::Key(key.clone()),
                            Segment::Index(index) => Segment::Index(*index),
                        };
                        (
                            segment,
                            default.as_ref().map(|d| clone_expression(self.ast, d)),
                        )
                    })
                    .collect();
                (accessor.clone(), segments)
            }),
            _ => None,
        })?;
        let mut expr = self.ast.member(span, self.ast.ident(span, &accessor), "v");
        for (segment, default) in segments {
            let member = match segment {
                Segment::Key(key) => self.ast.member(span, expr, &key),
                Segment::Index(index) => self.ast.index(span, expr, index),
            };
            expr = match default {
                None => member,
                Some(default) => {
                    let default = self.visited(default);
                    let test = self.ast.binary(
                        span,
                        clone_expression(self.ast, &member),
                        oxc_syntax::operator::BinaryOperator::StrictEquality,
                        self.ast.undefined(span),
                    );
                    self.ast.conditional(span, test, default, member)
                }
            };
        }
        Some(expr)
    }

    /// Why a keyed row's item parameter cannot stay live (its bindings would be read once), if it
    /// cannot: a reassigned binding, a rest element, a computed key or a default for the item.
    fn item_pattern_blocker(&self, pattern: &BindingPattern<'a>) -> Option<&'static str> {
        if let BindingPattern::AssignmentPattern(_) = pattern {
            return Some("a default for the whole item");
        }
        let mut reason = None;
        check_item_pattern(pattern, &mut reason);
        if reason.is_some() {
            return reason;
        }
        let reassigned = pattern.get_binding_identifiers().iter().any(|ident| {
            ident
                .symbol_id
                .get()
                .is_none_or(|symbol| self.scoping.symbol_is_mutated(symbol))
        });
        reassigned.then_some(if matches!(pattern, BindingPattern::BindingIdentifier(_)) {
            "the item reassigned in the callback"
        } else {
            "a binding reassigned in the callback"
        })
    }

    /// Client, keyed lists: rewrites the callback's item parameter for the row it receives.
    pub(super) fn item_access(&mut self, callback: &mut Expression<'a>) -> ItemAccess<'a> {
        let blocked = callback_params(callback)
            .items
            .first()
            .is_some_and(|param| self.item_pattern_blocker(&param.pattern).is_some());
        let params = match callback {
            Expression::ArrowFunctionExpression(arrow) => &mut arrow.params,
            Expression::FunctionExpression(function) => &mut function.params,
            _ => return ItemAccess::Plain,
        };
        let Some(param) = params.items.first_mut() else {
            return ItemAccess::Plain;
        };
        if let BindingPattern::BindingIdentifier(ident) = &param.pattern
            && !blocked
        {
            return ident
                .symbol_id
                .get()
                .map_or(ItemAccess::Plain, ItemAccess::Accessor);
        }
        let span = param.span;
        let accessor = self.names.fresh("_item");
        let pattern = std::mem::replace(
            &mut param.pattern,
            BindingPattern::new_binding_identifier(span, self.ast.str(&accessor), self.ast),
        );
        if blocked {
            let init = self.ast.member(span, self.ast.ident(span, &accessor), "v");
            let declarator =
                VariableDeclarator::new(span, pattern, None, Some(init), false, self.ast);
            let declaration = Statement::new_variable_declaration(
                span,
                VariableDeclarationKind::Let,
                self.ast.vec_from([declarator]),
                false,
                self.ast,
            );
            prepend_statement(self, callback, declaration);
            return ItemAccess::Snapshot;
        }
        let mut paths = HashMap::new();
        collect_paths(self, pattern, Vec::new(), &mut paths);
        ItemAccess::Paths { accessor, paths }
    }

    /// LUM2001 and LUM2003 for a keyed row (both targets): setup code that reads the row's item
    /// once, when the JSX uses what it read, and early returns that depend on the item.
    pub(super) fn check_row_reads(
        &mut self,
        callback: &Expression<'a>,
        params: &RowParams,
        plan: &KeyPlan,
    ) {
        let Some(param) = callback_params(callback).items.first() else {
            return;
        };
        let jsx_refs = jsx_refs(self, callback);
        if let Some(reason) = self.item_pattern_blocker(&param.pattern) {
            if params.item.iter().any(|symbol| jsx_refs.contains(symbol)) {
                self.diagnostics.push(
                    Diagnostic::new(
                        Code::StaleDerivedValue,
                        param.span.into(),
                        format!("the item of this keyed row is destructured with {reason}, so its bindings are read once and keep the first value when the item changes in place"),
                    )
                    .with_help("Destructure named fields only (`({ id, label }) => …`), or take the item (`(item) => …`) and read `item.label` where it is used."),
                );
            }
            return;
        }
        let mut checker = RowSetup {
            codegen: self,
            item: &params.item,
            stable: plan.stable.as_ref(),
            locals: HashMap::new(),
            stale: Vec::new(),
            returns: Vec::new(),
        };
        match callback {
            Expression::ArrowFunctionExpression(arrow) => {
                if let ArrowFunctionBody::FunctionBody(body) = &arrow.body {
                    checker.visit_function_body(body);
                }
            }
            Expression::FunctionExpression(function) => {
                if let Some(body) = &function.body {
                    checker.visit_function_body(body);
                }
            }
            _ => {}
        }
        let (stale, returns) = (checker.stale, checker.returns);
        for (symbols, span, name) in stale {
            if !symbols.iter().any(|symbol| jsx_refs.contains(symbol)) {
                continue;
            }
            self.diagnostics.push(
                Diagnostic::new(
                    Code::StaleDerivedValue,
                    span.into(),
                    format!("`{name}` is read once from the row's item, so the JSX that uses it keeps the first value when the item changes in place"),
                )
                .with_help("A keyed row keeps its DOM when its item is a new object with the same key: read the item where it is used (`{item.name}`), derive lazily (`const name = () => format(item.name)`, called as `name()`), or put the field in the key to make a new row when it changes."),
            );
        }
        for (test, read, local) in returns {
            let mut diagnostic = Diagnostic::new(
                Code::ReactiveEarlyReturn,
                test.into(),
                "this early return depends on the row's item, but a keyed row renders once: it does not re-run when the item changes in place",
            )
            .with_severity(Severity::Warning)
            .with_label(read.into(), "item read")
            .with_help("Move the condition into the returned element (`<li key={item.id}>{item.done ? <Done /> : <Todo />}</li>`), or put the field in the key (`key={`${item.id}:${item.done}`}`) to make a new row when it changes.");
            if let Some(local) = local {
                diagnostic = diagnostic.with_label(local.into(), "derived here");
            }
            self.diagnostics.push(diagnostic);
        }
    }

    /// Whether a declarator's value is made on purpose from its arguments, so it is no stale copy:
    /// a call of one of `lumiose`'s APIs (`signal(item.done)`, `untrack(…)`).
    fn calls_lumiose(&self, init: &Expression<'a>) -> bool {
        matches!(init.without_parentheses(), Expression::CallExpression(call)
            if matches!(call.callee.without_parentheses(), Expression::Identifier(callee)
                if self.symbol_of(callee).and_then(|s| self.bindings.import_source(s)) == Some("lumiose")))
    }
}

/// Sets `reason` when an item pattern has a rest element or a computed key.
fn check_item_pattern(pattern: &BindingPattern<'_>, reason: &mut Option<&'static str>) {
    match pattern {
        BindingPattern::BindingIdentifier(_) => {}
        BindingPattern::AssignmentPattern(assign) => check_item_pattern(&assign.left, reason),
        BindingPattern::ObjectPattern(object) => {
            if object.rest.is_some() {
                *reason = Some("a rest element");
                return;
            }
            for property in &object.properties {
                if property.computed || property_key_name(&property.key).is_none() {
                    *reason = Some("a computed key");
                    return;
                }
                check_item_pattern(&property.value, reason);
            }
        }
        BindingPattern::ArrayPattern(array) => {
            if array.rest.is_some() {
                *reason = Some("a rest element");
                return;
            }
            for element in array.elements.iter().flatten() {
                check_item_pattern(element, reason);
            }
        }
    }
}

/// The access paths of a rewritable item pattern's bindings.
fn collect_paths<'a>(
    codegen: &Codegen<'a, '_>,
    pattern: BindingPattern<'a>,
    prefix: Vec<(Segment, Option<Expression<'a>>)>,
    out: &mut HashMap<SymbolId, Vec<(Segment, Option<Expression<'a>>)>>,
) {
    let copy =
        |prefix: &[(Segment, Option<Expression<'a>>)]| -> Vec<(Segment, Option<Expression<'a>>)> {
            prefix
                .iter()
                .map(|(segment, default)| {
                    let segment = match segment {
                        Segment::Key(key) => Segment::Key(key.clone()),
                        Segment::Index(index) => Segment::Index(*index),
                    };
                    (
                        segment,
                        default.as_ref().map(|d| clone_expression(codegen.ast, d)),
                    )
                })
                .collect()
        };
    let step = |segment: Segment, pattern: BindingPattern<'a>| match pattern {
        BindingPattern::AssignmentPattern(assign) => {
            let assign = assign.unbox();
            (segment, Some(assign.right), assign.left)
        }
        pattern => (segment, None, pattern),
    };
    match pattern {
        BindingPattern::BindingIdentifier(ident) => {
            if let Some(symbol) = ident.symbol_id.get() {
                out.insert(symbol, prefix);
            }
        }
        BindingPattern::ObjectPattern(object) => {
            for property in object.unbox().properties {
                let Some(key) = property_key_name(&property.key).map(str::to_owned) else {
                    continue;
                };
                let (segment, default, pattern) = step(Segment::Key(key), property.value);
                let mut path = copy(&prefix);
                path.push((segment, default));
                collect_paths(codegen, pattern, path, out);
            }
        }
        BindingPattern::ArrayPattern(array) => {
            for (index, element) in array.unbox().elements.into_iter().enumerate() {
                let Some(element) = element else {
                    continue;
                };
                let (segment, default, pattern) = step(Segment::Index(index), element);
                let mut path = copy(&prefix);
                path.push((segment, default));
                collect_paths(codegen, pattern, path, out);
            }
        }
        BindingPattern::AssignmentPattern(_) => {}
    }
}

/// Inserts `statement` at the start of the callback's body (an expression body becomes a block).
fn prepend_statement<'a>(
    codegen: &Codegen<'a, '_>,
    callback: &mut Expression<'a>,
    statement: Statement<'a>,
) {
    let ast = codegen.ast;
    let body = match callback {
        Expression::ArrowFunctionExpression(arrow) => {
            let span = arrow.span;
            if let ArrowFunctionBody::FunctionBody(body) = &mut arrow.body {
                &mut **body
            } else {
                let expression = arrow.body.take_in(ast).into_expression();
                let statements = ast.vec_from([statement, ast.ret(expression.span(), expression)]);
                arrow.body = ArrowFunctionBody::new_function_body(span, ast.vec(), statements, ast);
                return;
            }
        }
        Expression::FunctionExpression(function) => match &mut function.body {
            Some(body) => &mut **body,
            None => return,
        },
        _ => return,
    };
    body.statements.insert(0, statement);
}

/// The bindings the callback's JSX reads (in `{…}` containers and spreads, outside nested
/// functions), as LUM2001 counts uses in a component.
fn jsx_refs(codegen: &Codegen<'_, '_>, callback: &Expression<'_>) -> HashSet<SymbolId> {
    let mut collector = JsxRefs {
        codegen,
        depth: 0,
        found: HashSet::new(),
    };
    match callback {
        Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
            ArrowFunctionBody::FunctionBody(body) => collector.visit_function_body(body),
            body => {
                if let Some(expr) = body.as_expression() {
                    collector.visit_expression(expr);
                }
            }
        },
        Expression::FunctionExpression(function) => {
            if let Some(body) = &function.body {
                collector.visit_function_body(body);
            }
        }
        _ => {}
    }
    collector.found
}

struct JsxRefs<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    depth: u32,
    found: HashSet<SymbolId>,
}

impl<'a> Visit<'a> for JsxRefs<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_jsx_expression_container(&mut self, it: &JSXExpressionContainer<'a>) {
        self.depth += 1;
        walk::walk_jsx_expression_container(self, it);
        self.depth -= 1;
    }

    fn visit_jsx_spread_attribute(&mut self, it: &JSXSpreadAttribute<'a>) {
        self.depth += 1;
        walk::walk_jsx_spread_attribute(self, it);
        self.depth -= 1;
    }

    fn visit_jsx_spread_child(&mut self, it: &JSXSpreadChild<'a>) {
        self.depth += 1;
        walk::walk_jsx_spread_child(self, it);
        self.depth -= 1;
    }

    /// The key is computed by the key function, from the current item: never stale.
    fn visit_jsx_attribute(&mut self, it: &JSXAttribute<'a>) {
        if attribute_name(&it.name) != "key" {
            walk::walk_jsx_attribute(self, it);
        }
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if self.depth > 0
            && let Some(symbol) = self.codegen.symbol_of(it)
        {
            self.found.insert(symbol);
        }
    }
}

/// Walks a keyed row's setup code (outside nested functions): declarators that copy the item,
/// and early returns that depend on it.
struct RowSetup<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    item: &'c [SymbolId],
    stable: Option<&'c ItemPath>,
    /// Locals derived from the item, by their declarator (LUM2003 follows them).
    locals: HashMap<SymbolId, Span>,
    /// LUM2001 candidates: (bindings, declarator, names).
    stale: Vec<(Vec<SymbolId>, Span, String)>,
    /// LUM2003: (condition, item read, derived local).
    returns: Vec<(Span, Span, Option<Span>)>,
}

impl<'a> RowSetup<'_, 'a, '_> {
    /// The first item read in `exprs` that is not the key, and the derived local it goes through.
    fn item_read<'e>(
        &self,
        exprs: impl IntoIterator<Item = &'e Expression<'a>>,
        through_locals: bool,
    ) -> Option<(Span, Option<Span>)>
    where
        'a: 'e,
    {
        let empty = HashMap::new();
        let mut finder = ItemReads {
            codegen: self.codegen,
            item: self.item,
            stable: self.stable,
            locals: if through_locals { &self.locals } else { &empty },
            found: None,
        };
        for expr in exprs {
            finder.visit_expression(expr);
            if finder.found.is_some() {
                break;
            }
        }
        finder.found
    }

    fn early_return<'e>(
        &mut self,
        span: Span,
        conditions: impl IntoIterator<Item = &'e Expression<'a>>,
    ) where
        'a: 'e,
    {
        if let Some((read, local)) = self.item_read(conditions, true) {
            self.returns.push((span, read, local));
        }
    }
}

impl<'a> Visit<'a> for RowSetup<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_variable_declarator(&mut self, it: &VariableDeclarator<'a>) {
        walk::walk_variable_declarator(self, it);
        let Some(init) = &it.init else {
            return;
        };
        let inner = init.without_parentheses();
        let made = matches!(
            inner,
            Expression::NewExpression(_)
                | Expression::AwaitExpression(_)
                | Expression::ArrowFunctionExpression(_)
                | Expression::FunctionExpression(_)
                | Expression::ClassExpression(_)
                | Expression::JSXElement(_)
                | Expression::JSXFragment(_)
        ) || self.codegen.calls_lumiose(init);
        if made {
            return;
        }
        let symbols: Vec<SymbolId> = it
            .id
            .get_binding_identifiers()
            .iter()
            .filter_map(|ident| ident.symbol_id.get())
            .collect();
        if symbols.is_empty() {
            return;
        }
        if self.item_read([init], true).is_some() {
            for &symbol in &symbols {
                self.locals.insert(symbol, it.span);
            }
        }
        if self.item_read([init], false).is_some() {
            let names = it
                .id
                .get_binding_identifiers()
                .iter()
                .map(|ident| ident.name.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            self.stale.push((symbols, it.span, names));
        }
    }

    fn visit_if_statement(&mut self, it: &IfStatement<'a>) {
        if returns(&it.consequent) || it.alternate.as_ref().is_some_and(returns) {
            self.early_return(it.test.span(), [&it.test]);
        }
        walk::walk_if_statement(self, it);
    }

    fn visit_switch_statement(&mut self, it: &SwitchStatement<'a>) {
        if it
            .cases
            .iter()
            .any(|case| case.consequent.iter().any(returns))
        {
            let tests = it.cases.iter().filter_map(|case| case.test.as_ref());
            self.early_return(
                it.discriminant.span(),
                std::iter::once(&it.discriminant).chain(tests),
            );
        }
        walk::walk_switch_statement(self, it);
    }
}

/// Finds the first read of a keyed row's item that is not its key (outside nested functions and
/// JSX, whose bindings are live), or of a local derived from one.
struct ItemReads<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    item: &'c [SymbolId],
    stable: Option<&'c ItemPath>,
    locals: &'c HashMap<SymbolId, Span>,
    found: Option<(Span, Option<Span>)>,
}

impl<'a> Visit<'a> for ItemReads<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}
    fn visit_jsx_element(&mut self, _: &JSXElement<'a>) {}
    fn visit_jsx_fragment(&mut self, _: &JSXFragment<'a>) {}

    fn visit_expression(&mut self, expr: &Expression<'a>) {
        if self.found.is_some() {
            return;
        }
        if let Some((symbol, keys)) = item_path(self.codegen, expr, self.item) {
            let stable = self.stable.is_some_and(|(root, prefix)| {
                *root == symbol && keys.len() >= prefix.len() && keys[..prefix.len()] == prefix[..]
            });
            if !stable {
                self.found = Some((expr.span(), None));
            }
            return;
        }
        walk::walk_expression(self, expr);
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if self.found.is_none()
            && let Some(&local) = self.codegen.symbol_of(it).and_then(|s| self.locals.get(&s))
        {
            self.found = Some((it.span, Some(local)));
        }
    }
}

/// True when a statement returns from the enclosing function (not counting nested functions).
fn returns(statement: &Statement<'_>) -> bool {
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
