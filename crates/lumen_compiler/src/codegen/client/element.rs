//! Intrinsic elements: tag, static attributes baked into the template, and the operations for
//! dynamic attributes (`class`/`style` objects per key, properties, refs, attachments, two-way
//! bindings, listeners and spreads).

use oxc_allocator::ArenaBox;
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_span::Span;

use super::html::{self, Namespace};
use super::template::{NodeKind, Op, Template};
use super::text::decode_entities;
use super::{Codegen, Compiled};
use crate::analyze::property_key_name;

/// An attribute value after JSX decoding.
pub enum AttrValue<'a> {
    /// `<input disabled>`
    True,
    /// `title="…"` (entities decoded).
    Str(String),
    Expr(Expression<'a>),
    /// `title={}` / `title={/* comment */}`
    Empty,
}

pub fn attr_value<'a>(value: Option<JSXAttributeValue<'a>>) -> AttrValue<'a> {
    match value {
        None => AttrValue::True,
        Some(JSXAttributeValue::StringLiteral(lit)) => AttrValue::Str(decode_entities(&lit.value)),
        Some(JSXAttributeValue::ExpressionContainer(container)) => {
            match container.unbox().expression {
                JSXExpression::EmptyExpression(_) => AttrValue::Empty,
                expression => AttrValue::Expr(expression.into_expression()),
            }
        }
        Some(JSXAttributeValue::Element(element)) => {
            AttrValue::Expr(Expression::JSXElement(element))
        }
        Some(JSXAttributeValue::Fragment(fragment)) => {
            AttrValue::Expr(Expression::JSXFragment(fragment))
        }
    }
}

/// A compile-time constant.
#[derive(Debug, Clone, PartialEq)]
pub enum Literal {
    Str(String),
    Bool(bool),
    Nullish,
}

pub fn literal(expr: &Expression<'_>) -> Option<Literal> {
    match expr.without_parentheses() {
        Expression::StringLiteral(lit) => Some(Literal::Str(lit.value.to_string())),
        Expression::NumericLiteral(lit) => Some(Literal::Str(js_number(lit.value))),
        Expression::BooleanLiteral(lit) => Some(Literal::Bool(lit.value)),
        Expression::NullLiteral(_) => Some(Literal::Nullish),
        Expression::UnaryExpression(unary)
            if unary.operator == oxc_syntax::operator::UnaryOperator::Void
                && matches!(unary.argument, Expression::NumericLiteral(_)) =>
        {
            Some(Literal::Nullish)
        }
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => template
            .quasis
            .first()
            .and_then(|q| q.value.cooked.as_ref())
            .map(|cooked| Literal::Str(cooked.to_string())),
        _ => None,
    }
}

