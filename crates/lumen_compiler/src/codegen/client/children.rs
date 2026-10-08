//! Element children: JSX text, nested elements and dynamic parts (`insert`, `list`, `branch`),
//! with `<!>` markers only where the parser would otherwise merge text or lose a position.
//! Fragments and component children compile to arrays of renderables.

use oxc_allocator::{ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::{GetSpan, Span};

use super::element::{is_intrinsic, js_number, tag_name};
use super::html::{self, Namespace};
use super::template::{Marker, NodeKind, Op, Template};
use super::text::{TextPiece, normalize, split_text};
use super::{Codegen, Compiled};
use crate::analyze::is_jsx_like;

/// A child after text normalisation and fragment flattening.
pub enum Item<'a> {
    Text(String, Span),
    Raw(String, Span),
    /// An intrinsic element.
    Element(ArenaBox<'a, JSXElement<'a>>),
    /// A component element or an expression.
    Dynamic(Expression<'a>),
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Text,
    Static,
    Dynamic,
}

impl Item<'_> {
    fn kind(&self) -> Kind {
        match self {
            Item::Text(..) => Kind::Text,
            Item::Raw(..) | Item::Element(_) => Kind::Static,
            Item::Dynamic(_) => Kind::Dynamic,
        }
    }
}

enum MarkerPlan {
    Append,
    Node(usize),
    NextStatic,
}

