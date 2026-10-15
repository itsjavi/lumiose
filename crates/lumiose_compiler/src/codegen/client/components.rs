//! Component calls: `createComponent(C, props)` with getter props for dynamic values, plain
//! values for literals, identifiers and functions, a lazy `children` getter, `mergeProps` for
//! spreads and the hidden `$$scope` prop for class passthrough (contract doc-2 §1, §5.3). A
//! component that forwards its own `class` prop to a child (`<Inner class={props.class} />`)
//! forwards its caller's scope too: `$$scope` is its own tokens plus `props.$$scope` (TASK-92).
//!
//! On the server a component's getter props are evaluated lazily and at most once per instance
//! (decision-28): the props object is built by an arrow whose parameters cache each getter's value,
//! `((_d, _v) => ({ get p() { return _d ? _v : (_v = expr, _d = true, _v); } }))()`. Closure
//! variables keep the object's shape and add no visible keys; unread props never evaluate.

use oxc_allocator::{ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::Span;

use super::element::{AttrValue, attr_value, attribute_name, literal};
use super::{Codegen, Compiled, clone_expression};
use crate::analyze::is_jsx_like;

/// `onXChange`, the callback of a bindable prop `x`.
fn change_handler(prop: &str) -> String {
    let mut chars = prop.chars();
    let first = chars.next().map(|c| c.to_uppercase().to_string());
    format!("on{}{}Change", first.unwrap_or_default(), chars.as_str())
}

/// Takes out the `onXChange` attributes that come with a `bind:x` (the callback of `bind:x`
/// calls them), with their expressions.
fn take_bound_handlers<'a>(
    attributes: &mut ArenaVec<'a, JSXAttributeItem<'a>>,
) -> Vec<(String, Expression<'a>)> {
    let handlers: Vec<String> = attributes
        .iter()
        .filter_map(|item| match item {
            JSXAttributeItem::Attribute(attribute) => attribute_name(&attribute.name)
                .strip_prefix("bind:")
                .map(change_handler),
            JSXAttributeItem::SpreadAttribute(_) => None,
        })
        .collect();
    let mut taken = Vec::new();
    if handlers.is_empty() {
        return taken;
    }
    let mut index = 0;
    while index < attributes.len() {
        let name = match &attributes[index] {
            JSXAttributeItem::Attribute(attribute) => Some(attribute_name(&attribute.name)),
            JSXAttributeItem::SpreadAttribute(_) => None,
        };
        let is_handler = name.as_ref().is_some_and(|name| handlers.contains(name));
        if !is_handler {
            index += 1;
            continue;
        }
        let JSXAttributeItem::Attribute(attribute) = attributes.remove(index) else {
            unreachable!("an attribute")
        };
        let attribute = attribute.unbox();
        if let AttrValue::Expr(expr) = attr_value(attribute.value) {
            taken.push((name.expect("an attribute"), expr));
        }
    }
    taken
}

/// A name or a member chain of names (`open`, `state.open`, `this.open`): reading it twice reads
/// the same signal.
fn is_reference(expr: &Expression<'_>) -> bool {
    match expr.without_parentheses() {
        Expression::Identifier(_) | Expression::ThisExpression(_) => true,
        Expression::StaticMemberExpression(member) => {
            !member.optional && is_reference(&member.object)
        }
        _ => false,
    }
}

