//! Server target (contract doc-2 §3, spec §5.3): JSX becomes `ssr(parts, ...holes)` on
//! `lumen/server`, with the static HTML hoisted into deduplicated part arrays and every dynamic
//! value passed through a runtime helper (string holes are trusted HTML).
//!
//! The output mirrors the client walk so that islands hydrate: wherever the client calls
//! `insert`, `list` or `branch` the server has an `insert()`, `list()` or `branch()` hole (each one
//! dynamic region, wrapped in markers by the runtime inside islands), a text-like child that the
//! client compiles to a text node (alone between nodes: `setText` or a one-time write) is a
//! `text()` hole, and the static HTML is the client template's (same text normalisation,
//! implicit `<tbody>`, scope tokens) without its `<!>` placeholders.
//! Attributes follow the client's DOM order: static and baked ones, scope tokens, then dynamic
//! ones in source order. Event handlers, refs and attachments do not exist on the server.

use oxc_allocator::{ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::{GetSpan, Span};
use oxc_syntax::operator::BinaryOperator;

use super::children::{Item, Kind, group_table_rows, is_isolated};
use super::element::{
    AttrValue, Literal, attr_value, attribute_name, literal, static_object_keys, static_strings,
    strip_parens, tag_name,
};
use super::events::event_name;
use super::html;
use super::{Codegen, Compiled};
use crate::analyze::{is_jsx_like, property_key_name};

/// Server output under construction: hoisted static parts around holes.
pub struct Ssr<'a> {
    /// Escaped HTML; always one more than `holes`.
    parts: Vec<String>,
    holes: Vec<Expression<'a>>,
    setup: Vec<Statement<'a>>,
    /// The decoded text when the buffer only holds text (a fragment's text item).
    plain: String,
    /// True once the buffer holds elements, raw HTML or holes.
    markup: bool,
}

impl<'a> Ssr<'a> {
    pub fn new() -> Self {
        Self {
            parts: vec![String::new()],
            holes: Vec::new(),
            setup: Vec::new(),
            plain: String::new(),
            markup: false,
        }
    }

    fn html(&mut self, html: &str) {
        self.markup = true;
        self.last().push_str(html);
    }

    fn text(&mut self, text: &str) {
        self.plain.push_str(text);
        html::escape_text(text, self.last());
    }

    fn attribute(&mut self, name: &str, value: Option<&str>) {
        html::write_attribute(name, value, self.last());
    }

    fn hole(&mut self, hole: Expression<'a>) {
        self.markup = true;
        self.holes.push(hole);
        self.parts.push(String::new());
    }

    fn piece(&mut self, piece: Piece<'a>) {
        match piece {
            Piece::Html(html) => self.html(&html),
            Piece::Hole(hole) => self.hole(hole),
        }
    }

    fn last(&mut self) -> &mut String {
        self.parts.last_mut().expect("parts are never empty")
    }

    fn is_empty(&self) -> bool {
        self.holes.is_empty() && self.parts[0].is_empty()
    }

    /// `ssr(_sN, ...holes)` with the hoisted parts.
    fn emit(self, cg: &mut Codegen<'a, '_>, span: Span) -> Compiled<'a> {
        let name = cg.ssr_parts(&self.parts, span);
        let callee = cg.runtime("ssr", span);
        let args = std::iter::once(cg.ast.ident(span, &name)).chain(self.holes);
        Compiled {
            setup: self.setup,
            value: cg.ast.call(span, callee, args),
        }
    }
}

/// Static HTML or a hole.
enum Piece<'a> {
    Html(String),
    Hole(Expression<'a>),
}

/// The attributes of an opening tag, in client DOM order, plus a content override.
#[derive(Default)]
struct OpenTag<'a> {
    /// Static attributes and the `class`/`style` attributes the client bakes into its template.
    head: Vec<Piece<'a>>,
    /// Attributes the client sets after cloning, in source order.
    tail: Vec<Piece<'a>>,
    /// `innerHTML`, `textContent` or a `<textarea>` value, replacing the children.
    content: Option<Piece<'a>>,
}