impl<'a> Codegen<'a, '_> {
    /// Flattens fragments, deletes masked style blocks, normalises JSX text and classifies the
    /// children. Consecutive JSX texts (split by a removed `$ref` placeholder) are normalised as
    /// one text.
    pub(super) fn child_items(&self, children: ArenaVec<'a, JSXChild<'a>>) -> Vec<Item<'a>> {
        let mut items = Vec::new();
        let mut pending: Option<(String, Span)> = None;
        let flush = |pending: &mut Option<(String, Span)>, items: &mut Vec<Item<'a>>| {
            if let Some((raw, span)) = pending.take()
                && let Some(text) = normalize(&raw)
            {
                items.push(Item::Text(text, span));
            }
        };
        for child in children {
            match child {
                JSXChild::Text(text) => {
                    for piece in split_text(self.source, text.span.into(), self.blocks) {
                        match piece {
                            TextPiece::Text(raw) => match &mut pending {
                                Some((existing, span)) => {
                                    existing.push_str(&raw);
                                    span.end = text.span.end;
                                }
                                None => pending = Some((raw, text.span)),
                            },
                            TextPiece::Raw(raw) => {
                                flush(&mut pending, &mut items);
                                items.push(Item::Raw(raw, text.span));
                            }
                        }
                    }
                }
                JSXChild::ExpressionContainer(container) => {
                    flush(&mut pending, &mut items);
                    let container = container.unbox();
                    let span = container.span;
                    match container.expression {
                        JSXExpression::EmptyExpression(_) => {}
                        expression => {
                            self.push_expression(expression.into_expression(), span, &mut items)
                        }
                    }
                }
                JSXChild::Element(element) => {
                    flush(&mut pending, &mut items);
                    if is_intrinsic(&element.opening_element.name) {
                        items.push(Item::Element(element));
                    } else {
                        items.push(Item::Dynamic(Expression::JSXElement(element)));
                    }
                }
                JSXChild::Fragment(fragment) => {
                    flush(&mut pending, &mut items);
                    items.extend(self.child_items(fragment.unbox().children));
                }
                JSXChild::Spread(spread) => {
                    flush(&mut pending, &mut items);
                    items.push(Item::Dynamic(spread.unbox().expression));
                }
            }
        }
        flush(&mut pending, &mut items);
        merge_text(items)
    }

    fn push_expression(&self, expression: Expression<'a>, span: Span, items: &mut Vec<Item<'a>>) {
        match expression {
            Expression::ParenthesizedExpression(paren) => {
                self.push_expression(paren.unbox().expression, span, items);
            }
            Expression::StringLiteral(lit) => items.push(Item::Text(lit.value.to_string(), span)),
            Expression::NumericLiteral(lit) => items.push(Item::Text(js_number(lit.value), span)),
            Expression::TemplateLiteral(template)
                if template.expressions.is_empty() && template.quasis[0].value.cooked.is_some() =>
            {
                let cooked = template.quasis[0]
                    .value
                    .cooked
                    .as_ref()
                    .map(ToString::to_string);
                items.push(Item::Text(cooked.unwrap_or_default(), span));
            }
            Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => {}
            Expression::Identifier(ident)
                if ident.name == "undefined" && self.symbol_of(&ident).is_none() => {}
            Expression::JSXElement(element) if is_intrinsic(&element.opening_element.name) => {
                items.push(Item::Element(element));
            }
            Expression::JSXFragment(fragment) => {
                items.extend(self.child_items(fragment.unbox().children))
            }
            other => items.push(Item::Dynamic(other)),
        }
    }

    /// Adds the children of `parent` to the template, with their operations.
    pub(super) fn build_children(
        &mut self,
        template: &mut Template<'a>,
        parent: Option<usize>,
        children: ArenaVec<'a, JSXChild<'a>>,
        namespace: Namespace,
    ) {
        let parent = parent.expect("element children");
        let items = self.child_items(children);
        let kinds: Vec<Kind> = items.iter().map(Item::kind).collect();
        let count = items.len();
        let in_table = template.tag(parent) == Some("table");
        // The HTML parser wraps `<tr>` children of `<table>` in a `<tbody>`; the template spells it
        // out so that walks match the parsed DOM.
        let mut implicit_tbody: Option<usize> = None;
        self.namespaces.push(namespace);
        for (i, item) in items.into_iter().enumerate() {
            if !matches!(&item, Item::Element(e) if in_table && tag_name(&e.opening_element.name) == "tr")
            {
                implicit_tbody = None;
            }
            match item {
                Item::Text(text, span) => {
                    template.add_text(Some(parent), &text, span);
                }
                Item::Raw(raw, span) => {
                    template.add(Some(parent), NodeKind::Raw(raw), span);
                }
                Item::Element(element)
                    if in_table && tag_name(&element.opening_element.name) == "tr" =>
                {
                    let tbody = match implicit_tbody {
                        Some(tbody) => tbody,
                        None => {
                            let attrs =
                                self.scope_tokens().into_iter().map(|t| (t, None)).collect();
                            let tag = "tbody".to_owned();
                            let tbody = template.add(
                                Some(parent),
                                NodeKind::Element { tag, attrs },
                                element.span,
                            );
                            implicit_tbody = Some(tbody);
                            tbody
                        }
                    };
                    self.build_element(template, element, Some(tbody), namespace);
                }
                Item::Element(element) => {
                    self.build_element(template, element, Some(parent), namespace);
                }
                Item::Dynamic(expression) => {
                    let span = expression.span();
                    let plan = if i + 1 == count {
                        MarkerPlan::Append
                    } else if kinds[i + 1] == Kind::Dynamic
                        || (i > 0 && kinds[i - 1] == Kind::Text && kinds[i + 1] == Kind::Text)
                    {
                        MarkerPlan::Node(template.add(Some(parent), NodeKind::Marker, span))
                    } else {
                        MarkerPlan::NextStatic
                    };
                    self.dynamic_child(template, parent, expression, plan, count == 1);
                }
            }
        }
        self.namespaces.pop();
    }

    fn dynamic_child(
        &mut self,
        template: &mut Template<'a>,
        parent: usize,
        expression: Expression<'a>,
        plan: MarkerPlan,
        sole: bool,
    ) {
        let span = expression.span();
        let op = if self.is_list(&expression) {
            let list = self.compile_list(expression);
            if !list.setup.is_empty() {
                template.push(Op::Statements(list.setup));
            }
            Op::List {
                span,
                parent,
                marker: Marker::Append,
                source: list.source,
                render: list.render,
                key: list.key,
            }
        } else if self.is_branch(&expression) {
            let (cond, when_true, when_false) = self.compile_branch(expression);
            Op::Branch {
                span,
                parent,
                marker: Marker::Append,
                cond,
                when_true,
                when_false,
            }
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
            if sole && !compiled_jsx && is_text_like(&value) {
                let text = template.add(Some(parent), NodeKind::Text(" ".to_owned()), span);
                if self.is_dynamic(&value) {
                    let apply = self.runtime("setText", span);
                    template.push(Op::Bind {
                        span,
                        node: text,
                        compute: self.compute(value),
                        apply,
                    });
                } else {
                    template.push(Op::Assign {
                        span,
                        node: text,
                        prop: "data".to_owned(),
                        value,
                    });
                }
                return;
            }
            let value = if !compiled_jsx && self.is_dynamic(&value) {
                self.compute(value)
            } else {
                value
            };
            Op::Insert {
                span,
                parent,
                value,
                marker: Marker::Append,
            }
        };
        self.push_with_marker(template, parent, op, plan);
    }

    fn push_with_marker(
        &mut self,
        template: &mut Template<'a>,
        parent: usize,
        mut op: Op<'a>,
        plan: MarkerPlan,
    ) {
        let marker = match plan {
            MarkerPlan::Append => Marker::Append,
            MarkerPlan::Node(node) => Marker::Node(node),
            MarkerPlan::NextStatic => {
                template.push_before_next(Some(parent), op);
                return;
            }
        };
        match &mut op {
            Op::Insert { marker: m, .. }
            | Op::List { marker: m, .. }
            | Op::Branch { marker: m, .. } => *m = marker,
            _ => {}
        }
        template.push(op);
    }

    /// A fragment, or a component's children: one renderable, or an array of them. With
    /// `lazy` (a `children` getter), a single expression is returned as is: the getter is read
    /// inside the consumer's tracked `insert`.
    pub(super) fn compile_fragment_items(
        &mut self,
        items: Vec<Item<'a>>,
        span: Span,
        lazy: bool,
    ) -> Option<Compiled<'a>> {
        if items.is_empty() {
            return None;
        }
        if self.server() {
            return Some(self.ssr_fragment_items(items, span));
        }
        if items.len() == 1 {
            let item = items.into_iter().next().expect("one item");
            return Some(match item {
                Item::Text(text, span) => Compiled::value(self.ast.string(span, &text)),
                Item::Element(element) => self.compile_element_root(element),
                Item::Raw(raw, span) => {
                    let mut template = Template::new(self.namespace());
                    template.add(None, NodeKind::Raw(raw), span);
                    let emitted = template.emit(self, span, false);
                    Compiled {
                        setup: emitted.setup,
                        value: emitted.whole,
                    }
                }
                Item::Dynamic(expression) => self.renderable(expression, !lazy),
            });
        }
        let namespace = items
            .iter()
            .find_map(|item| match item {
                Item::Element(element) => Some(html::root_namespace(
                    self.namespace(),
                    &tag_name(&element.opening_element.name),
                )),
                _ => None,
            })
            .unwrap_or(self.namespace());
        let mut template = Template::new(namespace);
        enum Slot<'a> {
            Root(usize),
            Value(Expression<'a>),
        }
        let mut slots = Vec::new();
        let mut setup = Vec::new();
        // Text joins a template only next to elements; on its own a string is cheaper.
        let has_elements = items
            .iter()
            .any(|item| matches!(item, Item::Element(_) | Item::Raw(..)));
        for item in items {
            match item {
                Item::Text(text, span) if !has_elements => {
                    slots.push(Slot::Value(self.ast.string(span, &text)));
                }
                Item::Text(text, span) => {
                    slots.push(Slot::Root(template.add(None, NodeKind::Text(text), span)))
                }
                Item::Raw(raw, span) => {
                    slots.push(Slot::Root(template.add(None, NodeKind::Raw(raw), span)))
                }
                Item::Element(element) => {
                    slots.push(Slot::Root(self.build_element(
                        &mut template,
                        element,
                        None,
                        namespace,
                    )));
                }
                Item::Dynamic(expression) => {
                    let compiled = self.renderable(expression, true);
                    setup.extend(compiled.setup);
                    slots.push(Slot::Value(compiled.value));
                }
            }
        }
        if template.roots.is_empty() {
            let values = slots.into_iter().filter_map(|s| match s {
                Slot::Value(v) => Some(v),
                Slot::Root(_) => None,
            });
            return Some(Compiled {
                setup,
                value: self.ast.array(span, values.collect::<Vec<_>>()),
            });
        }
        let only_roots = slots.iter().all(|s| matches!(s, Slot::Root(_)));
        let roots = template.roots.clone();
        let emitted = template.emit(self, span, !only_roots);
        let mut all_setup = emitted.setup;
        all_setup.extend(setup);
        if only_roots {
            return Some(Compiled {
                setup: all_setup,
                value: emitted.whole,
            });
        }
        let mut by_root: std::collections::HashMap<usize, Expression<'a>> =
            roots.into_iter().zip(emitted.roots).collect();
        let elements = slots
            .into_iter()
            .filter_map(|slot| match slot {
                Slot::Root(root) => by_root.remove(&root),
                Slot::Value(value) => Some(value),
            })
            .collect::<Vec<_>>();
        Some(Compiled {
            setup: all_setup,
            value: self.ast.array(span, elements),
        })
    }

    pub(super) fn compile_fragment(
        &mut self,
        children: ArenaVec<'a, JSXChild<'a>>,
        span: Span,
    ) -> Compiled<'a> {
        let items = self.child_items(children);
        self.compile_fragment_items(items, span, false)
            .unwrap_or_else(|| Compiled::value(self.ast.array(span, [])))
    }

    /// A dynamic item outside an element: components and JSX compile in place; other dynamic
    /// expressions become tracked functions when `wrap` is set.
    fn renderable(&mut self, expression: Expression<'a>, wrap: bool) -> Compiled<'a> {
        let jsx = matches!(
            expression.without_parentheses(),
            Expression::JSXElement(_) | Expression::JSXFragment(_)
        );
        if jsx || is_jsx_like(&expression) {
            let reactive = !jsx && self.reads_reactive_test(&expression);
            let span = expression.span();
            let compiled = self.compile_value(expression);
            if reactive && wrap {
                return Compiled::value(self.ast.arrow_returning(
                    span,
                    &[],
                    compiled.setup,
                    compiled.value,
                ));
            }
            return compiled;
        }
        let value = self.visited(expression);
        if wrap && self.is_dynamic(&value) {
            Compiled::value(self.compute(value))
        } else {
            Compiled::value(value)
        }
    }

    fn reads_reactive_test(&self, expression: &Expression<'a>) -> bool {
        match expression.without_parentheses() {
            Expression::ConditionalExpression(cond) => self.reads_reactive(&cond.test),
            Expression::LogicalExpression(logical) => self.reads_reactive(&logical.left),
            _ => false,
        }
    }
}