impl<'a> Codegen<'a, '_> {
    pub(super) fn compile_component(
        &mut self,
        element: ArenaBox<'a, JSXElement<'a>>,
    ) -> Compiled<'a> {
        let span = element.span;
        let element = element.unbox();
        let mut opening = element.opening_element.unbox();
        if let Some(directive) = self.take_island_directive(&mut opening.attributes) {
            return self.compile_island(opening, element.children, directive, span);
        }
        let component = self.component_reference(opening.name, span);
        let props = self.props_expression(opening.attributes, Some(element.children), span);
        let callee = self.runtime("createComponent", span);
        Compiled::value(self.ast.call(span, callee, [component, props]))
    }

    /// The component expression of a JSX tag (`Card`, `ui.Card`, `this.Item`), visited so that a
    /// destructured prop used as a tag reads `props.x`.
    pub(super) fn component_reference(
        &mut self,
        name: JSXElementName<'a>,
        span: Span,
    ) -> Expression<'a> {
        let expr = match name {
            JSXElementName::IdentifierReference(ident) => Expression::Identifier(ident),
            JSXElementName::MemberExpression(member) => self.jsx_member(member.unbox()),
            JSXElementName::ThisExpression(_) => Expression::new_this_expression(span, self.ast),
            JSXElementName::Identifier(ident) => self.ast.ident(span, &ident.name),
            JSXElementName::NamespacedName(ns) => self
                .ast
                .string(span, &format!("{}:{}", ns.namespace.name, ns.name.name)),
        };
        self.visited(expr)
    }

    fn jsx_member(&mut self, member: JSXMemberExpression<'a>) -> Expression<'a> {
        let object = match member.object {
            JSXMemberExpressionObject::IdentifierReference(ident) => Expression::Identifier(ident),
            JSXMemberExpressionObject::MemberExpression(inner) => self.jsx_member(inner.unbox()),
            JSXMemberExpressionObject::ThisExpression(this) => {
                Expression::new_this_expression(this.span, self.ast)
            }
        };
        self.ast.member(member.span, object, &member.property.name)
    }

    /// The props object of a component call (or of an intrinsic element with spreads when
    /// `children` is `None`): `{ a: 1, get b() { … } }`, or `mergeProps(...)` with spreads.
    pub(super) fn props_expression(
        &mut self,
        mut attributes: ArenaVec<'a, JSXAttributeItem<'a>>,
        children: Option<ArenaVec<'a, JSXChild<'a>>>,
        span: Span,
    ) -> Expression<'a> {
        let is_component = children.is_some();
        // Cache variables (`_d`, `_v` pairs) of the memoized getters of `current` (server only).
        let memoize = is_component && self.server();
        let mut memo: Vec<String> = Vec::new();
        // Signals of `bind:` evaluated once for `current`: (parameter, expression) of its arrow.
        let mut bound: Vec<(String, Expression<'a>)> = Vec::new();
        // The `onXChange` props written next to a `bind:x`, which its callback calls.
        let mut handlers = if is_component {
            take_bound_handlers(&mut attributes)
        } else {
            Vec::new()
        };
        let mut sources: Vec<Expression<'a>> = Vec::new();
        let mut current: Vec<ObjectPropertyKind<'a>> = Vec::new();
        let mut passes_class = false;
        // The props name when the passed `class` may carry this component's own `class` prop.
        let mut forwards_class: Option<String> = None;
        for item in attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(spread) => {
                    if !current.is_empty() {
                        let object = self.ast.object(span, std::mem::take(&mut current));
                        let (memo, bound) = (std::mem::take(&mut memo), std::mem::take(&mut bound));
                        sources.push(self.with_memo(span, object, memo, bound));
                    }
                    let argument = self.visited(spread.unbox().argument);
                    sources.push(argument);
                }
                JSXAttributeItem::Attribute(attribute) => {
                    let attribute = attribute.unbox();
                    let name = attribute_name(&attribute.name);
                    if name == "key" || name.starts_with("client:") {
                        continue;
                    }
                    if is_component && let Some(prop) = name.strip_prefix("bind:") {
                        if let AttrValue::Expr(expr) = attr_value(attribute.value) {
                            let handler = handlers
                                .iter()
                                .position(|(name, _)| *name == change_handler(prop))
                                .map(|index| handlers.swap_remove(index).1);
                            let memo = memoize.then_some(&mut memo);
                            let props = self.bind_props(
                                prop,
                                expr,
                                handler,
                                attribute.span,
                                memo,
                                &mut bound,
                            );
                            current.extend(props);
                        }
                        continue;
                    }
                    passes_class |= name == "class";
                    let span = attribute.span;
                    let value = attr_value(attribute.value);
                    if is_component
                        && name == "class"
                        && let AttrValue::Expr(expr) = &value
                    {
                        forwards_class = self.reads_props_class(expr);
                    }
                    match value {
                        AttrValue::Empty => {}
                        AttrValue::True => current.push(self.ast.property(
                            span,
                            &name,
                            self.ast.boolean(span, true),
                        )),
                        AttrValue::Str(s) => {
                            current.push(self.ast.property(span, &name, self.ast.string(span, &s)))
                        }
                        AttrValue::Expr(expr) => {
                            let memo = memoize.then_some(&mut memo);
                            current.push(self.prop(&name, expr, span, memo));
                        }
                    }
                }
            }
        }
        // A handler whose `bind:` had no signal is passed on as it is.
        for (name, expr) in handlers {
            let memo = memoize.then_some(&mut memo);
            current.push(self.prop(&name, expr, span, memo));
        }
        if is_component && passes_class {
            let tokens = self.scope_tokens(span);
            let own = (!tokens.is_empty()).then(|| self.ast.string(span, &tokens.join(" ")));
            let forwarded = forwards_class.map(|props_name| {
                self.ast
                    .member(span, self.ast.ident(span, &props_name), "$$scope")
            });
            let scope = match (own, forwarded) {
                (own, None) => own,
                (None, forwarded) => forwarded,
                // `"<own> " + (props.$$scope ?? "")`: the runtimes skip empty tokens.
                (Some(_), Some(forwarded)) => {
                    let own = self.ast.string(span, &format!("{} ", tokens.join(" ")));
                    let caller = self
                        .ast
                        .coalesce(span, forwarded, self.ast.string(span, ""));
                    Some(self.ast.binary(span, own, BinaryOperator::Addition, caller))
                }
            };
            if let Some(scope) = scope {
                current.push(self.ast.property(span, "$$scope", scope));
            }
        }
        if let Some(children) = children {
            let items = self.child_items(children);
            if let Some(compiled) = self.compile_fragment_items(items, span, true) {
                // Static text (or another literal) has nothing to evaluate lazily: a data
                // property keeps the object literal on V8's fast path (no accessor, no closure).
                current.push(
                    if compiled.setup.is_empty() && literal(&compiled.value).is_some() {
                        self.ast.property(span, "children", compiled.value)
                    } else if memoize {
                        self.memo_getter(
                            span,
                            "children",
                            compiled.setup,
                            compiled.value,
                            &mut memo,
                        )
                    } else {
                        self.ast
                            .getter(span, "children", compiled.setup, compiled.value)
                    },
                );
            }
        }
        if !current.is_empty() || sources.is_empty() {
            let object = self.ast.object(span, current);
            sources.push(self.with_memo(span, object, memo, bound));
        }
        if sources.len() == 1 {
            return sources.pop().expect("one source");
        }
        let callee = self.runtime("mergeProps", span);
        self.ast.call(span, callee, sources)
    }

    /// One prop: literals, identifiers and functions are plain values; JSX and reactive reads are
    /// getters (evaluated lazily by the child, inside its own tracking). On the server, where
    /// nothing is tracked, a trivially safe read is a plain value too (contract doc-2 §3.1).
    ///
    /// With `memo` (server component props), getters cache their first value (decision-28).
    fn prop(
        &mut self,
        name: &str,
        expr: Expression<'a>,
        span: Span,
        memo: Option<&mut Vec<String>>,
    ) -> ObjectPropertyKind<'a> {
        if literal(&expr).is_some() {
            return self.ast.property(span, name, expr);
        }
        if is_jsx_like(&expr) {
            let compiled = self.compile_value(expr);
            return match memo {
                Some(memo) => self.memo_getter(span, name, compiled.setup, compiled.value, memo),
                None => self.ast.getter(span, name, compiled.setup, compiled.value),
            };
        }
        let expr = self.visited(expr);
        if self.is_dynamic(&expr) && !(self.server() && self.is_trivially_safe(&expr)) {
            match memo {
                Some(memo) => self.memo_getter(span, name, Vec::new(), expr, memo),
                None => self.ast.getter(span, name, Vec::new(), expr),
            }
        } else {
            self.ast.property(span, name, expr)
        }
    }

    /// `get name() { return _d ? _v : (_v = value, _d = true, _v); }`, with `setup` run inside the
    /// first evaluation; pushes `_d` and `_v` to `memo`, the parameters of the wrapping arrow.
    fn memo_getter(
        &mut self,
        span: Span,
        name: &str,
        setup: Vec<Statement<'a>>,
        value: Expression<'a>,
        memo: &mut Vec<String>,
    ) -> ObjectPropertyKind<'a> {
        let done = self.names.fresh("_d");
        let cached = self.names.fresh("_v");
        let value = self.ast.iife(span, setup, value);
        let assign = |ast: &super::super::ast::Ast<'a>, target: &str, value: Expression<'a>| {
            let target =
                AssignmentTarget::new_assignment_target_identifier(span, ast.str(target), ast);
            Expression::new_assignment_expression(
                span,
                oxc_syntax::operator::AssignmentOperator::Assign,
                target,
                value,
                ast,
            )
        };
        let first = Expression::new_sequence_expression(
            span,
            self.ast.vec_from([
                assign(self.ast, &cached, value),
                assign(self.ast, &done, self.ast.boolean(span, true)),
                self.ast.ident(span, &cached),
            ]),
            self.ast,
        );
        let body = self.ast.conditional(
            span,
            self.ast.ident(span, &done),
            self.ast.ident(span, &cached),
            first,
        );
        memo.push(done);
        memo.push(cached);
        self.ast.getter(span, name, Vec::new(), body)
    }

    /// `object`, or `((_s, …, _d, _v, …) => object)(signal, …)` when it has `bind:` signals
    /// evaluated once or memoized getters.
    fn with_memo(
        &self,
        span: Span,
        object: Expression<'a>,
        memo: Vec<String>,
        bound: Vec<(String, Expression<'a>)>,
    ) -> Expression<'a> {
        if memo.is_empty() && bound.is_empty() {
            return object;
        }
        let (names, args): (Vec<String>, Vec<Expression<'a>>) = bound.into_iter().unzip();
        let params = names
            .iter()
            .chain(&memo)
            .map(String::as_str)
            .collect::<Vec<_>>();
        let arrow = self.ast.arrow(span, &params, object);
        self.ast.call(span, arrow, args)
    }

    /// `bind:x={signal}` on a component (decision-62): `x` reads the signal like `x={signal()}`,
    /// and `onXChange` writes the value back, then calls the `onXChange` written next to it, if
    /// any. A signal expression other than a name or a member chain is evaluated once, as an
    /// argument of the props object's arrow (`bound`).
    fn bind_props(
        &mut self,
        prop: &str,
        signal: Expression<'a>,
        handler: Option<Expression<'a>>,
        span: Span,
        memo: Option<&mut Vec<String>>,
        bound: &mut Vec<(String, Expression<'a>)>,
    ) -> [ObjectPropertyKind<'a>; 2] {
        let (read, write) = if is_reference(&signal) {
            let write = self.visited(clone_expression(self.ast, &signal));
            (signal, write)
        } else {
            let name = self.names.fresh("_s");
            let signal = self.visited(signal);
            bound.push((name.clone(), signal));
            (self.ast.ident(span, &name), self.ast.ident(span, &name))
        };
        let value = self.prop(prop, self.ast.call(span, read, []), span, memo);
        let next = self.names.fresh("_v");
        let set = self.ast.member(span, write, "set");
        let set = self.ast.call(span, set, [self.ast.ident(span, &next)]);
        let callback = match handler {
            None => self.ast.arrow(span, &[&next], set),
            Some(handler) => {
                // `(_v, ..._a) => (signal.set(_v), handler?.(_v, ..._a))`
                let rest = self.names.fresh("_a");
                let handler = self.visited(handler);
                let args = [
                    Argument::from(self.ast.ident(span, &next)),
                    self.ast.spread_argument(span, self.ast.ident(span, &rest)),
                ];
                let call = self.ast.optional_call(span, handler, args);
                let body = Expression::new_sequence_expression(
                    span,
                    self.ast.vec_from([set, call]),
                    self.ast,
                );
                self.ast.arrow_rest(span, &[&next], &rest, body)
            }
        };
        let callback = self.ast.property(span, &change_handler(prop), callback);
        [value, callback]
    }

    /// An expression that cannot throw or run user code beyond a props getter, so evaluating it
    /// eagerly in the parent matches the client's lazy read (Lux, TASK-78): a literal, a local
    /// identifier, a single-level `props.x` read, or a template literal of those.
    fn is_trivially_safe(&self, expr: &Expression<'a>) -> bool {
        match expr.without_parentheses() {
            Expression::Identifier(_) => true,
            Expression::StaticMemberExpression(member) => {
                !member.optional
                    && matches!(&member.object, Expression::Identifier(object)
                        if self.component().is_some_and(|c| object.name == c.props_name.as_str()))
            }
            Expression::TemplateLiteral(template) => template
                .expressions
                .iter()
                .all(|part| self.is_trivially_safe(part)),
            other => literal(other).is_some(),
        }
    }
}