impl<'a> Codegen<'a, '_> {
    /// An intrinsic JSX element in value position: `ssr(_sN, ...holes)`.
    pub(super) fn ssr_element_root(
        &mut self,
        element: ArenaBox<'a, JSXElement<'a>>,
    ) -> Compiled<'a> {
        let span = element.span;
        let mut out = Ssr::new();
        self.ssr_element(&mut out, element);
        out.emit(self, span)
    }

    /// A fragment or a component's children: one renderable, or an array of them. Runs of static
    /// items become one `ssr()` node (a lone text stays a string, escaped by the runtime);
    /// dynamic items are values, rendered by whoever renders the array.
    pub(super) fn ssr_fragment_items(&mut self, items: Vec<Item<'a>>, span: Span) -> Compiled<'a> {
        let mut values = Vec::new();
        let mut setup = Vec::new();
        let mut run = Ssr::new();
        for item in items {
            match item {
                Item::Text(text, _) => run.text(&text),
                Item::Raw(raw, span) => self.ssr_raw(&mut run, &raw, span),
                Item::Element(element) => self.ssr_element(&mut run, element),
                Item::Dynamic(expression) => {
                    self.flush_run(&mut run, &mut values, &mut setup, span);
                    let compiled = self.ssr_renderable(expression);
                    setup.extend(compiled.setup);
                    values.push(compiled.value);
                }
                Item::Rows(..) => unreachable!("rows are only grouped in <table> children"),
            }
        }
        self.flush_run(&mut run, &mut values, &mut setup, span);
        let value = if values.len() == 1 {
            values.pop().expect("one value")
        } else {
            self.ast.array(span, values)
        };
        Compiled { setup, value }
    }

    fn flush_run(
        &mut self,
        run: &mut Ssr<'a>,
        values: &mut Vec<Expression<'a>>,
        setup: &mut Vec<Statement<'a>>,
        span: Span,
    ) {
        if run.is_empty() {
            return;
        }
        let run = std::mem::replace(run, Ssr::new());
        if !run.markup {
            values.push(self.ast.string(span, &run.plain));
            return;
        }
        let compiled = run.emit(self, span);
        setup.extend(compiled.setup);
        values.push(compiled.value);
    }

    /// A dynamic fragment item: compiled JSX, or the visited expression.
    fn ssr_renderable(&mut self, expression: Expression<'a>) -> Compiled<'a> {
        let expression = match self.live_value(expression) {
            Ok(compiled) => return compiled,
            Err(expression) => expression,
        };
        if matches!(
            expression.without_parentheses(),
            Expression::JSXElement(_) | Expression::JSXFragment(_)
        ) || is_jsx_like(&expression)
        {
            self.compile_value(expression)
        } else {
            Compiled::value(self.visited(expression))
        }
    }

    /// Writes an intrinsic element: opening tag, content, closing tag.
    fn ssr_element(&mut self, out: &mut Ssr<'a>, element: ArenaBox<'a, JSXElement<'a>>) {
        let span = element.span;
        let element = element.unbox();
        let mut opening = element.opening_element.unbox();
        let tag = tag_name(&opening.name);
        let select = if tag == "select" {
            self.ssr_select_value(out, &mut opening.attributes)
        } else {
            None
        };
        let selected = if tag == "option" {
            self.ssr_option_selected(&opening.attributes, &element.children, span)
        } else {
            None
        };
        let mut open = OpenTag::default();
        let auto_nonce = self.options.strict_csp
            && matches!(tag.as_str(), "script" | "style")
            && !super::element::has_attribute(&opening.attributes, "nonce");
        self.ssr_attributes(&tag, opening.attributes, &mut open, span);
        if auto_nonce {
            // Strict CSP (decision-27): the response's nonce; after a spread, whose own wins.
            let hole = self.helper_call("nonceAttr", [], span);
            open.tail.push(Piece::Hole(hole));
        }
        open.tail.extend(selected.map(Piece::Hole));
        out.html(&format!("<{tag}"));
        for piece in open.head {
            out.piece(piece);
        }
        for token in self.scope_tokens(span) {
            out.attribute(&token, None);
        }
        for piece in open.tail {
            out.piece(piece);
        }
        out.html(">");
        if html::is_void(&tag) {
            return;
        }
        let has_select = select.is_some();
        self.select_values.extend(select);
        match open.content {
            Some(content) => out.piece(content),
            None => self.ssr_children(out, &tag, element.children),
        }
        if has_select {
            self.select_values.pop();
        }
        out.html(&format!("</{tag}>"));
    }

    /// `<select value={v}>` (or `bind:value`): a select has no `value` attribute, so the server
    /// marks the matching option `selected` instead. The value goes into a local declared
    /// before the template (`const _selected = v;`), which the options read; the attribute is
    /// removed. `None` without a value or with a spread.
    fn ssr_select_value(
        &mut self,
        out: &mut Ssr<'a>,
        attributes: &mut ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> Option<String> {
        if attributes
            .iter()
            .any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        {
            return None;
        }
        let index = attributes.iter().position(|a| {
            matches!(a, JSXAttributeItem::Attribute(attribute)
                if matches!(attribute_name(&attribute.name).as_str(), "value" | "bind:value"))
        })?;
        let JSXAttributeItem::Attribute(attribute) = attributes.remove(index) else {
            unreachable!("found above")
        };
        let attribute = attribute.unbox();
        let span = attribute.span;
        let binding = attribute_name(&attribute.name) == "bind:value";
        let value = match attr_value(attribute.value) {
            AttrValue::Str(text) => self.ast.string(span, &text),
            AttrValue::Expr(expr) if binding => {
                let signal = self.visited(expr);
                self.ast.call(span, signal, [])
            }
            AttrValue::Expr(expr) => self.visited(expr),
            AttrValue::True | AttrValue::Empty => return None,
        };
        let name = self.names.fresh("_selected");
        out.setup.push(self.ast.const_decl(span, &name, value));
        Some(name)
    }

    /// `attr("selected", String(_selected) === value)` for an `<option>` inside a
    /// `<select value>`. The option's value is its `value` attribute, or its static text when it
    /// has none; an option that sets `selected` itself, or whose value is not known, is left
    /// alone.
    fn ssr_option_selected(
        &mut self,
        attributes: &ArenaVec<'a, JSXAttributeItem<'a>>,
        children: &ArenaVec<'a, JSXChild<'a>>,
        span: Span,
    ) -> Option<Expression<'a>> {
        let select = self.select_values.last()?.clone();
        let mut value = None;
        for item in attributes {
            let JSXAttributeItem::Attribute(attribute) = item else {
                return None;
            };
            match attribute_name(&attribute.name).as_str() {
                "selected" => return None,
                "value" => {
                    value = Some(match &attribute.value {
                        Some(JSXAttributeValue::StringLiteral(literal)) => self
                            .ast
                            .string(span, &super::text::decode_entities(&literal.value)),
                        Some(JSXAttributeValue::ExpressionContainer(container)) => {
                            let expression = container.expression.as_expression()?;
                            let copy = super::clone_expression(self.ast, expression);
                            let copy = self.visited(copy);
                            let string = self.ast.ident(span, "String");
                            self.ast.call(span, string, [copy])
                        }
                        _ => return None,
                    });
                }
                _ => {}
            }
        }
        let value = match value {
            Some(value) => value,
            None => {
                // The option's text, with ASCII whitespace stripped and collapsed.
                let mut text = String::new();
                for child in children {
                    match child {
                        JSXChild::Text(raw) => {
                            text.push_str(&super::text::decode_entities(&raw.value))
                        }
                        JSXChild::ExpressionContainer(container) => match &container.expression {
                            JSXExpression::StringLiteral(literal) => text.push_str(&literal.value),
                            JSXExpression::EmptyExpression(_) => {}
                            _ => return None,
                        },
                        _ => return None,
                    }
                }
                let text = text.split_ascii_whitespace().collect::<Vec<_>>().join(" ");
                self.ast.string(span, &text)
            }
        };
        let string = self.ast.ident(span, "String");
        let current = self.ast.call(span, string, [self.ast.ident(span, &select)]);
        let matches = self
            .ast
            .binary(span, current, BinaryOperator::StrictEquality, value);
        let name = self.ast.string(span, "selected");
        Some(self.helper_call("attr", [name, matches], span))
    }

    fn ssr_children(&mut self, out: &mut Ssr<'a>, tag: &str, children: ArenaVec<'a, JSXChild<'a>>) {
        let items = self.child_items(children);
        // The parser drops a newline right after these start tags; keep the authored one.
        if matches!(tag, "pre" | "textarea" | "listing")
            && matches!(items.first(), Some(Item::Text(text, _)) if text.starts_with('\n'))
        {
            out.html("\n");
        }
        // Rows of a `<table>` get the `<tbody>` the HTML parser (and the client template) inserts.
        let items = if tag == "table" {
            group_table_rows(items)
        } else {
            items
        };
        self.ssr_items(out, items);
    }

    fn ssr_items(&mut self, out: &mut Ssr<'a>, items: Vec<Item<'a>>) {
        let kinds: Vec<Kind> = items.iter().map(Item::kind).collect();
        for (i, item) in items.into_iter().enumerate() {
            match item {
                Item::Text(text, _) => out.text(&text),
                Item::Raw(raw, span) => self.ssr_raw(out, &raw, span),
                Item::Element(element) => self.ssr_element(out, element),
                Item::Rows(rows, span) => {
                    out.html("<tbody");
                    for token in self.tbody_scope_tokens(span) {
                        out.attribute(&token, None);
                    }
                    out.html(">");
                    self.ssr_items(out, rows);
                    out.html("</tbody>");
                }
                Item::Dynamic(expression) => {
                    self.ssr_dynamic_child(out, expression, is_isolated(&kinds, i));
                }
            }
        }
    }

    /// The hole of a dynamic child, matching the client's `insert`/`list`/`branch`/text node: a
    /// provably text value in an isolated position is a `text()` hole, any other value there an
    /// `insertText()` hole.
    fn ssr_dynamic_child(&mut self, out: &mut Ssr<'a>, expression: Expression<'a>, isolated: bool) {
        let span = expression.span();
        let hole = if self.is_list(&expression) {
            let list = self.compile_list(expression);
            out.setup.extend(list.setup);
            let callee = self.runtime("list", span);
            self.ast.call(span, callee, [list.source, list.render])
        } else if self.is_branch(&expression) {
            self.server_branch(expression)
        } else {
            let compiled_jsx = matches!(
                expression.without_parentheses(),
                Expression::JSXElement(_) | Expression::JSXFragment(_)
            ) || is_jsx_like(&expression);
            let value = if compiled_jsx {
                self.compile_value(expression)
                    .into_expression(self.ast, span)
            } else {
                self.visited(expression)
            };
            let helper = if isolated && !compiled_jsx && self.is_text(&value) {
                "text"
            } else if isolated && !compiled_jsx {
                // The client's `insertText`: text() for text values, insert() for the others.
                "insertText"
            } else {
                "insert"
            };
            let callee = self.runtime(helper, span);
            self.ast.call(span, callee, [value])
        };
        out.hole(hole);
    }

    fn ssr_attributes(
        &mut self,
        tag: &str,
        attributes: ArenaVec<'a, JSXAttributeItem<'a>>,
        open: &mut OpenTag<'a>,
        span: Span,
    ) {
        if attributes
            .iter()
            .any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        {
            // As on the client, every attribute goes through the spread, in order.
            let props = self.props_expression(attributes, None, span);
            let hole = self.helper_call("spreadAttrs", [props], span);
            open.tail.push(Piece::Hole(hole));
            return;
        }
        for item in attributes {
            let JSXAttributeItem::Attribute(attribute) = item else {
                continue;
            };
            let attribute = attribute.unbox();
            let span = attribute.span;
            let name = attribute_name(&attribute.name);
            let value = attr_value(attribute.value);
            match name.as_str() {
                "key" | "ref" | "attach" => {}
                _ if name.starts_with("client:") || name.starts_with("on:") => {}
                _ if event_name(&name).is_some() => {}
                "class" => self.ssr_class(open, value, span),
                "style" => self.ssr_style(open, value, span),
                "bind:value" | "bind:checked" => {
                    if let AttrValue::Expr(expr) = value {
                        let signal = self.visited(expr);
                        let current = self.ast.call(span, signal, []);
                        let property = &name["bind:".len()..];
                        if property == "value" && tag == "textarea" {
                            let escaped = self.helper_call("escape", [current], span);
                            open.content = Some(Piece::Hole(escaped));
                        } else {
                            let hole = self.attr_call(property, current, span);
                            open.tail.push(Piece::Hole(hole));
                        }
                    }
                }
                _ => self.ssr_plain_attribute(tag, open, &name, value, span),
            }
        }
    }

    fn ssr_plain_attribute(
        &mut self,
        tag: &str,
        open: &mut OpenTag<'a>,
        name: &str,
        value: AttrValue<'a>,
        span: Span,
    ) {
        // Properties without an attribute form set the content (or nothing) on the server.
        let text_content =
            matches!(name, "textContent" | "innerText") || (name == "value" && tag == "textarea");
        let constant = match value {
            AttrValue::Empty => return,
            AttrValue::True => Literal::Bool(true),
            AttrValue::Str(s) => Literal::Str(s),
            AttrValue::Expr(expr) => match literal(&expr) {
                Some(constant) => constant,
                None => {
                    let expr = self.visited(expr);
                    if name == "innerHTML" {
                        // Trusted HTML by definition: the value is written as it is.
                        open.content = Some(Piece::Hole(expr));
                    } else if text_content {
                        let escaped = self.helper_call("escape", [expr], span);
                        open.content = Some(Piece::Hole(escaped));
                    } else if name != "indeterminate" {
                        let hole = self.attr_call(name, expr, span);
                        open.tail.push(Piece::Hole(hole));
                    }
                    return;
                }
            },
        };
        match constant {
            Literal::Str(value) if name == "innerHTML" => open.content = Some(Piece::Html(value)),
            Literal::Str(value) if text_content => {
                let mut escaped = String::new();
                html::escape_text(&value, &mut escaped);
                open.content = Some(Piece::Html(escaped));
            }
            _ if matches!(name, "innerHTML" | "indeterminate") || text_content => {}
            Literal::Str(value) => open
                .head
                .push(Piece::Html(attribute_html(name, Some(&value)))),
            Literal::Bool(value) if super::element::is_booleanish(name) => open
                .head
                .push(Piece::Html(attribute_html(name, Some(&value.to_string())))),
            Literal::Bool(true) => open.head.push(Piece::Html(attribute_html(name, None))),
            Literal::Bool(false) | Literal::Nullish => {}
        }
    }

    /// `class`: static values are baked like on the client; an object with static keys keeps
    /// the client's token order (baked keys first); anything else is one `classAttr()` hole,
    /// followed by the caller's scope tokens when it applies `props.class` (spec §4.6.2).
    fn ssr_class(&mut self, open: &mut OpenTag<'a>, value: AttrValue<'a>, span: Span) {
        let expr = match value {
            AttrValue::Empty | AttrValue::True => return,
            AttrValue::Str(s) => {
                open.head
                    .push(Piece::Html(attribute_html("class", Some(&s))));
                return;
            }
            AttrValue::Expr(expr) => expr,
        };
        match literal(&expr) {
            Some(Literal::Str(s)) => {
                open.head
                    .push(Piece::Html(attribute_html("class", Some(&s))));
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
                open.head
                    .push(Piece::Html(attribute_html("class", Some(&joined))));
            }
            return;
        }
        if let Expression::ObjectExpression(object) = expr.without_parentheses()
            && static_object_keys(object)
                .is_some_and(|keys| keys.iter().all(|k| !k.contains(char::is_whitespace)))
        {
            let (baked, dynamic) = self.split_object(expr, |value| match value {
                Literal::Bool(true) => true,
                Literal::Str(s) => !s.is_empty(),
                _ => false,
            });
            let baked: Vec<String> = baked.into_iter().map(|(key, _)| key).collect();
            if dynamic.is_empty() {
                if !baked.is_empty() {
                    open.head
                        .push(Piece::Html(attribute_html("class", Some(&baked.join(" ")))));
                }
                return;
            }
            let mut properties: Vec<ObjectPropertyKind<'a>> = baked
                .iter()
                .map(|key| self.ast.property(span, key, self.ast.boolean(span, true)))
                .collect();
            properties.extend(dynamic);
            let object = self.ast.object(span, properties);
            let hole = Piece::Hole(self.helper_call("classAttr", [object], span));
            if baked.is_empty() {
                open.tail.push(hole);
            } else {
                open.head.push(hole);
            }
            return;
        }
        let expr = self.visited(expr);
        let passes_class = self.reads_props_class(&expr);
        let hole = self.helper_call("classAttr", [expr], span);
        open.tail.push(Piece::Hole(hole));
        if let Some(props_name) = passes_class {
            let scope = self
                .ast
                .member(span, self.ast.ident(span, &props_name), "$$scope");
            let object = self
                .ast
                .object(span, [self.ast.property(span, "$$scope", scope)]);
            let hole = self.helper_call("spreadAttrs", [object], span);
            open.tail.push(Piece::Hole(hole));
        }
    }

    /// `style`: like `class`, with baked `key:value` declarations first.
    /// A native SVG `<style>` block, verbatim; with strict CSP it gets the response's nonce.
    fn ssr_raw(&mut self, out: &mut Ssr<'a>, raw: &str, span: Span) {
        match raw.strip_prefix("<style") {
            Some(rest) if self.options.strict_csp => {
                out.html("<style");
                let hole = self.helper_call("nonceAttr", [], span);
                out.hole(hole);
                out.html(rest);
            }
            _ => out.html(raw),
        }
    }

    /// A static `style` string: baked, or with strict CSP through `styleAttr` (a nonce'd rule).
    fn ssr_static_style(&mut self, open: &mut OpenTag<'a>, css: String, span: Span) {
        if self.options.strict_csp {
            let css = self.ast.string(span, &css);
            let hole = self.helper_call("styleAttr", [css], span);
            open.tail.push(Piece::Hole(hole));
        } else {
            open.head
                .push(Piece::Html(attribute_html("style", Some(&css))));
        }
    }

    fn ssr_style(&mut self, open: &mut OpenTag<'a>, value: AttrValue<'a>, span: Span) {
        let expr = match value {
            AttrValue::Empty | AttrValue::True => return,
            AttrValue::Str(s) => {
                self.ssr_static_style(open, s, span);
                return;
            }
            AttrValue::Expr(expr) => expr,
        };
        match literal(&expr) {
            Some(Literal::Str(s)) => {
                self.ssr_static_style(open, s, span);
                return;
            }
            Some(_) => return,
            None => {}
        }
        if let Expression::ObjectExpression(object) = expr.without_parentheses()
            && static_object_keys(object).is_some()
        {
            let (baked, dynamic) =
                self.split_object(expr, |value| matches!(value, Literal::Str(_)));
            let declarations: Vec<(String, String)> = baked
                .into_iter()
                .filter_map(|(key, value)| match value {
                    Literal::Str(value) => Some((key, value)),
                    _ => None,
                })
                .collect();
            if dynamic.is_empty() {
                if !declarations.is_empty() {
                    let css = declarations
                        .iter()
                        .map(|(key, value)| format!("{key}:{value}"))
                        .collect::<Vec<_>>()
                        .join(";");
                    self.ssr_static_style(open, css, span);
                }
                return;
            }
            let mut properties: Vec<ObjectPropertyKind<'a>> = declarations
                .iter()
                .map(|(key, value)| self.ast.property(span, key, self.ast.string(span, value)))
                .collect();
            properties.extend(dynamic);
            let object = self.ast.object(span, properties);
            let hole = Piece::Hole(self.helper_call("styleAttr", [object], span));
            if declarations.is_empty() {
                open.tail.push(hole);
            } else {
                open.head.push(hole);
            }
            return;
        }
        let expr = self.visited(expr);
        let hole = self.helper_call("styleAttr", [expr], span);
        open.tail.push(Piece::Hole(hole));
    }

    /// Splits an object literal with static keys into the literal entries `bake` keeps and the
    /// other (visited) properties, in source order. Literals `bake` rejects are dropped, as on
    /// the client.
    #[allow(clippy::type_complexity)]
    fn split_object(
        &mut self,
        expr: Expression<'a>,
        bake: impl Fn(&Literal) -> bool,
    ) -> (Vec<(String, Literal)>, Vec<ObjectPropertyKind<'a>>) {
        let Expression::ObjectExpression(object) = strip_parens(expr) else {
            unreachable!("an object literal")
        };
        let mut baked = Vec::new();
        let mut dynamic = Vec::new();
        for property in object.unbox().properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                continue;
            };
            let property = property.unbox();
            let key = property_key_name(&property.key)
                .unwrap_or_default()
                .to_owned();
            match literal(&property.value) {
                Some(value) => {
                    if bake(&value) {
                        baked.push((key, value));
                    }
                }
                None => {
                    let value = self.visited(property.value);
                    dynamic.push(self.ast.property(property.span, &key, value));
                }
            }
        }
        (baked, dynamic)
    }

    fn attr_call(&mut self, name: &str, value: Expression<'a>, span: Span) -> Expression<'a> {
        let name = self.ast.string(span, name);
        self.helper_call("attr", [name, value], span)
    }

    fn helper_call<const N: usize>(
        &mut self,
        helper: &'static str,
        args: [Expression<'a>; N],
        span: Span,
    ) -> Expression<'a> {
        let callee = self.runtime(helper, span);
        self.ast.call(span, callee, args)
    }
}

/// ` name` / ` name=value` as in client templates.
fn attribute_html(name: &str, value: Option<&str>) -> String {
    let mut out = String::new();
    html::write_attribute(name, value, &mut out);
    out
}
