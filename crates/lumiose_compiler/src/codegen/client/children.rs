//! Element children: JSX text, nested elements and dynamic parts (`insert`, `list`, `branch`),
//! with `<!>` markers only where the parser would otherwise merge text or lose a position.
//! Fragments and component children compile to arrays of renderables.

use std::collections::HashSet;

use oxc_allocator::{ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::SymbolId;

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
    /// Consecutive row children of a `<table>` (`<tr>`s and expressions rendering `<tr>`s), which
    /// the HTML parser puts in an implicit `<tbody>`; see [`group_table_rows`].
    Rows(Vec<Item<'a>>, Span),
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Kind {
    Text,
    Static,
    Dynamic,
}

/// Whether the dynamic child at `index` stands alone between nodes: no text or other dynamic
/// child next to it, so a text node in its place stays a node of its own when the template (or
/// the server HTML) is parsed. Provably text values there compile to a text node (TASK-65).
pub(super) fn is_isolated(kinds: &[Kind], index: usize) -> bool {
    let alone = |kind: Option<&Kind>| kind.is_none_or(|&kind| kind == Kind::Static);
    alone(index.checked_sub(1).and_then(|i| kinds.get(i))) && alone(kinds.get(index + 1))
}

impl Item<'_> {
    pub(super) fn kind(&self) -> Kind {
        match self {
            Item::Text(..) => Kind::Text,
            Item::Raw(..) | Item::Element(_) | Item::Rows(..) => Kind::Static,
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

    /// Whether an element has content of its own, as React counts children: anything but
    /// whitespace that JSX drops (normalised as in [`Self::child_items`]) and empty `{}`.
    pub(super) fn has_content(&self, children: &[JSXChild<'a>]) -> bool {
        let mut text = String::new();
        for child in children {
            match child {
                JSXChild::Text(node) => {
                    for piece in split_text(self.source, node.span.into(), self.blocks) {
                        match piece {
                            TextPiece::Text(raw) => text.push_str(&raw),
                            TextPiece::Raw(_) => return true,
                        }
                    }
                }
                JSXChild::ExpressionContainer(container)
                    if matches!(container.expression, JSXExpression::EmptyExpression(_)) =>
                {
                    if normalize(&std::mem::take(&mut text)).is_some() {
                        return true;
                    }
                }
                _ => return true,
            }
        }
        normalize(&text).is_some()
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
        let mut items = self.child_items(children);
        if template.tag(parent) == Some("table") {
            items = group_table_rows(items);
        }
        self.namespaces.push(namespace);
        self.build_items(template, parent, items, namespace);
        self.namespaces.pop();
    }

    fn build_items(
        &mut self,
        template: &mut Template<'a>,
        parent: usize,
        items: Vec<Item<'a>>,
        namespace: Namespace,
    ) {
        let kinds: Vec<Kind> = items.iter().map(Item::kind).collect();
        let count = items.len();
        for (i, item) in items.into_iter().enumerate() {
            match item {
                Item::Text(text, span) => {
                    template.add_text(Some(parent), &text, span);
                }
                Item::Raw(raw, span) => {
                    let style = raw.starts_with("<style");
                    let node = template.add(Some(parent), NodeKind::Raw(raw), span);
                    if style && self.options.strict_csp {
                        // A native SVG `<style>` under strict CSP: the page's nonce (TASK-142).
                        template.push(Op::Call {
                            span,
                            helper: "setNonce",
                            node,
                            args: Vec::new(),
                        });
                    }
                }
                Item::Element(element) => {
                    self.build_element(template, element, Some(parent), namespace);
                }
                Item::Rows(rows, span) => {
                    // The template spells out the `<tbody>` the HTML parser inserts, so that walks
                    // (and dynamic rows' parent) match the parsed DOM.
                    let attrs = self
                        .tbody_scope_tokens(span)
                        .into_iter()
                        .map(|t| (t, None))
                        .collect();
                    let tag = "tbody".to_owned();
                    let tbody = template.add(Some(parent), NodeKind::Element { tag, attrs }, span);
                    self.build_items(template, tbody, rows, namespace);
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
                    let isolated = is_isolated(&kinds, i);
                    self.dynamic_child(template, parent, expression, plan, isolated);
                }
            }
        }
    }

    /// A dynamic child; `isolated` (see [`is_isolated`]) makes it a text node of the template: a
    /// provably text value is bound with `setText` (or written once when it is not reactive), any
    /// other value is written by `insertText`.
    fn dynamic_child(
        &mut self,
        template: &mut Template<'a>,
        parent: usize,
        expression: Expression<'a>,
        plan: MarkerPlan,
        isolated: bool,
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
            if isolated && !compiled_jsx && self.is_text(&value) {
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
            if isolated && !compiled_jsx {
                // Maybe text (`{id}`, `{row.label()}`): a template text node written by
                // `insertText`, which falls back to `insert` in a region before it for other
                // values (doc-2 §2, §3). No region or created node per row for text values.
                let text = template.add(Some(parent), NodeKind::Text(" ".to_owned()), span);
                template.push(Op::Call {
                    span,
                    helper: "insertText",
                    node: text,
                    args: vec![value],
                });
                return;
            }
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
    /// inside the consumer's tracked `insert`. A fragment's single dynamic item is an
    /// `insertValue` range, as in an array: a component that returns `<>{fn(value())}</>` then
    /// claims its server nodes when it is created, before siblings created after it (TASK-415).
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
            return Some(self.ssr_fragment_items(items, span, lazy));
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
                Item::Dynamic(expression) if lazy => self.renderable(expression),
                Item::Dynamic(expression) => self.fragment_item(expression),
                Item::Rows(..) => unreachable!("rows are only grouped in <table> children"),
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
        // An array of renderables. Under hydration its server nodes are claimed in creation order
        // (doc-2 §3.1), so everything is created in document order: each run of static items is a
        // template of its own (text included, so that it claims its server text), components and
        // JSX values are created in place, and other dynamic items become `insertValue` ranges,
        // which claim the `insert` block the server writes for them (TASK-234).
        let mut run: Option<Template<'a>> = None;
        let flush = |cg: &mut Self, run: &mut Option<Template<'a>>, entries: &mut Vec<_>| {
            if let Some(template) = run.take() {
                let emitted = template.emit(cg, span, true);
                entries.push((emitted.setup, emitted.roots));
            }
        };
        let mut entries: Vec<(Vec<Statement<'a>>, Vec<Expression<'a>>)> = Vec::new();
        let only_static = items.iter().all(|item| !matches!(item, Item::Dynamic(_)));
        for item in items {
            let template = || Template::new(namespace);
            match item {
                Item::Text(text, span) => {
                    run.get_or_insert_with(template)
                        .add(None, NodeKind::Text(text), span);
                }
                Item::Raw(raw, span) => {
                    run.get_or_insert_with(template)
                        .add(None, NodeKind::Raw(raw), span);
                }
                Item::Element(element) => {
                    let template = run.get_or_insert_with(template);
                    self.build_element(template, element, None, namespace);
                }
                Item::Dynamic(expression) => {
                    flush(self, &mut run, &mut entries);
                    let compiled = self.fragment_item(expression);
                    entries.push((compiled.setup, vec![compiled.value]));
                }
                Item::Rows(..) => unreachable!("rows are only grouped in <table> children"),
            }
        }
        if only_static {
            // Text and elements only: one template, returned whole.
            let template = run.take().expect("static items");
            let emitted = template.emit(self, span, false);
            return Some(Compiled {
                setup: emitted.setup,
                value: emitted.whole,
            });
        }
        flush(self, &mut run, &mut entries);
        // A value that creates nodes is bound before any later creation code runs.
        let mut creates_later = vec![false; entries.len()];
        for i in (1..entries.len()).rev() {
            creates_later[i - 1] = creates_later[i] || !entries[i].0.is_empty();
        }
        let mut setup = Vec::new();
        let mut values = Vec::new();
        for ((statements, entry_values), later) in entries.into_iter().zip(creates_later) {
            setup.extend(statements);
            for value in entry_values {
                if later && !is_inert(&value) {
                    let name = self.names.fresh("_v");
                    setup.push(self.ast.const_decl(span, &name, value));
                    values.push(self.ast.ident(span, &name));
                } else {
                    values.push(value);
                }
            }
        }
        Some(Compiled {
            setup,
            value: self.ast.array(span, values),
        })
    }

    /// A dynamic item of an array of renderables (doc-2 §2): reactive conditionals and lists render
    /// themselves (`branchValue`/`listValue`), components and other JSX compile in place, and
    /// anything else renders into an `insertValue` range, tracked when it is dynamic. The server
    /// mirrors it in `ssr_fragment_item`.
    fn fragment_item(&mut self, expression: Expression<'a>) -> Compiled<'a> {
        let expression = match self.live_value(expression) {
            Ok(compiled) => return compiled,
            Err(expression) => expression,
        };
        let span = expression.span();
        let jsx = matches!(
            expression.without_parentheses(),
            Expression::JSXElement(_) | Expression::JSXFragment(_)
        );
        let value = if jsx || is_jsx_like(&expression) {
            let reactive = !jsx && self.reads_reactive_test(&expression);
            let compiled = self.compile_value(expression);
            if !reactive {
                return compiled;
            }
            self.ast
                .arrow_returning(span, &[], compiled.setup, compiled.value)
        } else {
            let value = self.visited(expression);
            if self.is_dynamic(&value) {
                self.compute(value)
            } else {
                value
            }
        };
        let callee = self.runtime("insertValue", span);
        Compiled::value(self.ast.call(span, callee, [value]))
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

    /// The single item of a `children` getter: components and JSX compile in place, and other
    /// expressions are returned as they are, for the consumer's tracked `insert` to read.
    fn renderable(&mut self, expression: Expression<'a>) -> Compiled<'a> {
        // Reactive conditionals and lists render themselves (`branchValue`/`listValue`): the
        // consumer's `insert` places one range and never re-runs for them.
        let expression = match self.live_value(expression) {
            Ok(compiled) => return compiled,
            Err(expression) => expression,
        };
        let jsx = matches!(
            expression.without_parentheses(),
            Expression::JSXElement(_) | Expression::JSXFragment(_)
        );
        if jsx || is_jsx_like(&expression) {
            return self.compile_value(expression);
        }
        Compiled::value(self.visited(expression))
    }

    pub(super) fn reads_reactive_test(&self, expression: &Expression<'a>) -> bool {
        match expression.without_parentheses() {
            Expression::ConditionalExpression(cond) => self.reads_reactive(&cond.test),
            Expression::LogicalExpression(logical) => self.reads_reactive(&logical.left),
            _ => false,
        }
    }
}

impl Codegen<'_, '_> {
    /// Whether `value` is provably a string or number: [`is_text_like`], or a `const` initialised
    /// with such a value.
    pub(super) fn is_text(&self, value: &Expression<'_>) -> bool {
        match value.without_parentheses() {
            Expression::Identifier(ident) => self
                .symbol_of(ident)
                .is_some_and(|symbol| self.text_consts.contains(&symbol)),
            value => is_text_like(value),
        }
    }
}

/// The `const` bindings initialised with a provably text value ([`is_text_like`], or another such
/// const), in source order, such as `const total = a + b` or `const label = String(id)`.
pub(super) fn text_consts(program: &Program<'_>, scoping: &Scoping) -> HashSet<SymbolId> {
    struct Collector<'s> {
        scoping: &'s Scoping,
        consts: HashSet<SymbolId>,
    }
    impl<'a> Visit<'a> for Collector<'_> {
        fn visit_variable_declaration(&mut self, it: &VariableDeclaration<'a>) {
            if it.kind == VariableDeclarationKind::Const {
                for declarator in &it.declarations {
                    let (BindingPattern::BindingIdentifier(id), Some(init)) =
                        (&declarator.id, &declarator.init)
                    else {
                        continue;
                    };
                    let text = match init.without_parentheses() {
                        Expression::Identifier(ident) => {
                            crate::analyze::reactivity::symbol_of(self.scoping, ident)
                                .is_some_and(|symbol| self.consts.contains(&symbol))
                        }
                        init => is_text_like(init),
                    };
                    if text && let Some(symbol) = id.symbol_id.get() {
                        self.consts.insert(symbol);
                    }
                }
            }
            walk::walk_variable_declaration(self, it);
        }
    }
    let mut collector = Collector {
        scoping,
        consts: HashSet::new(),
    };
    collector.visit_program(program);
    collector.consts
}

/// A value whose evaluation creates nothing: a variable, a template root (`_nodes[0]`) or a string.
fn is_inert(value: &Expression<'_>) -> bool {
    match value {
        Expression::Identifier(_) | Expression::StringLiteral(_) => true,
        Expression::ComputedMemberExpression(member) => {
            matches!(member.object, Expression::Identifier(_))
                && matches!(member.expression, Expression::NumericLiteral(_))
        }
        _ => false,
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

/// Groups consecutive row children of a `<table>` into [`Item::Rows`]: `<tr>` elements, and
/// expressions that render `<tr>`s (`.map()` callbacks, conditionals). The HTML parser puts such
/// rows in an implicit `<tbody>`, so both targets spell it out: the client walks and the server
/// HTML then describe the same DOM. Anything else (`<thead>`, an explicit `<tbody>`, text, a
/// component) ends a group.
pub(super) fn group_table_rows(items: Vec<Item<'_>>) -> Vec<Item<'_>> {
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let row = match &item {
            Item::Element(element) => {
                is_intrinsic(&element.opening_element.name)
                    && tag_name(&element.opening_element.name) == "tr"
            }
            Item::Dynamic(expression) => renders_rows(expression),
            _ => false,
        };
        if !row {
            out.push(item);
            continue;
        }
        let span = match &item {
            Item::Element(element) => element.span,
            Item::Dynamic(expression) => expression.span(),
            _ => unreachable!("rows are elements or expressions"),
        };
        match out.last_mut() {
            Some(Item::Rows(rows, group)) => {
                group.end = span.end;
                rows.push(item);
            }
            _ => out.push(Item::Rows(vec![item], span)),
        }
    }
    out
}

/// True when the JSX an expression renders is `<tr>` rows: `<tr>`, a conditional or logical
/// expression with a `<tr>` operand, or a `.map()` whose callback returns one.
fn renders_rows(expression: &Expression<'_>) -> bool {
    match expression.without_parentheses() {
        Expression::JSXElement(element) => {
            is_intrinsic(&element.opening_element.name)
                && tag_name(&element.opening_element.name) == "tr"
        }
        Expression::ConditionalExpression(conditional) => {
            renders_rows(&conditional.consequent) || renders_rows(&conditional.alternate)
        }
        Expression::LogicalExpression(logical) => renders_rows(&logical.right),
        Expression::CallExpression(call) => mapped_rows(call),
        Expression::ChainExpression(chain) => match &chain.expression {
            ChainElement::CallExpression(call) => mapped_rows(call),
            _ => false,
        },
        _ => false,
    }
}

/// `items.map((item) => <tr>…</tr>)`
fn mapped_rows(call: &CallExpression<'_>) -> bool {
    let Expression::StaticMemberExpression(member) = &call.callee else {
        return false;
    };
    if member.property.name != "map" || call.arguments.len() != 1 {
        return false;
    }
    let body = match &call.arguments[0] {
        Argument::ArrowFunctionExpression(arrow) => match &arrow.body {
            ArrowFunctionBody::FunctionBody(body) => body,
            body => return body.as_expression().is_some_and(renders_rows),
        },
        Argument::FunctionExpression(function) => match &function.body {
            Some(body) => body,
            None => return false,
        },
        _ => return false,
    };
    let mut finder = RowReturns(false);
    finder.visit_function_body(body);
    finder.0
}

/// Finds a `return <tr>` in a function body (not in nested functions).
struct RowReturns(bool);

impl<'a> Visit<'a> for RowReturns {
    fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
    fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}

    fn visit_return_statement(&mut self, it: &ReturnStatement<'a>) {
        if it.argument.as_ref().is_some_and(renders_rows) {
            self.0 = true;
        }
        walk::walk_return_statement(self, it);
    }
}
