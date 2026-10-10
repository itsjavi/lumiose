//! Compiled JSX idioms (decision-7, spec §4.5): `.map()` → keyed `list`, `item.key === sel()`
//! → `selector`, `cond ? <A/> : <B/>` / `cond && <A/>` → memoised `branch`.

use oxc_allocator::{CloneIn, TakeIn};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};
use oxc_syntax::operator::BinaryOperator;
use oxc_syntax::scope::{ScopeFlags, ScopeId};
use oxc_syntax::symbol::SymbolId;

use super::element::attribute_name;
use super::{Codegen, Compiled, clone_expression};
use crate::analyze::is_jsx_like;
use crate::diagnostics::{Code, Diagnostic};

/// The `.map()` callback being compiled.
pub struct MapCtx<'a> {
    pub item: Option<SymbolId>,
    pub index: Option<SymbolId>,
    pub scope: Option<ScopeId>,
    /// Row data besides the item: `const`s of the callback body initialised from row data
    /// without calls (`const id = row.id`, `const { id } = row`). Fixed per row, so selectors and
    /// data-slot handlers treat them like the item.
    pub row_consts: Vec<SymbolId>,
    /// Hoisted selectors: (source text, variable, `selector(...)` argument).
    selectors: Vec<(String, String, Expression<'a>)>,
}

/// A compiled `list(…)` call.
pub struct CompiledList<'a> {
    /// Selector declarations, emitted before the `list` call.
    pub setup: Vec<Statement<'a>>,
    pub source: Expression<'a>,
    pub render: Expression<'a>,
    pub key: Option<Expression<'a>>,
}

/// `xs.map(cb)` / `xs?.map(cb)` parts.
fn map_call<'b, 'a>(expr: &'b Expression<'a>) -> Option<&'b CallExpression<'a>> {
    let call = match expr.without_parentheses() {
        Expression::CallExpression(call) => call,
        Expression::ChainExpression(chain) => match &chain.expression {
            ChainElement::CallExpression(call) => call,
            _ => return None,
        },
        _ => return None,
    };
    let Expression::StaticMemberExpression(member) = &call.callee else {
        return None;
    };
    (member.property.name == "map" && call.arguments.len() == 1).then_some(call)
}

/// The callback's parameters and whether it renders JSX.
fn callback_shape<'b, 'a>(argument: &'b Argument<'a>) -> Option<&'b FormalParameters<'a>> {
    match argument {
        Argument::ArrowFunctionExpression(arrow) if !arrow.r#async => {
            let renders = match &arrow.body {
                ArrowFunctionBody::FunctionBody(body) => returns_jsx(body),
                body => body.as_expression().is_some_and(is_jsx_like),
            };
            renders.then_some(&*arrow.params)
        }
        Argument::FunctionExpression(function) if !function.r#async && !function.generator => {
            function
                .body
                .as_ref()
                .is_some_and(|b| returns_jsx(b))
                .then_some(&*function.params)
        }
        _ => None,
    }
}

fn returns_jsx(body: &FunctionBody<'_>) -> bool {
    body.statements.iter().any(|s| {
        matches!(s, Statement::ReturnStatement(ret) if ret.argument.as_ref().is_some_and(is_jsx_like))
    })
}