/// `String(n)` for the common cases.
pub fn js_number(value: f64) -> String {
    if value.is_finite() && value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

/// Names written as DOM properties rather than attributes.
pub(super) fn is_property(name: &str) -> bool {
    matches!(
        name,
        "value"
            | "checked"
            | "selected"
            | "muted"
            | "indeterminate"
            | "innerHTML"
            | "textContent"
            | "innerText"
    )
}

/// Properties without an attribute form: always assigned.
pub(super) fn is_property_only(name: &str) -> bool {
    matches!(
        name,
        "indeterminate" | "innerHTML" | "textContent" | "innerText"
    )
}

pub fn is_intrinsic(name: &JSXElementName<'_>) -> bool {
    matches!(
        name,
        JSXElementName::Identifier(_) | JSXElementName::NamespacedName(_)
    )
}

pub fn tag_name(name: &JSXElementName<'_>) -> String {
    match name {
        JSXElementName::Identifier(ident) => ident.name.to_string(),
        JSXElementName::NamespacedName(ns) => format!("{}:{}", ns.namespace.name, ns.name.name),
        JSXElementName::IdentifierReference(ident) => ident.name.to_string(),
        JSXElementName::MemberExpression(member) => member.to_string(),
        JSXElementName::ThisExpression(_) => "this".to_owned(),
    }
}

pub fn attribute_name(name: &JSXAttributeName<'_>) -> String {
    match name {
        JSXAttributeName::Identifier(ident) => ident.name.to_string(),
        JSXAttributeName::NamespacedName(ns) => format!("{}:{}", ns.namespace.name, ns.name.name),
    }
}

impl<'a> Codegen<'a, '_> {
    /// A JSX element in value position: a template for intrinsic elements, `createComponent`
    /// for components.
    pub(super) fn compile_element_root(
        &mut self,
        element: ArenaBox<'a, JSXElement<'a>>,
    ) -> Compiled<'a> {
        if !is_intrinsic(&element.opening_element.name) {
            return self.compile_component(element);
        }
        if self.server() {
            return self.ssr_element_root(element);
        }
        let span = element.span;
        let tag = tag_name(&element.opening_element.name);
        let namespace = html::root_namespace(self.namespace(), &tag);
        let mut template = Template::new(namespace);
        self.build_element(&mut template, element, None, namespace);
        let emitted = template.emit(self, span, false);
        Compiled {
            setup: emitted.setup,
            value: emitted.whole,
        }
    }

    /// Adds an intrinsic element (attributes, then children) to `template`.
    pub(super) fn build_element(
        &mut self,
        template: &mut Template<'a>,
        element: ArenaBox<'a, JSXElement<'a>>,
        parent: Option<usize>,
        namespace: Namespace,
    ) -> usize {
        let span = element.span;
        let element = element.unbox();
        let opening = element.opening_element.unbox();
        let tag = tag_name(&opening.name);
        let node = template.add(
            parent,
            NodeKind::Element {
                tag: tag.clone(),
                attrs: Vec::new(),
            },
            span,
        );
        let mut attributes = opening.attributes;
        // A `<select>`'s value can only select an option that exists: set it after the options
        // are inserted.
        let deferred = if tag == "select" {
            self.select_value_attributes(&mut attributes)
        } else {
            self.ast.vec()
        };
        let has_inner_html = self.element_attributes(template, node, attributes);
        for token in self.scope_tokens(span) {
            template.element_attrs_mut(node).push((token, None));
        }
        if !has_inner_html {
            let child_namespace = html::child_namespace(namespace, &tag);
            self.build_children(template, Some(node), element.children, child_namespace);
        }
        if !deferred.is_empty() {
            self.element_attributes(template, node, deferred);
        }
        node
    }

    /// Takes the `value` / `bind:value` attributes out of a `<select>`'s attributes (none when
    /// there is a spread, which applies everything in order).
    fn select_value_attributes(
        &self,
        attributes: &mut oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>> {
        let mut deferred = self.ast.vec();
        if attributes
            .iter()
            .any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        {
            return deferred;
        }
        let mut index = 0;
        while index < attributes.len() {
            let is_value = matches!(&attributes[index], JSXAttributeItem::Attribute(attribute)
                if matches!(attribute_name(&attribute.name).as_str(), "value" | "bind:value"));
            if is_value {
                deferred.push(attributes.remove(index));
            } else {
                index += 1;
            }
        }
        deferred
    }

    /// Processes the attributes of `node`. Returns true when `innerHTML` replaces the children.
    fn element_attributes(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        attributes: oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> bool {
        if attributes
            .iter()
            .any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        {
            self.spread_attributes(template, node, attributes);
            return false;
        }
        let mut inner_html = false;
        for item in attributes {
            let JSXAttributeItem::Attribute(attribute) = item else {
                continue;
            };
            let attribute = attribute.unbox();
            let span = attribute.span;
            let name = attribute_name(&attribute.name);
            let value = attr_value(attribute.value);
            match name.as_str() {
                "key" => {}
                _ if name.starts_with("client:") => {}
                "class" => self.class_attribute(template, node, value, span),
                "style" => self.style_attribute(template, node, value, span),
                "ref" | "attach" | "bind:value" | "bind:checked" => {
                    if let AttrValue::Expr(expr) = value {
                        self.helper_attribute(template, node, &name, expr, span);
                    }
                }
                _ if name.starts_with("on:") => {
                    if let AttrValue::Expr(expr) = value {
                        let handler = self.visited(expr);
                        let event = self.ast.string(span, &name[3..]);
                        template.push(Op::Call {
                            span,
                            helper: "listen",
                            node,
                            args: vec![event, handler],
                        });
                    }
                }
                _ if super::events::event_name(&name).is_some() => {
                    if let AttrValue::Expr(expr) = value {
                        self.event_attribute(template, node, &name, expr, span);
                    }
                }
                _ => {
                    inner_html |= name == "innerHTML";
                    self.plain_attribute(template, node, &name, value, span);
                }
            }
        }
        inner_html
    }

    fn helper_attribute(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        name: &str,
        expr: Expression<'a>,
        span: Span,
    ) {
        let expr = self.visited(expr);
        let (helper, arg) = match name {
            "ref" => ("useRef", expr),
            "bind:value" => ("bindValue", expr),
            "bind:checked" => ("bindChecked", expr),
            _ => {
                let list = if matches!(expr.without_parentheses(), Expression::ArrayExpression(_)) {
                    expr
                } else {
                    self.ast.array(span, [expr])
                };
                ("attach", self.ast.arrow(span, &[], list))
            }
        };
        template.push(Op::Call {
            span,
            helper,
            node,
            args: vec![arg],
        });
    }

    fn plain_attribute(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        name: &str,
        value: AttrValue<'a>,
        span: Span,
    ) {
        let constant = match value {
            AttrValue::Empty => return,
            AttrValue::True => Literal::Bool(true),
            AttrValue::Str(s) => Literal::Str(s),
            AttrValue::Expr(expr) => match literal(&expr) {
                Some(lit) => lit,
                None => {
                    let expr = self.visited(expr);
                    let property = is_property(name);
                    if self.is_dynamic(&expr) {
                        let apply =
                            self.apply_fn(if property { "setProp" } else { "setAttr" }, name, span);
                        template.push(Op::Bind {
                            span,
                            node,
                            compute: self.compute(expr),
                            apply,
                        });
                    } else if property {
                        template.push(Op::Assign {
                            span,
                            node,
                            prop: name.to_owned(),
                            value: expr,
                        });
                    } else {
                        let attr = self.ast.string(span, name);
                        template.push(Op::Call {
                            span,
                            helper: "setAttr",
                            node,
                            args: vec![attr, expr],
                        });
                    }
                    return;
                }
            },
        };
        // A `<textarea>` has no `value` attribute: its value is the content or the property.
        let property_only =
            is_property_only(name) || (name == "value" && template.tag(node) == Some("textarea"));
        match constant {
            Literal::Str(value) if property_only => {
                let value = self.ast.string(span, &value);
                template.push(Op::Assign {
                    span,
                    node,
                    prop: name.to_owned(),
                    value,
                });
            }
            Literal::Bool(true) if property_only => {
                let value = self.ast.boolean(span, true);
                template.push(Op::Assign {
                    span,
                    node,
                    prop: name.to_owned(),
                    value,
                });
            }
            Literal::Str(value) => template
                .element_attrs_mut(node)
                .push((name.to_owned(), Some(value))),
            Literal::Bool(true) => template
                .element_attrs_mut(node)
                .push((name.to_owned(), None)),
            Literal::Bool(false) | Literal::Nullish => {}
        }
    }

    fn class_attribute(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        value: AttrValue<'a>,
        span: Span,
    ) {
        let expr = match value {
            AttrValue::Empty | AttrValue::True => return,
            AttrValue::Str(s) => {
                template
                    .element_attrs_mut(node)
                    .push(("class".to_owned(), Some(s)));
                return;
            }
            AttrValue::Expr(expr) => expr,
        };
        match literal(&expr) {
            Some(Literal::Str(s)) => {
                template
                    .element_attrs_mut(node)
                    .push(("class".to_owned(), Some(s)));
                return;
            }
            Some(_) => return,
            None => {}
        }
        if let Expression::ArrayExpression(array) = expr.without_parentheses()
            && let Some(parts) = static_strings(array)
        {
            let joined = parts.join(" ");
            if !joined.is_empty() {
                template
                    .element_attrs_mut(node)
                    .push(("class".to_owned(), Some(joined)));
            }
            return;
        }
        if let Expression::ObjectExpression(object) = expr.without_parentheses()
            && static_object_keys(object)
                .is_some_and(|keys| keys.iter().all(|k| !k.contains(char::is_whitespace)))
        {
            let Expression::ObjectExpression(object) = strip_parens(expr) else {
                unreachable!("checked above")
            };
            let mut baked = Vec::new();
            for property in object.unbox().properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    continue;
                };
                let property = property.unbox();
                let key = property_key_name(&property.key)
                    .unwrap_or_default()
                    .to_owned();
                match literal(&property.value) {
                    Some(Literal::Bool(true)) => baked.push(key),
                    Some(Literal::Str(s)) if !s.is_empty() => baked.push(key),
                    Some(_) => {}
                    None => {
                        let value = self.visited(property.value);
                        if self.is_dynamic(&value) {
                            let apply = self.apply_fn("toggleClass", &key, span);
                            template.push(Op::Bind {
                                span,
                                node,
                                compute: self.compute(value),
                                apply,
                            });
                        } else {
                            let key = self.ast.string(span, &key);
                            template.push(Op::Call {
                                span,
                                helper: "toggleClass",
                                node,
                                args: vec![key, value],
                            });
                        }
                    }
                }
            }
            if !baked.is_empty() {
                template
                    .element_attrs_mut(node)
                    .push(("class".to_owned(), Some(baked.join(" "))));
            }
            return;
        }
        let expr = self.visited(expr);
        let passes_class = self.reads_props_class(&expr);
        if self.is_dynamic(&expr) {
            let apply = self.runtime("setClass", span);
            template.push(Op::Bind {
                span,
                node,
                compute: self.compute(expr),
                apply,
            });
        } else {
            template.push(Op::Call {
                span,
                helper: "setClass",
                node,
                args: vec![expr],
            });
        }
        if let Some(props_name) = passes_class {
            let scope = self
                .ast
                .member(span, self.ast.ident(span, &props_name), "$$scope");
            template.push(Op::Call {
                span,
                helper: "applyScope",
                node,
                args: vec![scope],
            });
        }
    }

    /// The props name when `expr` reads `props.class` (class passthrough, spec §4.6.2).
    pub(super) fn reads_props_class(&self, expr: &Expression<'a>) -> Option<String> {
        let props_name = self.component()?.props_name.clone();
        let mut finder = ClassReadFinder {
            props_name: &props_name,
            found: false,
        };
        finder.visit_expression(expr);
        finder.found.then_some(props_name)
    }

    fn style_attribute(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        value: AttrValue<'a>,
        span: Span,
    ) {
        let expr = match value {
            AttrValue::Empty | AttrValue::True => return,
            AttrValue::Str(s) => {
                template
                    .element_attrs_mut(node)
                    .push(("style".to_owned(), Some(s)));
                return;
            }
            AttrValue::Expr(expr) => expr,
        };
        match literal(&expr) {
            Some(Literal::Str(s)) => {
                template
                    .element_attrs_mut(node)
                    .push(("style".to_owned(), Some(s)));
                return;
            }
            Some(_) => return,
            None => {}
        }
        if let Expression::ObjectExpression(object) = expr.without_parentheses()
            && static_object_keys(object).is_some()
        {
            let Expression::ObjectExpression(object) = strip_parens(expr) else {
                unreachable!("checked above")
            };
            let mut baked = Vec::new();
            for property in object.unbox().properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    continue;
                };
                let property = property.unbox();
                let key = property_key_name(&property.key)
                    .unwrap_or_default()
                    .to_owned();
                match literal(&property.value) {
                    Some(Literal::Str(s)) => baked.push(format!("{key}:{s}")),
                    Some(_) => {}
                    None => {
                        let value = self.visited(property.value);
                        if self.is_dynamic(&value) {
                            let apply = self.apply_fn("setStyleProperty", &key, span);
                            template.push(Op::Bind {
                                span,
                                node,
                                compute: self.compute(value),
                                apply,
                            });
                        } else {
                            let key = self.ast.string(span, &key);
                            template.push(Op::Call {
                                span,
                                helper: "setStyleProperty",
                                node,
                                args: vec![key, value],
                            });
                        }
                    }
                }
            }
            if !baked.is_empty() {
                template
                    .element_attrs_mut(node)
                    .push(("style".to_owned(), Some(baked.join(";"))));
            }
            return;
        }
        let expr = self.visited(expr);
        if self.is_dynamic(&expr) {
            let apply = self.runtime("setStyle", span);
            template.push(Op::Bind {
                span,
                node,
                compute: self.compute(expr),
                apply,
            });
        } else {
            template.push(Op::Call {
                span,
                helper: "setStyle",
                node,
                args: vec![expr],
            });
        }
    }

    /// `<div {...rest} class="x">`: every attribute goes through `spread`, in order, so later
    /// attributes override earlier spreads.
    fn spread_attributes(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        attributes: oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
    ) {
        let span = template.nodes[node].span;
        let props = self.props_expression(attributes, None, span);
        let thunk = self.ast.arrow(span, &[], props);
        template.push(Op::Call {
            span,
            helper: "spread",
            node,
            args: vec![thunk],
        });
    }
}

