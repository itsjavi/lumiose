//! LUM4004 (TASK-178): a browser global (`window`, `document`, `localStorage`, …) evaluated while a
//! module loads. Modules of server graphs load on the server, where these globals do not exist, so
//! the server render crashes. Code inside functions (components, effects, event handlers, `onMount`)
//! and class bodies runs later and is not reported, nor is a `typeof` check or code guarded by
//! one (`typeof window !== "undefined" && …`, `if (typeof document === "object") { … }`).
//! Only unresolved references count: a local or imported binding named `document` is not the
//! global.

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_syntax::scope::ScopeFlags;

use crate::diagnostics::{Code, Diagnostic};

/// Globals that exist in browsers and not in Node.js.
const BROWSER_GLOBALS: &[&str] = &[
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "navigator",
    "location",
    "history",
    "screen",
    "alert",
    "confirm",
    "prompt",
    "matchMedia",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "requestIdleCallback",
    "customElements",
    "indexedDB",
    "IntersectionObserver",
    "ResizeObserver",
    "MutationObserver",
    "HTMLElement",
    "Element",
    "Node",
    "innerWidth",
    "innerHeight",
    "devicePixelRatio",
];

/// The LUM4004 diagnostics of `program`, one per global reference evaluated at module scope.
pub fn browser_globals(program: &Program<'_>, scoping: &Scoping) -> Vec<Diagnostic> {
    let mut finder = Finder {
        scoping,
        found: Vec::new(),
    };
    finder.visit_program(program);
    finder.found
}

struct Finder<'s> {
    scoping: &'s Scoping,
    found: Vec<Diagnostic>,
}

/// Whether `expr` contains a `typeof <browser global>` (a guard).
fn has_typeof_guard(expr: &Expression<'_>) -> bool {
    struct Guard(bool);
    impl<'a> Visit<'a> for Guard {
        fn visit_unary_expression(&mut self, it: &UnaryExpression<'a>) {
            if it.operator == UnaryOperator::Typeof
                && let Expression::Identifier(ident) = it.argument.without_parentheses()
                && BROWSER_GLOBALS.contains(&ident.name.as_str())
            {
                self.0 = true;
            }
            walk::walk_unary_expression(self, it);
        }
    }
    let mut guard = Guard(false);
    guard.visit_expression(expr);
    guard.0
}

impl<'a> Visit<'a> for Finder<'_> {
    // Runs later, not while the module loads.
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
    fn visit_class(&mut self, _: &Class<'a>) {}

    fn visit_unary_expression(&mut self, it: &UnaryExpression<'a>) {
        // `typeof window` is the check itself.
        if it.operator == UnaryOperator::Typeof
            && matches!(it.argument.without_parentheses(), Expression::Identifier(_))
        {
            return;
        }
        walk::walk_unary_expression(self, it);
    }

    fn visit_if_statement(&mut self, it: &IfStatement<'a>) {
        if has_typeof_guard(&it.test) {
            return;
        }
        walk::walk_if_statement(self, it);
    }

    fn visit_conditional_expression(&mut self, it: &ConditionalExpression<'a>) {
        if has_typeof_guard(&it.test) {
            return;
        }
        walk::walk_conditional_expression(self, it);
    }

    fn visit_logical_expression(&mut self, it: &LogicalExpression<'a>) {
        if has_typeof_guard(&it.left) {
            return;
        }
        walk::walk_logical_expression(self, it);
    }

    fn visit_identifier_reference(&mut self, ident: &IdentifierReference<'a>) {
        let name = ident.name.as_str();
        if !BROWSER_GLOBALS.contains(&name) {
            return;
        }
        let global = ident
            .reference_id
            .get()
            .is_none_or(|id| self.scoping.get_reference(id).symbol_id().is_none());
        if !global {
            return;
        }
        self.found.push(
            Diagnostic::new(
                Code::BrowserApiAtModuleScope,
                ident.span.into(),
                format!(
                    "`{name}` is read while the module loads, but server rendering loads this module on the server, where `{name}` does not exist"
                ),
            )
            .with_help(
                "Read it inside `onMount`, an effect or an event handler, which only run in the browser, or guard it with `typeof window !== \"undefined\"`.",
            ),
        );
    }
}