impl<'a> Codegen<'a, '_> {
    /// `{xs().map((x, i) => <Row/>)}` with a one- or two-parameter callback rendering JSX.
    pub(super) fn is_list(&self, expr: &Expression<'a>) -> bool {
        map_call(expr)
            .and_then(|call| callback_shape(&call.arguments[0]))
            .is_some_and(|params| params.rest.is_none() && (1..=2).contains(&params.items.len()))
    }

    pub(super) fn compile_list(&mut self, expr: Expression<'a>) -> CompiledList<'a> {
        let mut expr = expr;
        while let Expression::ParenthesizedExpression(paren) = expr {
            expr = paren.unbox().expression;
        }
        let mut call = match expr {
            Expression::CallExpression(call) => call.unbox(),
            Expression::ChainExpression(chain) => match chain.unbox().expression {
                ChainElement::CallExpression(call) => call.unbox(),
                _ => unreachable!("checked by is_list"),
            },
            _ => unreachable!("checked by is_list"),
        };
        let Expression::StaticMemberExpression(member) = call.callee.take_in(self.ast) else {
            unreachable!("checked by is_list")
        };
        let span = call.span;
        let object = self.visited(member.unbox().object);
        // A never-mutated module-level array literal: its rows never move (TASK-140).
        let stable_rows = matches!(object.without_parentheses(), Expression::Identifier(ident)
            if self.symbol_of(ident).is_some_and(|s| self.analysis.constant_arrays.contains(&s)));
        // The server `list` takes the array; the client tracks a source function.
        let source = if self.server() {
            object
        } else {
            self.compute(object)
        };
        let mut callback = call
            .arguments
            .pop()
            .expect("one argument")
            .into_expression();

        let (params, scope) = match &callback {
            Expression::ArrowFunctionExpression(arrow) => (&arrow.params, arrow.scope_id.get()),
            Expression::FunctionExpression(function) => (&function.params, function.scope_id.get()),
            _ => unreachable!("checked by is_list"),
        };
        let item = params.items.first().and_then(|p| match &p.pattern {
            BindingPattern::BindingIdentifier(ident) => ident.symbol_id.get(),
            _ => None,
        });
        let index = params.items.get(1).and_then(|p| match &p.pattern {
            BindingPattern::BindingIdentifier(ident) => ident.symbol_id.get(),
            _ => None,
        });
        let index_used = index.is_some_and(|i| !self.scoping.symbol_is_unused(i));
        if let Some(index) = index.filter(|_| index_used && !stable_rows) {
            self.check_index_escape(&callback, index);
        }
        // Rows are never reconciled on the server; the `key` attribute is skipped there.
        let key = if self.server() {
            None
        } else {
            self.take_key(&mut callback, scope, item)
        };

        let row_consts = self.row_consts(&callback, scope, item);
        self.maps.push(MapCtx {
            item,
            index: index.filter(|_| index_used),
            scope,
            row_consts,
            selectors: Vec::new(),
        });
        self.row_callback = true;
        self.visit_expression_in_place(&mut callback);
        self.row_callback = false;
        let map = self.maps.pop().expect("pushed above");

        if index.is_some() && !index_used {
            let params = match &mut callback {
                Expression::ArrowFunctionExpression(arrow) => &mut arrow.params,
                Expression::FunctionExpression(function) => &mut function.params,
                _ => unreachable!("checked by is_list"),
            };
            params.items.truncate(1);
        }
        let mut setup = Vec::new();
        for (_, var, source) in map.selectors {
            let callee = self.runtime("selector", span);
            let init = self.ast.call(span, callee, [source]);
            setup.push(self.ast.const_decl(span, &var, init));
        }
        CompiledList {
            setup,
            source,
            render: callback,
            key,
        }
    }

    /// The callback body's top-level `const`s that hold row data (see [`MapCtx::row_consts`]), in
    /// declaration order: an initialiser may read the item, earlier row consts and bindings outside
    /// the callback, but calls nothing and writes nothing.
    fn row_consts(
        &self,
        callback: &Expression<'a>,
        scope: Option<ScopeId>,
        item: Option<SymbolId>,
    ) -> Vec<SymbolId> {
        let mut found = Vec::new();
        let Some(item) = item else {
            return found;
        };
        let body = match callback {
            Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
                ArrowFunctionBody::FunctionBody(body) => &**body,
                _ => return found,
            },
            Expression::FunctionExpression(function) => match &function.body {
                Some(body) => &**body,
                None => return found,
            },
            _ => return found,
        };
        for statement in &body.statements {
            let Statement::VariableDeclaration(declaration) = statement else {
                continue;
            };
            if declaration.kind != VariableDeclarationKind::Const {
                continue;
            }
            for declarator in &declaration.declarations {
                let Some(init) = &declarator.init else {
                    continue;
                };
                let mut checker = RowData {
                    codegen: self,
                    scope,
                    item,
                    row_consts: &found,
                    plain: true,
                };
                checker.visit_expression(init);
                if checker.plain {
                    found.extend(plain_bindings(&declarator.id));
                }
            }
        }
        found
    }

    fn visit_expression_in_place(&mut self, expr: &mut Expression<'a>) {
        oxc_ast_visit::VisitMut::visit_expression(self, expr);
    }

    /// Removes `key={…}` from the callback's root element and returns `(item) => key`, when the
    /// key only reads the item and outer bindings.
    fn take_key(
        &mut self,
        callback: &mut Expression<'a>,
        scope: Option<ScopeId>,
        item: Option<SymbolId>,
    ) -> Option<Expression<'a>> {
        let (params, root) = match callback {
            Expression::ArrowFunctionExpression(arrow) => {
                let arrow = &mut **arrow;
                let root = match &mut arrow.body {
                    ArrowFunctionBody::FunctionBody(body) => single_return(body),
                    body => body.as_expression_mut(),
                };
                (&arrow.params, root)
            }
            Expression::FunctionExpression(function) => {
                let function = &mut **function;
                let root = function.body.as_mut().and_then(|b| single_return(b));
                (&function.params, root)
            }
            _ => return None,
        };
        let Some(Expression::JSXElement(element)) = root.map(|r| strip_parens_mut(r)) else {
            return None;
        };
        let attributes = &mut element.opening_element.attributes;
        let position = attributes.iter().position(|a| {
            matches!(a, JSXAttributeItem::Attribute(attr) if attribute_name(&attr.name) == "key")
        })?;
        let JSXAttributeItem::Attribute(attribute) = &attributes[position] else {
            return None;
        };
        let Some(JSXAttributeValue::ExpressionContainer(container)) = &attribute.value else {
            return None;
        };
        let expression = container.expression.as_expression()?;
        if !self.only_item_and_outer(expression, scope, item) {
            return None;
        }
        let key = clone_expression(self.ast, expression);
        attributes.remove(position);
        let pattern = params
            .items
            .first()?
            .pattern
            .clone_in_with_semantic_ids(oxc_allocator::GetAllocator::allocator(self.ast));
        let span = key.span();
        let body = self.visited(key);
        let param = FormalParameter::new(
            span,
            self.ast.vec(),
            pattern,
            None,
            None,
            false,
            None,
            false,
            false,
            self.ast,
        );
        let params = FormalParameters::boxed(
            span,
            FormalParameterKind::ArrowFormalParameters,
            self.ast.vec_from([param]),
            None,
            self.ast,
        );
        Some(Expression::new_arrow_function_expression(
            span,
            false,
            None,
            params,
            None,
            ArrowFunctionBody::from(body),
            self.ast,
        ))
    }

    /// True when every reference in `expr` is the item, a global, or a binding outside the
    /// callback.
    fn only_item_and_outer(
        &self,
        expr: &Expression<'a>,
        scope: Option<ScopeId>,
        item: Option<SymbolId>,
    ) -> bool {
        let mut checker = RefChecker {
            codegen: self,
            scope,
            item,
            row_data: &[],
            uses_item: false,
            uses_local: false,
            calls: false,
        };
        checker.visit_expression(expr);
        !checker.uses_local
    }

    /// LUM2006: the index is read in the row's setup code (outside JSX and closures), so the value
    /// is captured once and goes stale when rows move.
    fn check_index_escape(&mut self, callback: &Expression<'a>, index: SymbolId) {
        let body = match callback {
            Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
                ArrowFunctionBody::FunctionBody(body) => body,
                _ => return,
            },
            Expression::FunctionExpression(function) => match &function.body {
                Some(body) => body,
                None => return,
            },
            _ => return,
        };
        let mut finder = IndexEscape {
            codegen: self,
            index,
            depth: 0,
            found: Vec::new(),
        };
        finder.visit_function_body(body);
        let found = finder.found;
        let name = self.scoping.symbol_name(index).to_owned();
        for span in found {
            self.diagnostics.push(
                Diagnostic::new(
                    Code::ReactiveIndexEscapes,
                    span.into(),
                    format!("the list index `{name}` is read once here, so this value goes stale when rows move"),
                )
                .with_help(format!(
                    "Inside `.map()` the index is reactive: read it in JSX or in a closure (`{name}` is compiled to `{name}()` there)."
                )),
            );
        }
    }

    /// `item.key === sel()` (either order, also `!==`) inside a `.map()` callback → `isSelected(item.key)`.
    pub(super) fn rewrite_selector(&mut self, expr: &mut Expression<'a>) -> Option<Expression<'a>> {
        let Expression::BinaryExpression(binary) = expr else {
            return None;
        };
        if !matches!(
            binary.operator,
            BinaryOperator::StrictEquality | BinaryOperator::StrictInequality
        ) {
            return None;
        }
        let map = self.maps.last()?;
        let (scope, item, row_data) = (map.scope, map.item, &map.row_consts);
        item?;
        let left_is_key = self.is_item_key(&binary.left, scope, item, row_data)
            && self.is_selected(&binary.right, scope);
        let right_is_key = !left_is_key
            && self.is_item_key(&binary.right, scope, item, row_data)
            && self.is_selected(&binary.left, scope);
        if !left_is_key && !right_is_key {
            return None;
        }
        let span = binary.span;
        let negate = binary.operator == BinaryOperator::StrictInequality;
        let Expression::BinaryExpression(binary) = expr.take_in(self.ast) else {
            unreachable!("matched above")
        };
        let binary = binary.unbox();
        let (key, selected) = if left_is_key {
            (binary.left, binary.right)
        } else {
            (binary.right, binary.left)
        };
        let text = self.text_of(selected.span()).to_owned();
        let existing = self
            .maps
            .last()
            .and_then(|m| m.selectors.iter().find(|(t, _, _)| *t == text))
            .map(|(_, var, _)| var.clone());
        let var = match existing {
            Some(var) => var,
            None => {
                let var = self.names.fresh("_isSelected");
                let selected = self.visited(selected);
                let source = self.compute(selected);
                if let Some(map) = self.maps.last_mut() {
                    map.selectors.push((text, var.clone(), source));
                }
                var
            }
        };
        let key = self.visited(key);
        let call = self.ast.call(span, self.ast.ident(span, &var), [key]);
        Some(if negate {
            self.ast.not(span, call)
        } else {
            call
        })
    }

    fn is_item_key(
        &self,
        expr: &Expression<'a>,
        scope: Option<ScopeId>,
        item: Option<SymbolId>,
        row_data: &[SymbolId],
    ) -> bool {
        let mut checker = RefChecker {
            codegen: self,
            scope,
            item,
            row_data,
            uses_item: false,
            uses_local: false,
            calls: false,
        };
        checker.visit_expression(expr);
        checker.uses_item && !checker.uses_local && !checker.calls
    }

    fn is_selected(&self, expr: &Expression<'a>, scope: Option<ScopeId>) -> bool {
        let mut checker = RefChecker {
            codegen: self,
            scope,
            item: None,
            row_data: &[],
            uses_item: false,
            uses_local: false,
            calls: false,
        };
        checker.visit_expression(expr);
        !checker.uses_local && self.reads_reactive(expr)
    }

    /// `{cond ? <A/> : <B/>}` / `{cond && <A/>}` with a reactive condition.
    pub(super) fn is_branch(&self, expr: &Expression<'a>) -> bool {
        match expr.without_parentheses() {
            Expression::ConditionalExpression(cond) => {
                (is_jsx_like(&cond.consequent) || is_jsx_like(&cond.alternate))
                    && self.reads_reactive(&cond.test)
            }
            Expression::LogicalExpression(logical) => {
                logical.operator == oxc_syntax::operator::LogicalOperator::And
                    && is_jsx_like(&logical.right)
                    && self.reads_reactive(&logical.left)
            }
            _ => false,
        }
    }

    /// Client: `(cond, whenTrue, whenFalse?)` for `branch()`, each a function.
    pub(super) fn compile_branch(
        &mut self,
        expr: Expression<'a>,
    ) -> (Expression<'a>, Expression<'a>, Option<Expression<'a>>) {
        let (test, when_true, when_false) = self.branch_parts(expr);
        let cond = self.compute(test);
        let arrow = |this: &Self, arm: Compiled<'a>| {
            this.ast
                .arrow_returning(arm.value.span(), &[], arm.setup, arm.value)
        };
        let when_true = arrow(self, when_true);
        let when_false = when_false.map(|arm| arrow(self, arm));
        (cond, when_true, when_false)
    }

    /// Server: the condition is evaluated once, so only the chosen arm is rendered, in place:
    /// `cond ? branchArm(true, a) : branchArm(false, b)` allocates no closures (TASK-78). An arm
    /// that needs setup statements keeps `branch(cond, () => a, () => b)`.
    pub(super) fn server_branch(&mut self, expr: Expression<'a>) -> Expression<'a> {
        let span = expr.span();
        let (test, when_true, when_false) = self.branch_parts(expr);
        if when_true.setup.is_empty() && when_false.as_ref().is_none_or(|arm| arm.setup.is_empty())
        {
            let on = [self.ast.boolean(span, true), when_true.value];
            let off = std::iter::once(self.ast.boolean(span, false))
                .chain(when_false.map(|arm| arm.value));
            let callee = self.runtime("branchArm", span);
            let on = self.ast.call(span, callee, on);
            let callee = self.runtime("branchArm", span);
            let off = self.ast.call(span, callee, off);
            return self.ast.conditional(span, test, on, off);
        }
        let callee = self.runtime("branch", span);
        let mut args = vec![test];
        for arm in [Some(when_true), when_false].into_iter().flatten() {
            let arm_span = arm.value.span();
            args.push(
                self.ast
                    .arrow_returning(arm_span, &[], arm.setup, arm.value),
            );
        }
        self.ast.call(span, callee, args)
    }

    /// The visited condition and the compiled arms of a reactive conditional (`whenFalse` is
    /// `None` for `&&` and a `null` alternate). A nested reactive conditional or a list in an arm
    /// is a parentless branch/list value.
    fn branch_parts(
        &mut self,
        expr: Expression<'a>,
    ) -> (Expression<'a>, Compiled<'a>, Option<Compiled<'a>>) {
        let mut expr = expr;
        while let Expression::ParenthesizedExpression(paren) = expr {
            expr = paren.unbox().expression;
        }
        let (test, consequent, alternate) = match expr {
            Expression::ConditionalExpression(cond) => {
                let cond = cond.unbox();
                (cond.test, cond.consequent, Some(cond.alternate))
            }
            Expression::LogicalExpression(logical) => {
                let logical = logical.unbox();
                (logical.left, logical.right, None)
            }
            _ => unreachable!("checked by is_branch"),
        };
        let test = self.visited(test);
        let when_true = self.compile_arm(consequent);
        let when_false = alternate
            .filter(|a| !matches!(a.without_parentheses(), Expression::NullLiteral(_)))
            .map(|a| self.compile_arm(a));
        (test, when_true, when_false)
    }

    /// A renderable that stays live without a parent element (doc-2 §2): a reactive conditional →
    /// `branchValue(cond, () => a, () => b)`, a `.map()` rendering JSX →
    /// `listValue(source, render, key?)`. Used where `branch`/`list` have no element to anchor
    /// to: component children, fragments, nested ternaries and returned values. The server emits
    /// its `branch`/`list` there, whose island markers are the regions these ranges hydrate.
    /// `Err` gives back anything else.
    pub(super) fn live_value(
        &mut self,
        expr: Expression<'a>,
    ) -> Result<Compiled<'a>, Expression<'a>> {
        let span = expr.span();
        let server = self.server();
        if self.is_list(&expr) {
            let list = self.compile_list(expr);
            let callee = self.runtime(if server { "list" } else { "listValue" }, span);
            let mut args = vec![list.source, list.render];
            args.extend(list.key);
            return Ok(Compiled {
                setup: list.setup,
                value: self.ast.call(span, callee, args),
            });
        }
        if self.is_branch(&expr) {
            if server {
                return Ok(Compiled::value(self.server_branch(expr)));
            }
            let (cond, when_true, when_false) = self.compile_branch(expr);
            let callee = self.runtime("branchValue", span);
            let mut args = vec![cond, when_true];
            args.extend(when_false);
            return Ok(Compiled::value(self.ast.call(span, callee, args)));
        }
        Err(expr)
    }

    /// A conditional's arm: live when it is itself a reactive conditional or a list.
    pub(super) fn compile_arm(&mut self, arm: Expression<'a>) -> Compiled<'a> {
        match self.live_value(arm) {
            Ok(compiled) => compiled,
            Err(arm) => self.compile_value(arm),
        }
    }

    /// True when `scope` is `ancestor` or nested inside it.
    pub(super) fn scope_within(&self, scope: ScopeId, ancestor: ScopeId) -> bool {
        scope == ancestor || self.scoping.scope_is_descendant_of(scope, ancestor)
    }
}

fn single_return<'b, 'a>(body: &'b mut FunctionBody<'a>) -> Option<&'b mut Expression<'a>> {
    let returns = body
        .statements
        .iter()
        .filter(|s| matches!(s, Statement::ReturnStatement(_)))
        .count();
    if returns != 1 {
        return None;
    }
    body.statements.iter_mut().find_map(|s| match s {
        Statement::ReturnStatement(ret) => ret.argument.as_mut(),
        _ => None,
    })
}

fn strip_parens_mut<'b, 'a>(expr: &'b mut Expression<'a>) -> &'b mut Expression<'a> {
    match expr {
        Expression::ParenthesizedExpression(paren) => strip_parens_mut(&mut paren.expression),
        other => other,
    }
}

/// Classifies the references of an expression relative to a `.map()` callback scope.
struct RefChecker<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    scope: Option<ScopeId>,
    item: Option<SymbolId>,
    /// Row consts counted as the item (selector keys; not `key` functions, which only get the item).
    row_data: &'c [SymbolId],
    uses_item: bool,
    uses_local: bool,
    calls: bool,
}

