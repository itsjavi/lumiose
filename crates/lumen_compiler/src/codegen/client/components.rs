//! Component calls: `createComponent(C, props)` with getter props for dynamic values, plain
//! values for literals, identifiers and functions, a lazy `children` getter, `mergeProps` for
//! spreads and the hidden `$$scope` prop for class passthrough (contract doc-2 §1, §5.3).

use oxc_allocator::{ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::Span;

use super::element::{AttrValue, attr_value, attribute_name, literal};
use super::{Codegen, Compiled};
use crate::analyze::is_jsx_like;

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
        attributes: ArenaVec<'a, JSXAttributeItem<'a>>,
        children: Option<ArenaVec<'a, JSXChild<'a>>>,
        span: Span,
    ) -> Expression<'a> {
        let is_component = children.is_some();
        let mut sources: Vec<Expression<'a>> = Vec::new();
        let mut current: Vec<ObjectPropertyKind<'a>> = Vec::new();
        let mut passes_class = false;
        for item in attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(spread) => {
                    if !current.is_empty() {
                        sources.push(self.ast.object(span, std::mem::take(&mut current)));
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
                    passes_class |= name == "class";
                    let span = attribute.span;
                    match attr_value(attribute.value) {
                        AttrValue::Empty => {}
                        AttrValue::True => current.push(self.ast.property(
                            span,
                            &name,
                            self.ast.boolean(span, true),
                        )),
                        AttrValue::Str(s) => {
                            current.push(self.ast.property(span, &name, self.ast.string(span, &s)))
                        }
                        AttrValue::Expr(expr) => current.push(self.prop(&name, expr, span)),
                    }
                }
            }
        }
        if is_component && passes_class {
            let tokens = self.scope_tokens(span);
            if !tokens.is_empty() {
                current.push(self.ast.property(
                    span,
                    "$$scope",
                    self.ast.string(span, &tokens.join(" ")),
                ));
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
                    } else {
                        self.ast
                            .getter(span, "children", compiled.setup, compiled.value)
                    },
                );
            }
        }
        if !current.is_empty() || sources.is_empty() {
            sources.push(self.ast.object(span, current));
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
    fn prop(&mut self, name: &str, expr: Expression<'a>, span: Span) -> ObjectPropertyKind<'a> {
        if literal(&expr).is_some() {
            return self.ast.property(span, name, expr);
        }
        if is_jsx_like(&expr) {
            let compiled = self.compile_value(expr);
            return self.ast.getter(span, name, compiled.setup, compiled.value);
        }
        let expr = self.visited(expr);
        if self.is_dynamic(&expr) && !(self.server() && self.is_trivially_safe(&expr)) {
            self.ast.getter(span, name, Vec::new(), expr)
        } else {
            self.ast.property(span, name, expr)
        }
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
