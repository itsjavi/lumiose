//! Async components (contract doc-2 §4), identical on both targets:
//!
//! - the definition is tagged: a declaration stays a hoisted `async function X(props) { … }`
//!   with a `$async(X);` statement at the start of its scope; function and arrow expressions
//!   are wrapped in place (`$async(async (props) => { … })`);
//! - the body runs inside `try { … } finally { $leave(); }`, so the run pauses when it ends;
//! - each `await e` whose nearest function is the component becomes
//!   `(await $await(() => e, N))()`, `N` being its static site index (source order, from the
//!   analysis), and `for await (x of it)` is lowered to a loop over `(await $await(() =>
//!   iter.next(), N))()`.

use oxc_allocator::{ArenaBox, ArenaVec, TakeIn};
use oxc_ast::ast::*;
use oxc_ast_visit::VisitMut;
use oxc_ast_visit::walk_mut;
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::ScopeFlags;

use super::Codegen;
use crate::analyze::Component;

impl<'a> Codegen<'a, '_> {
    /// The await site indices of `component` when it is async (pushed per function visited).
    pub(super) fn await_frame(component: Option<&Component>) -> Option<Vec<u32>> {
        component
            .filter(|c| c.is_async)
            .map(|c| c.await_sites.iter().map(|site| site.start).collect())
    }

    /// The site index of the `await` (or `for await`) starting at `start`, when its nearest
    /// function is an async component.
    pub(super) fn await_site(&self, start: u32) -> Option<usize> {
        self.awaits
            .last()?
            .as_ref()?
            .iter()
            .position(|&site| site == start)
    }

    /// `(await $await(() => argument, site))()`
    pub(super) fn rewrite_await(&mut self, expr: &mut Expression<'a>, site: usize) {
        let span = expr.span();
        let Expression::AwaitExpression(await_expr) = expr.take_in(self.ast) else {
            unreachable!("an await expression")
        };
        let argument = await_expr.unbox().argument;
        *expr = self.awaited(span, argument, site);
    }

    fn awaited(&mut self, span: Span, argument: Expression<'a>, site: usize) -> Expression<'a> {
        let thunk = self.ast.arrow(span, &[], argument);
        let callee = self.runtime("$await", span);
        let paused = self
            .ast
            .call(span, callee, [thunk, self.ast.number(span, site as f64)]);
        let resumed = Expression::new_await_expression(span, paused, self.ast);
        let resumed = Expression::new_parenthesized_expression(span, resumed, self.ast);
        self.ast.call(span, resumed, [])
    }

    /// Wraps an async component body: `try { … } finally { $leave(); }`.
    pub(super) fn wrap_async_body(
        &mut self,
        span: Span,
        statements: ArenaVec<'a, Statement<'a>>,
    ) -> ArenaVec<'a, Statement<'a>> {
        let callee = self.runtime("$leave", span);
        let leave = self.ast.expr_stmt(span, self.ast.call(span, callee, []));
        let block = BlockStatement::boxed(span, statements, self.ast);
        let finalizer = BlockStatement::boxed(span, self.ast.vec_from([leave]), self.ast);
        let try_statement =
            Statement::new_try_statement(span, block, None, Some(finalizer), self.ast);
        self.ast.vec_from([try_statement])
    }

    /// `$async(<function or arrow>)`
    pub(super) fn tag_async(&mut self, function: Expression<'a>) -> Expression<'a> {
        let span = function.span();
        let callee = self.runtime("$async", span);
        self.ast.call_pure(span, callee, [function])
    }

    /// `$async(X);`: tags a hoisted async component declaration in place. Not pure: the call
    /// mutates `X`, so it must survive tree shaking.
    fn tag_statement(&mut self, span: Span, name: &str) -> Statement<'a> {
        let callee = self.runtime("$async", span);
        let call = self.ast.call(span, callee, [self.ast.ident(span, name)]);
        self.ast.expr_stmt(span, call)
    }

    /// An async component declaration (plain, `export` or `export default`), visited in place.
    /// Returns the statements replacing it and, for a named declaration, its `$async(X);` tag,
    /// which the caller puts at the start of the scope: the declaration stays a hoisted
    /// `async function X`, and it is tagged before any code of the scope can use it. An anonymous
    /// `export default async function` becomes `export default $async(async function …)`.
    /// `None` for other statements.
    pub(super) fn async_component_statement(
        &mut self,
        statement: &mut Statement<'a>,
    ) -> Option<(Statement<'a>, Option<Statement<'a>>)> {
        let tagged = |f: &Function<'a>| f.r#async && self.is_async_component(f.span.start);
        let function = match statement {
            Statement::FunctionDeclaration(f) if tagged(f) => f,
            Statement::ExportDeclaration(export) => match &mut export.declaration {
                Declaration::FunctionDeclaration(f) if tagged(f) => f,
                _ => return None,
            },
            Statement::ExportDefaultDeclaration(export) => match &mut export.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) if tagged(f) => f,
                _ => return None,
            },
            _ => return None,
        };
        self.visit_function(function, ScopeFlags::Function);
        let span = function.span;
        if let Some(name) = function.id.as_ref().map(|id| id.name.to_string()) {
            let tag = self.tag_statement(span, &name);
            return Some((statement.take_in(self.ast), Some(tag)));
        }
        let Statement::ExportDefaultDeclaration(export) = statement.take_in(self.ast) else {
            unreachable!("only a default export declaration can be anonymous")
        };
        let export = export.unbox();
        let ExportDefaultDeclarationKind::FunctionDeclaration(mut function) = export.declaration
        else {
            unreachable!("matched above")
        };
        function.r#type = FunctionType::FunctionExpression;
        let tagged = self.tag_async(Expression::FunctionExpression(function));
        let kind = ExportDefaultDeclarationKind::from(tagged);
        let statement = Statement::new_export_default_declaration(export.span, kind, self.ast);
        Some((statement, None))
    }

    /// Lowers `for await` loops of async components (and visits everything else).
    pub(super) fn visit_statement_lowering(&mut self, statement: &mut Statement<'a>) {
        let site = match statement {
            Statement::ForOfStatement(f) if f.r#await => self.await_site(f.span.start),
            Statement::LabeledStatement(labeled) => match &labeled.body {
                Statement::ForOfStatement(f) if f.r#await => self.await_site(f.span.start),
                _ => None,
            },
            _ => None,
        };
        let Some(site) = site else {
            walk_mut::walk_statement(self, statement);
            return;
        };
        *statement = match statement.take_in(self.ast) {
            Statement::ForOfStatement(mut for_of) => {
                walk_mut::walk_for_of_statement(self, &mut for_of);
                self.lower_for_await(for_of, site, None)
            }
            Statement::LabeledStatement(labeled) => {
                let labeled = labeled.unbox();
                let Statement::ForOfStatement(mut for_of) = labeled.body else {
                    unreachable!("matched above")
                };
                walk_mut::walk_for_of_statement(self, &mut for_of);
                self.lower_for_await(for_of, site, Some(labeled.label))
            }
            _ => unreachable!("matched above"),
        };
    }

    /// True when `function` (a declaration) is an async component.
    pub(super) fn is_async_component(&self, start: u32) -> bool {
        self.analysis
            .component_at(start)
            .is_some_and(|component| component.is_async)
    }

    /// Lowers a visited `for await (left of right) body` at `site` (with its label, if any):
    ///
    /// ```js
    /// {
    ///   const _iter = right[Symbol.asyncIterator] ? right[Symbol.asyncIterator]() : right[Symbol.iterator]();
    ///   let _step;
    ///   try {
    ///     label: for (;;) {
    ///       _step = undefined;
    ///       _step = (await $await(() => _iter.next(), site))();
    ///       if (_step.done) break;
    ///       <left> = _step.value;
    ///       body
    ///     }
    ///   } finally {
    ///     if (_step && !_step.done && _iter.return) _iter.return();
    ///   }
    /// }
    /// ```
    ///
    /// Values of a sync iterator are not awaited one by one (unlike native `for await`).
    pub(super) fn lower_for_await(
        &mut self,
        for_of: ArenaBox<'a, ForOfStatement<'a>>,
        site: usize,
        label: Option<LabelIdentifier<'a>>,
    ) -> Statement<'a> {
        let span = for_of.span;
        let for_of = for_of.unbox();
        let ast = self.ast;
        let source_name = self.names.fresh("_source");
        let iter_name = self.names.fresh("_iter");
        let step_name = self.names.fresh("_step");
        let ident = |name: &str| ast.ident(span, name);
        let symbol = |name: &str| ast.member(span, ast.ident(span, "Symbol"), name);

        // const _source = right, _iter = _source[Symbol.asyncIterator] ? … : …;
        let async_iterator = |ast: &crate::codegen::ast::Ast<'a>| {
            ast.computed_member(span, ident(&source_name), symbol("asyncIterator"))
        };
        let sync_iterator = ast.computed_member(span, ident(&source_name), symbol("iterator"));
        let iterator = ast.conditional(
            span,
            async_iterator(ast),
            ast.call(span, async_iterator(ast), []),
            ast.call(span, sync_iterator, []),
        );
        let iterator_decl = ast.const_decls(
            span,
            [
                (source_name.clone(), for_of.right),
                (iter_name.clone(), iterator),
            ],
        );
        // let _step;
        let step_decl = Statement::new_variable_declaration(
            span,
            VariableDeclarationKind::Let,
            ast.vec_from([VariableDeclarator::new(
                span,
                BindingPattern::new_binding_identifier(span, ast.str(&step_name), ast),
                None,
                None,
                false,
                ast,
            )]),
            false,
            ast,
        );

        // Loop body.
        let next = ast.call(span, ast.member(span, ident(&iter_name), "next"), []);
        let awaited = self.awaited(span, next, site);
        let reset = self.assign(span, &step_name, ast.undefined(span));
        let step = self.assign(span, &step_name, awaited);
        let done = ast.member(span, ident(&step_name), "done");
        let exit = Statement::new_if_statement(
            span,
            done,
            Statement::new_break_statement(span, None, ast),
            None,
            ast,
        );
        let value = ast.member(span, ident(&step_name), "value");
        let binding = match for_of.left {
            ForStatementLeft::VariableDeclaration(mut declaration) => {
                if let Some(declarator) = declaration.declarations.first_mut() {
                    declarator.init = Some(value);
                }
                Statement::VariableDeclaration(declaration)
            }
            left => {
                let target = left.into_assignment_target();
                ast.expr_stmt(
                    span,
                    Expression::new_assignment_expression(
                        span,
                        oxc_syntax::operator::AssignmentOperator::Assign,
                        target,
                        value,
                        ast,
                    ),
                )
            }
        };
        let body = Statement::new_block_statement(
            span,
            ast.vec_from([reset, step, exit, binding, for_of.body]),
            ast,
        );
        let mut loop_statement = Statement::new_for_statement(span, None, None, None, body, ast);
        if let Some(label) = label {
            loop_statement = Statement::new_labeled_statement(span, label, loop_statement, ast);
        }

        // finally { if (_step && !_step.done && _iter.return) _iter.return(); }
        let not_done = ast.not(span, ast.member(span, ident(&step_name), "done"));
        let has_return = ast.member(span, ident(&iter_name), "return");
        let test = Expression::new_logical_expression(
            span,
            Expression::new_logical_expression(
                span,
                ident(&step_name),
                oxc_syntax::operator::LogicalOperator::And,
                not_done,
                ast,
            ),
            oxc_syntax::operator::LogicalOperator::And,
            has_return,
            ast,
        );
        let close = ast.expr_stmt(
            span,
            ast.call(span, ast.member(span, ident(&iter_name), "return"), []),
        );
        let cleanup = Statement::new_if_statement(span, test, close, None, ast);
        let try_statement = Statement::new_try_statement(
            span,
            BlockStatement::boxed(span, ast.vec_from([loop_statement]), ast),
            None,
            Some(BlockStatement::boxed(span, ast.vec_from([cleanup]), ast)),
            ast,
        );
        Statement::new_block_statement(
            span,
            ast.vec_from([iterator_decl, step_decl, try_statement]),
            ast,
        )
    }

    /// `name = value;`
    fn assign(&self, span: Span, name: &str, value: Expression<'a>) -> Statement<'a> {
        let target =
            AssignmentTarget::new_assignment_target_identifier(span, self.ast.str(name), self.ast);
        self.ast.expr_stmt(
            span,
            Expression::new_assignment_expression(
                span,
                oxc_syntax::operator::AssignmentOperator::Assign,
                target,
                value,
                self.ast,
            ),
        )
    }
}