impl<'a> Visit<'a> for RefChecker<'_, 'a, '_> {
    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        let Some(symbol) = self.codegen.symbol_of(it) else {
            return;
        };
        if Some(symbol) == self.item || self.row_data.contains(&symbol) {
            self.uses_item = true;
            return;
        }
        let declared = self.codegen.scoping.symbol_scope_id(symbol);
        if self
            .scope
            .is_some_and(|scope| self.codegen.scope_within(declared, scope))
        {
            self.uses_local = true;
        }
    }

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        self.calls = true;
        walk::walk_call_expression(self, it);
    }
}

/// Whether a row const's initialiser is row data: no calls, writes or functions; references to the
/// item, earlier row consts or bindings outside the callback (not the index or other locals).
struct RowData<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    scope: Option<ScopeId>,
    item: SymbolId,
    row_consts: &'c [SymbolId],
    plain: bool,
}

impl<'a> Visit<'a> for RowData<'_, 'a, '_> {
    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        let Some(symbol) = self.codegen.symbol_of(it) else {
            return;
        };
        if symbol == self.item || self.row_consts.contains(&symbol) {
            return;
        }
        let declared = self.codegen.scoping.symbol_scope_id(symbol);
        if self
            .scope
            .is_some_and(|scope| self.codegen.scope_within(declared, scope))
        {
            self.plain = false;
        }
    }

    fn visit_call_expression(&mut self, _: &CallExpression<'a>) {
        self.plain = false;
    }
    fn visit_new_expression(&mut self, _: &NewExpression<'a>) {
        self.plain = false;
    }
    fn visit_tagged_template_expression(&mut self, _: &TaggedTemplateExpression<'a>) {
        self.plain = false;
    }
    fn visit_import_expression(&mut self, _: &ImportExpression<'a>) {
        self.plain = false;
    }
    fn visit_await_expression(&mut self, _: &AwaitExpression<'a>) {
        self.plain = false;
    }
    fn visit_yield_expression(&mut self, _: &YieldExpression<'a>) {
        self.plain = false;
    }
    fn visit_assignment_expression(&mut self, _: &AssignmentExpression<'a>) {
        self.plain = false;
    }
    fn visit_update_expression(&mut self, _: &UpdateExpression<'a>) {
        self.plain = false;
    }
    fn visit_unary_expression(&mut self, it: &UnaryExpression<'a>) {
        if it.operator == oxc_syntax::operator::UnaryOperator::Delete {
            self.plain = false;
        }
        walk::walk_unary_expression(self, it);
    }
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {
        self.plain = false;
    }
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {
        self.plain = false;
    }
    fn visit_class(&mut self, _: &Class<'a>) {
        self.plain = false;
    }
    fn visit_jsx_element(&mut self, _: &JSXElement<'a>) {
        self.plain = false;
    }
    fn visit_jsx_fragment(&mut self, _: &JSXFragment<'a>) {
        self.plain = false;
    }
}

