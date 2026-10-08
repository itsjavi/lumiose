//! Events (decision-17): `onX` props are React-style camelCase names from
//! `packages/lumen/src/jsx/events.ts`; the DOM name is the suffix lowercased. Bubbling events are
//! delegated (`el.$$click = handler`, registered once per module with `delegateEvents`); others
//! get a direct `listen()`. Inside `.map()` rows, a handler that only captures the row item and
//! stable bindings is hoisted out of the row and receives the item through the `$$clickData` slot.

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_span::Span;
use oxc_syntax::scope::{ScopeFlags, ScopeId};
use oxc_syntax::symbol::SymbolId;

use super::Codegen;
use super::template::{Op, Template};

/// `onKeyDown` → `keydown`; `None` for props that are not `onX` handlers.
pub fn event_name(prop: &str) -> Option<String> {
    let suffix = prop.strip_prefix("on")?;
    suffix
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_uppercase())
        .then(|| suffix.to_ascii_lowercase())
}

/// Events that bubble and are safe to handle at the document. Events that do not bubble
/// (`focus`, `mouseenter`, `scroll`, media events…) and those that browsers make passive at the
/// document level (`wheel`, `touchstart`, `touchmove`) get a direct listener instead.
pub fn is_delegated(event: &str) -> bool {
    matches!(
        event,
        "click"
            | "dblclick"
            | "auxclick"
            | "contextmenu"
            | "mousedown"
            | "mouseup"
            | "mousemove"
            | "mouseover"
            | "mouseout"
            | "pointerdown"
            | "pointerup"
            | "pointermove"
            | "pointerover"
            | "pointerout"
            | "pointercancel"
            | "touchend"
            | "touchcancel"
            | "keydown"
            | "keyup"
            | "keypress"
            | "focusin"
            | "focusout"
            | "beforeinput"
            | "input"
            | "change"
            | "submit"
            | "reset"
            | "compositionstart"
            | "compositionupdate"
            | "compositionend"
            | "copy"
            | "cut"
            | "paste"
            | "drag"
            | "dragstart"
            | "dragend"
            | "dragenter"
            | "dragleave"
            | "dragover"
            | "drop"
    )
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Level {
    Module,
    Setup,
}

struct Hoist {
    level: Level,
    /// The row data the handler reads (the item or one row const), passed through the data slot.
    data: Option<SymbolId>,
}

impl<'a> Codegen<'a, '_> {
    pub(super) fn event_attribute(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        prop: &str,
        handler: Expression<'a>,
        span: Span,
    ) {
        let event = event_name(prop).expect("an onX prop");
        if !is_delegated(&event) {
            let handler = self.visited(handler);
            let name = self.ast.string(span, &event);
            template.push(Op::Call {
                span,
                helper: "listen",
                node,
                args: vec![name, handler],
            });
            return;
        }
        self.delegate(&event);
        let slot = format!("$${event}");
        match self.hoistable(&handler) {
            Some(hoist) => {
                let data = hoist
                    .data
                    .map(|symbol| self.scoping.symbol_name(symbol).to_owned());
                let name = self.hoist_handler(handler, &event, &hoist, data.as_deref(), span);
                template.push(Op::Assign {
                    span,
                    node,
                    prop: slot.clone(),
                    value: self.ast.ident(span, &name),
                });
                if let Some(data) = data {
                    template.push(Op::Assign {
                        span,
                        node,
                        prop: format!("{slot}Data"),
                        value: self.ast.ident(span, &data),
                    });
                }
            }
            None => {
                let handler = self.visited(handler);
                template.push(Op::Assign {
                    span,
                    node,
                    prop: slot,
                    value: handler,
                });
            }
        }
    }

    /// Whether an inline row handler can move out of the row.
    fn hoistable(&self, handler: &Expression<'a>) -> Option<Hoist> {
        let map = self.maps.last()?;
        let item = map.item?;
        let scope = match handler.without_parentheses() {
            Expression::ArrowFunctionExpression(arrow) => arrow.scope_id.get()?,
            Expression::FunctionExpression(function) if !function.generator => {
                function.scope_id.get()?
            }
            _ => return None,
        };
        let component_scope = self.components.last().and_then(|c| c.scope);
        let mut checker = Captures {
            codegen: self,
            handler_scope: scope,
            component_scope,
            item,
            row_consts: &map.row_consts,
            data: None,
            uses_setup: false,
            blocked: false,
            function_depth: 0,
        };
        checker.visit_expression(handler);
        if checker.blocked {
            return None;
        }
        Some(Hoist {
            level: if checker.uses_setup {
                Level::Setup
            } else {
                Level::Module
            },
            data: checker.data,
        })
    }

    /// Declares `const _onClick = (row, …params) => …` at module or setup level; the first
    /// parameter is the row data (`data`) the handler reads, named as in the row.
    fn hoist_handler(
        &mut self,
        handler: Expression<'a>,
        event: &str,
        hoist: &Hoist,
        data: Option<&str>,
        span: Span,
    ) -> String {
        let mut handler = self.visited(handler);
        while let Expression::ParenthesizedExpression(paren) = handler {
            handler = paren.unbox().expression;
        }
        if let Some(data) = data {
            let params = match &mut handler {
                Expression::ArrowFunctionExpression(arrow) => &mut arrow.params,
                Expression::FunctionExpression(function) => &mut function.params,
                _ => unreachable!("checked by hoistable"),
            };
            params.items.insert(0, self.ast.param(span, data));
        }
        let mut base = String::from("_on");
        let mut chars = event.chars();
        if let Some(first) = chars.next() {
            base.push(first.to_ascii_uppercase());
            base.extend(chars);
        }
        let name = self.names.fresh(&base);
        let declaration = self.ast.const_decl(span, &name, handler);
        match hoist.level {
            Level::Module => self.hoist(declaration),
            Level::Setup => {
                if let Some(component) = self.components.last_mut() {
                    component.setup_hoists.push(declaration);
                }
            }
        }
        name
    }
}