/// Merges adjacent text items (e.g. `a{"b"}c`).
fn merge_text(items: Vec<Item<'_>>) -> Vec<Item<'_>> {
    let mut out: Vec<Item<'_>> = Vec::with_capacity(items.len());
    for item in items {
        if let Item::Text(text, span) = &item
            && let Some(Item::Text(previous, previous_span)) = out.last_mut()
        {
            previous.push_str(text);
            previous_span.end = span.end;
            continue;
        }
        out.push(item);
    }
    out
}

/// True when `expr` always produces a string or number (so `setText` renders it exactly like
/// `insert` would): literals, template literals, arithmetic, `typeof`, string-returning methods.
pub fn is_text_like(expr: &Expression<'_>) -> bool {
    use oxc_syntax::operator::{BinaryOperator as B, UnaryOperator as U};
    match expr.without_parentheses() {
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::TemplateLiteral(_) => true,
        Expression::BinaryExpression(binary) => matches!(
            binary.operator,
            B::Addition
                | B::Subtraction
                | B::Multiplication
                | B::Division
                | B::Remainder
                | B::Exponential
                | B::ShiftLeft
                | B::ShiftRight
                | B::ShiftRightZeroFill
                | B::BitwiseAnd
                | B::BitwiseOR
                | B::BitwiseXOR
        ),
        Expression::UnaryExpression(unary) => {
            matches!(
                unary.operator,
                U::UnaryNegation | U::UnaryPlus | U::BitwiseNot | U::Typeof
            )
        }
        Expression::ConditionalExpression(cond) => {
            is_text_like(&cond.consequent) && is_text_like(&cond.alternate)
        }
        Expression::StaticMemberExpression(member) => member.property.name == "length",
        Expression::CallExpression(call) => match call.callee.without_parentheses() {
            Expression::Identifier(ident) => matches!(ident.name.as_str(), "String" | "Number"),
            Expression::StaticMemberExpression(member) => matches!(
                member.property.name.as_str(),
                "toString"
                    | "toFixed"
                    | "toPrecision"
                    | "toExponential"
                    | "toLocaleString"
                    | "toLocaleDateString"
                    | "toLocaleTimeString"
                    | "toUpperCase"
                    | "toLowerCase"
                    | "toLocaleUpperCase"
                    | "toLocaleLowerCase"
                    | "trim"
                    | "trimStart"
                    | "trimEnd"
                    | "padStart"
                    | "padEnd"
                    | "repeat"
                    | "join"
                    | "charAt"
                    | "normalize"
                    | "toISOString"
                    | "toDateString"
                    | "toTimeString"
            ),
            _ => false,
        },
        _ => false,
    }
}