struct ClassReadFinder<'p> {
    props_name: &'p str,
    found: bool,
}

impl<'a> Visit<'a> for ClassReadFinder<'_> {
    fn visit_static_member_expression(&mut self, it: &StaticMemberExpression<'a>) {
        if it.property.name == "class"
            && matches!(&it.object, Expression::Identifier(ident) if ident.name == self.props_name)
        {
            self.found = true;
        }
        walk::walk_static_member_expression(self, it);
    }
}

pub(super) fn strip_parens(mut expr: Expression<'_>) -> Expression<'_> {
    while let Expression::ParenthesizedExpression(paren) = expr {
        expr = paren.unbox().expression;
    }
    expr
}

/// The keys of an object literal when all are static (no spreads, methods or computed keys).
pub(super) fn static_object_keys(object: &ObjectExpression<'_>) -> Option<Vec<String>> {
    object
        .properties
        .iter()
        .map(|property| match property {
            ObjectPropertyKind::ObjectProperty(p)
                if p.kind == PropertyKind::Init
                    && !p.method
                    && (!p.computed || matches!(p.key, PropertyKey::StringLiteral(_))) =>
            {
                property_key_name(&p.key).map(str::to_owned)
            }
            _ => None,
        })
        .collect()
}

/// The elements of an array literal of string constants.
pub(super) fn static_strings(array: &ArrayExpression<'_>) -> Option<Vec<String>> {
    array
        .elements
        .iter()
        .map(|element| match element.as_expression().and_then(literal) {
            Some(Literal::Str(s)) => Some(s),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()
        .map(|parts| parts.into_iter().filter(|p| !p.is_empty()).collect())
}