/// What an inline handler captures.
struct Captures<'c, 'a, 's> {
    codegen: &'c Codegen<'a, 's>,
    handler_scope: ScopeId,
    component_scope: Option<ScopeId>,
    item: SymbolId,
    row_consts: &'c [SymbolId],
    /// The one row value the handler reads; reading two (the item and a row const) blocks hoisting.
    data: Option<SymbolId>,
    uses_setup: bool,
    blocked: bool,
    /// Nesting of non-arrow functions inside the handler (they rebind `this`/`arguments`).
    function_depth: u32,
}

impl<'a> Visit<'a> for Captures<'_, 'a, '_> {
    fn visit_function(&mut self, it: &Function<'a>, flags: ScopeFlags) {
        self.function_depth += 1;
        walk::walk_function(self, it, flags);
        self.function_depth -= 1;
    }

    fn visit_this_expression(&mut self, _: &ThisExpression) {
        if self.function_depth == 0 {
            self.blocked = true;
        }
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        let scoping = self.codegen.scoping;
        let Some(symbol) = self.codegen.symbol_of(it) else {
            if it.name == "arguments" && self.function_depth == 0 {
                self.blocked = true;
            }
            return;
        };
        if symbol == self.item || self.row_consts.contains(&symbol) {
            match self.data {
                Some(data) if data != symbol => self.blocked = true,
                _ => self.data = Some(symbol),
            }
            return;
        }
        let declared = scoping.symbol_scope_id(symbol);
        if self.codegen.scope_within(declared, self.handler_scope)
            || declared == scoping.root_scope_id()
        {
            return;
        }
        if Some(declared) == self.component_scope && !scoping.symbol_is_mutated(symbol) {
            self.uses_setup = true;
            return;
        }
        self.blocked = true;
    }
}
