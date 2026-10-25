//! Intrinsic elements: tag, static attributes baked into the template, and the operations for
//! dynamic attributes (`class`/`style` objects per key, properties, refs, attachments, two-way
//! bindings, listeners and spreads).

use oxc_allocator::ArenaBox;
use oxc_ast::ast::*;
use oxc_span::{GetSpan, Span};

use super::children::{Item, RawContent, has_content};
use super::class_flow::ClassFlow;
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

/// A custom element's tag: one with a dash (`annotation-xml` aside, a MathML element).
pub(super) fn is_custom_element(tag: &str) -> bool {
    tag.contains('-') && tag != "annotation-xml"
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

/// Attributes whose boolean values are written as "true"/"false" instead of present/absent:
/// `aria-*` and the enumerated (`Booleanish`) attributes of HTML, SVG and MathML. The runtime's
/// `BOOLEANISH` (lumiose/dom `setAttr`, lumiose/server `attr`), so static folding agrees with it.
pub(super) fn is_booleanish(name: &str) -> bool {
    name.starts_with("aria-")
        || matches!(
            name,
            "contenteditable"
                | "draggable"
                | "spellcheck"
                | "writingsuggestions"
                | "preserveAlpha"
                | "displaystyle"
                | "accent"
                | "accentunder"
                | "fence"
                | "largeop"
                | "movablelimits"
                | "separator"
                | "stretchy"
                | "symmetric"
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
        let mut children = element.children;
        let spread_children = self.props_children(&tag, &mut attributes, &mut children);
        // A `<select>`'s value can only select an option that exists: set it after the options
        // are inserted.
        let deferred = if tag == "select" {
            self.select_value_attributes(&mut attributes)
        } else {
            self.ast.vec()
        };
        let auto_nonce = self.options.strict_csp
            && matches!(tag.as_str(), "script" | "style")
            && !has_attribute(&attributes, "nonce");
        // `Some(json)` for a `<script>` or `<style>`, whose content is raw text.
        let raw_text =
            html::is_raw_text(namespace, &tag).then(|| is_json_script(&tag, &attributes));
        // Their `innerHTML` is raw text too: browsers parse it as text, so it is set as
        // `textContent`, which needs no parser at all (TASK-472 L7).
        let mut sets_text = false;
        if raw_text.is_some() {
            for item in attributes.iter_mut() {
                if let JSXAttributeItem::Attribute(attribute) = item
                    && matches!(
                        attribute_name(&attribute.name).as_str(),
                        "innerHTML" | "textContent"
                    )
                {
                    sets_text = true;
                    let span = attribute.name.span();
                    attribute.name =
                        JSXAttributeName::new_identifier(span, "textContent", self.ast);
                }
            }
        }
        let has_inner_html = self.element_attributes(template, node, attributes) || sets_text;
        if auto_nonce {
            // Strict CSP (decision-27): the page's nonce, before the element is inserted.
            template.push(Op::Call {
                span,
                helper: "setNonce",
                node,
                args: Vec::new(),
            });
        }
        let markers = self.scope_tokens(span);
        self.stamp_scope(template.element_attrs_mut(node), markers);
        if let Some((name, value)) = self.source_attribute(&tag, span) {
            template.element_attrs_mut(node).push((name, Some(value)));
        }
        if !has_inner_html {
            let child_namespace = html::child_namespace(namespace, &tag);
            match raw_text {
                Some(json) => {
                    self.build_raw_text(template, node, &tag, json, children, child_namespace);
                }
                None => self.build_children(template, Some(node), children, child_namespace),
            }
        }
        if let Some((object, nullable)) = spread_children {
            template.push(Op::SpreadChildren {
                span,
                parent: node,
                object,
                nullable,
            });
        }
        if !deferred.is_empty() {
            self.element_attributes(template, node, deferred);
        }
        node
    }

    /// The content of a `<script>` or `<style>` (TASK-472 L7): static text goes into the
    /// template as `rawText()` writes it on the server, not HTML-escaped (which the parser would
    /// not decode); a dynamic value is a text node the client writes.
    fn build_raw_text(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        tag: &str,
        json: bool,
        children: oxc_allocator::ArenaVec<'a, JSXChild<'a>>,
        namespace: Namespace,
    ) {
        let span = template.nodes[node].span;
        let items = self.child_items(children);
        let items = match self.raw_content(items, span) {
            Ok(RawContent::Static(text)) => {
                if !text.is_empty() {
                    template.add(
                        Some(node),
                        NodeKind::Raw(html::raw_text(&text, tag, json)),
                        span,
                    );
                }
                return;
            }
            Ok(RawContent::Dynamic(value)) => vec![Item::Dynamic(value)],
            Err(items) => items,
        };
        self.namespaces.push(namespace);
        self.build_items(template, node, items, namespace);
        self.namespaces.pop();
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
        mut attributes: oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> bool {
        if attributes
            .iter()
            .any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        {
            let written = take_written(self.ast, &mut attributes);
            let attributes = self.bake_before_spreads(template, node, attributes);
            self.spread_attributes(template, node, attributes);
            return !written.is_empty() && self.element_attributes(template, node, written);
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
                _ if name.starts_with("bind:")
                    && template.tag(node).is_some_and(is_custom_element) =>
                {
                    if let AttrValue::Expr(expr) = value {
                        let property = self.ast.string(span, &name["bind:".len()..]);
                        let signal = self.visited(expr);
                        template.push(Op::Call {
                            span,
                            helper: "bindProperty",
                            node,
                            args: vec![property, signal],
                        });
                    }
                }
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
            Literal::Bool(value) if is_booleanish(name) => template
                .element_attrs_mut(node)
                .push((name.to_owned(), Some(value.to_string()))),
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

    /// The props name when `expr` may carry `props.class` (class passthrough, class_flow.rs).
    pub(super) fn reads_props_class(&self, expr: &Expression<'a>) -> Option<String> {
        let component = self.component()?;
        let flow = ClassFlow {
            props_name: &component.props_name,
            props: &component.props,
            carriers: &component.class_carriers,
            scoping: self.scoping,
            found: false,
        };
        flow.check(expr).then(|| component.props_name.clone())
    }

    /// A static `style` string: baked into the template, or with strict CSP applied through the
    /// CSSOM (`setStyle`), since a policy without `'unsafe-inline'` refuses `style="…"`.
    fn static_style(&mut self, template: &mut Template<'a>, node: usize, css: String, span: Span) {
        if self.options.strict_csp {
            let css = self.ast.string(span, &css);
            template.push(Op::Call {
                span,
                helper: "setStyle",
                node,
                args: vec![css],
            });
        } else {
            template
                .element_attrs_mut(node)
                .push(("style".to_owned(), Some(css)));
        }
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
                self.static_style(template, node, s, span);
                return;
            }
            AttrValue::Expr(expr) => expr,
        };
        match literal(&expr) {
            Some(Literal::Str(s)) => {
                self.static_style(template, node, s, span);
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
                    // Strict CSP: one CSSOM write per key, in order with the dynamic ones.
                    Some(Literal::Str(s)) if self.options.strict_csp => {
                        let key = self.ast.string(span, &key);
                        let value = self.ast.string(span, &s);
                        template.push(Op::Call {
                            span,
                            helper: "setStyleProperty",
                            node,
                            args: vec![key, value],
                        });
                    }
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
                self.static_style(template, node, baked.join(";"), span);
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

    /// Bakes the constant attributes written before the first spread into the template when
    /// every spread is the component's props object or its `...rest` (TASK-97): their keys are
    /// fixed, so a key the spread does not have never appears later, and one it has overrides the
    /// baked value exactly as the merged props would. `<svg viewBox="…" {...rest}>` then clones
    /// its defaults instead of setting them on every render. `class`, `style`, properties,
    /// events and helpers keep their runtime semantics in the spread. Returns the attributes
    /// left for the spread.
    fn bake_before_spreads(
        &mut self,
        template: &mut Template<'a>,
        node: usize,
        attributes: oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>> {
        let Some(component) = self.component() else {
            return attributes;
        };
        let fixed_keys = attributes.iter().all(|item| match item {
            JSXAttributeItem::SpreadAttribute(spread) => {
                matches!(spread.argument.without_parentheses(), Expression::Identifier(ident)
                    if crate::analyze::reactivity::symbol_of(self.scoping, ident)
                        .is_some_and(|symbol| component.props_objects.contains(&symbol)))
            }
            JSXAttributeItem::Attribute(_) => true,
        });
        if !fixed_keys {
            return attributes;
        }
        let first_spread = attributes
            .iter()
            .position(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
            .unwrap_or(attributes.len());
        let name_of = |item: &JSXAttributeItem<'_>| match item {
            JSXAttributeItem::Attribute(attribute) => Some(attribute_name(&attribute.name)),
            JSXAttributeItem::SpreadAttribute(_) => None,
        };
        let mut left = self.ast.vec();
        for (index, item) in attributes.into_iter().enumerate() {
            let name = name_of(&item).unwrap_or_default();
            let bakeable = index < first_spread
                && !name.is_empty()
                && !matches!(name.as_str(), "class" | "style" | "key" | "ref" | "attach")
                && !name.contains(':')
                && !is_property(&name)
                && super::events::event_name(&name).is_none()
                && !left
                    .iter()
                    .any(|earlier| name_of(earlier).as_ref() == Some(&name));
            let constant = match &item {
                JSXAttributeItem::Attribute(attribute) if bakeable => match &attribute.value {
                    None => Some(None),
                    Some(JSXAttributeValue::StringLiteral(text)) => {
                        Some(Some(decode_entities(&text.value)))
                    }
                    _ => None,
                },
                _ => None,
            };
            match constant {
                Some(value) => template.element_attrs_mut(node).push((name, value)),
                None => left.push(item),
            }
        }
        left
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

    /// `<button {...props} />`: an element without content of its own renders the `children` of
    /// its spreads and `children` attribute, as in React and Solid (TASK-347). As in the merged
    /// props, the last source that has `children` wins; written content wins over all of them.
    /// `children` attributes are taken out: they are never attributes.
    ///
    /// With a `children` attribute, the element gets a `{….children}` child, which compiles like a
    /// written one on both targets. With spreads only, returns the (visited) props object: the
    /// caller inserts its `children` only when the object has that key, on both targets, so an
    /// element whose spreads carry none leaves its content to scripts and the browser
    /// (`<selectedcontent>`, a list a script fills before the island hydrates). The flag is
    /// whether the object may be nullish or `false` ([`Self::has_children_key`]).
    pub(super) fn props_children(
        &mut self,
        tag: &str,
        attributes: &mut oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
        children: &mut oxc_allocator::ArenaVec<'a, JSXChild<'a>>,
    ) -> Option<(Expression<'a>, bool)> {
        let mut sources = Vec::new();
        // A spread that awaits is not read twice: its await site would run twice.
        let mut suspends = false;
        let mut index = 0;
        while index < attributes.len() {
            match &attributes[index] {
                JSXAttributeItem::SpreadAttribute(spread) => {
                    suspends |= super::dynamic_and_suspends(&spread.argument).1;
                    // Cloned: the spread keeps its own.
                    let object = super::clone_expression(self.ast, &spread.argument);
                    sources.push(ChildrenSource::Spread(object));
                    index += 1;
                }
                JSXAttributeItem::Attribute(attribute)
                    if attribute_name(&attribute.name) == "children" =>
                {
                    let JSXAttributeItem::Attribute(attribute) = attributes.remove(index) else {
                        unreachable!("matched above");
                    };
                    let attribute = attribute.unbox();
                    let span = attribute.span;
                    let value = match attr_value(attribute.value) {
                        AttrValue::Expr(expr) => expr,
                        AttrValue::Str(text) => self.ast.string(span, &text),
                        AttrValue::True => self.ast.boolean(span, true),
                        AttrValue::Empty => self.ast.undefined(span),
                    };
                    sources.push(ChildrenSource::Value(value));
                }
                JSXAttributeItem::Attribute(_) => index += 1,
            }
        }
        // Written content replaces the children, as it does written children (TASK-478).
        let writes_content = attributes.iter().any(|item| {
            matches!(item, JSXAttributeItem::Attribute(attribute) if is_written_content(&attribute.name))
        });
        if suspends
            || writes_content
            || !takes_markup(tag)
            || has_content(self.source, self.blocks, children)
        {
            return None;
        }
        let last = sources.pop()?;
        let span = last.span();
        let spreads_only = sources
            .iter()
            .chain([&last])
            .all(|source| matches!(source, ChildrenSource::Spread(_)));
        let merged = |cg: &mut Self, sources: Vec<ChildrenSource<'a>>| {
            let callee = cg.runtime("mergeProps", span);
            let ast = cg.ast;
            let arguments = sources.into_iter().map(|source| match source {
                ChildrenSource::Spread(object) => object,
                ChildrenSource::Value(value) => {
                    ast.object(span, [ast.getter(span, "children", Vec::new(), value)])
                }
            });
            ast.call(span, callee, arguments.collect::<Vec<_>>())
        };
        let value = match last {
            ChildrenSource::Spread(object) if sources.is_empty() => {
                // The component's props and its `...rest` are objects; any other spread may be
                // nullish or `false`.
                let nullable = !self.is_props_object(&object);
                return Some((self.visited(object), nullable));
            }
            last if spreads_only => {
                sources.push(last);
                let object = merged(self, sources);
                return Some((self.visited(object), false));
            }
            // A later `children` attribute wins over every spread before it.
            ChildrenSource::Value(value) => value,
            last => {
                sources.push(last);
                let object = merged(self, sources);
                self.ast.member(span, object, "children")
            }
        };
        children.clear();
        children.push(JSXChild::new_expression_container(
            span,
            JSXExpression::from(value),
            self.ast,
        ));
        None
    }

    /// `"children" in props`: whether a spread's props object carries `children`
    /// ([`Self::props_children`]). Its keys are fixed once created, like the props it spreads.
    /// A `nullable` one is checked as `props || {}`: a spread may be nullish or `false`
    /// (`{...props.extra}`, `{...props.itemProps?.(item)}`, `{...(open && attrs)}`), which `in`
    /// throws on (TASK-569).
    pub(super) fn has_children_key(
        &self,
        object: Expression<'a>,
        nullable: bool,
        span: Span,
    ) -> Expression<'a> {
        let key = self.ast.string(span, "children");
        let object = if nullable {
            self.ast.or(span, object, self.ast.object(span, []))
        } else {
            object
        };
        self.ast
            .binary(span, key, oxc_syntax::operator::BinaryOperator::In, object)
    }

    /// Whether `expr` is the component's props object or its `...rest`, whose keys are fixed.
    fn is_props_object(&self, expr: &Expression<'a>) -> bool {
        let Some(component) = self.component() else {
            return false;
        };
        matches!(expr.without_parentheses(), Expression::Identifier(ident)
            if crate::analyze::reactivity::symbol_of(self.scoping, ident)
                .is_some_and(|symbol| component.props_objects.contains(&symbol)))
    }
}

/// Where an element's `children` prop can come from, in attribute order.
enum ChildrenSource<'a> {
    /// The argument of a spread.
    Spread(Expression<'a>),
    /// The value of a `children` attribute.
    Value(Expression<'a>),
}

impl ChildrenSource<'_> {
    fn span(&self) -> Span {
        match self {
            Self::Spread(expr) | Self::Value(expr) => expr.span(),
        }
    }
}

/// Whether an element's content is markup that `children` can render into: not a void element,
/// raw text, a form value or a separate document.
pub fn takes_markup(tag: &str) -> bool {
    !html::is_void(tag)
        && !matches!(
            tag,
            "script" | "style" | "textarea" | "template" | "noscript" | "iframe"
        )
}

/// Takes the attributes out of a list with spreads that apply after the spread instead of going
/// through it: `bind:` two-way bindings and `attach` attachments, which are not props (an
/// attachment runs with the element as without a spread, and adds to the spread's own, TASK-568),
/// a written `innerHTML` or `textContent` ([`is_written_content`]), and a written `srcdoc`, which a
/// spread never writes either (TASK-496).
pub(super) fn take_written<'a>(
    ast: &super::super::ast::Ast<'a>,
    attributes: &mut oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>>,
) -> oxc_allocator::ArenaVec<'a, JSXAttributeItem<'a>> {
    let mut bindings = ast.vec();
    let mut index = 0;
    while index < attributes.len() {
        let is_binding = matches!(&attributes[index], JSXAttributeItem::Attribute(attribute)
            if attribute_name(&attribute.name).starts_with("bind:")
                || matches!(attribute_name(&attribute.name).as_str(), "attach" | "srcdoc")
                || is_written_content(&attribute.name));
        if is_binding {
            bindings.push(attributes.remove(index));
        } else {
            index += 1;
        }
    }
    bindings
}

/// `innerHTML` or `textContent`: content a spread never writes (TASK-470), so a written one applies
/// on its own, on both targets (TASK-478).
pub fn is_written_content(name: &JSXAttributeName<'_>) -> bool {
    matches!(attribute_name(name).as_str(), "innerHTML" | "textContent")
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

/// Whether `tag` is a `<script>` whose static `type` names JSON ([`html::is_json_script_type`]).
pub(super) fn is_json_script(tag: &str, attributes: &[JSXAttributeItem<'_>]) -> bool {
    tag == "script" && attributes.iter().any(|item| match item {
        JSXAttributeItem::Attribute(attribute) if attribute_name(&attribute.name) == "type" => {
            match &attribute.value {
                Some(JSXAttributeValue::StringLiteral(value)) => {
                    html::is_json_script_type(&value.value)
                }
                Some(JSXAttributeValue::ExpressionContainer(container)) => matches!(
                    &container.expression,
                    JSXExpression::StringLiteral(value) if html::is_json_script_type(&value.value)
                ),
                _ => false,
            }
        }
        _ => false,
    })
}

/// Whether `attributes` has an attribute named `name` (spreads may still set it at runtime).
pub(super) fn has_attribute(attributes: &[JSXAttributeItem<'_>], name: &str) -> bool {
    attributes.iter().any(|item| {
        matches!(item, JSXAttributeItem::Attribute(attribute) if attribute_name(&attribute.name) == name)
    })
}