/// The identifiers a row const binds: `id`, or `{ id, label: name }` (no defaults or rest, which
/// would run code or copy).
fn plain_bindings(pattern: &BindingPattern<'_>) -> Vec<SymbolId> {
    match pattern {
        BindingPattern::BindingIdentifier(ident) => ident.symbol_id.get().into_iter().collect(),
        BindingPattern::ObjectPattern(object) if object.rest.is_none() => {
            let mut symbols = Vec::new();
            for property in &object.properties {
                if property.computed {
                    return Vec::new();
                }
                match &property.value {
                    BindingPattern::BindingIdentifier(ident) => {
                        symbols.extend(ident.symbol_id.get());
                    }
                    _ => return Vec::new(),
                }
            }
            symbols
        }
        _ => Vec::new(),
    }
}

/// Finds index reads in a callback body outside JSX and nested functions.
struct IndexEscape<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    index: SymbolId,
    depth: u32,
    found: Vec<Span>,
}

impl<'a> Visit<'a> for IndexEscape<'_, 'a, '_> {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_jsx_element(&mut self, _: &JSXElement<'a>) {}
    fn visit_jsx_fragment(&mut self, _: &JSXFragment<'a>) {}

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if self.depth == 0 && self.codegen.symbol_of(it) == Some(self.index) {
            self.found.push(it.span);
        }
    }

    fn visit_return_statement(&mut self, it: &ReturnStatement<'a>) {
        // The returned value is the row: JSX there is fine, and plain reads are rendered once.
        self.depth += 1;
        walk::walk_return_statement(self, it);
        self.depth -= 1;
    }
}
