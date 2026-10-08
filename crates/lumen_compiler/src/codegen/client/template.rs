//! Templates: the static DOM of a JSX root as minified HTML, plus the operations that bind its
//! dynamic parts. Emission walks the cloned DOM with `firstChild`/`nextSibling` (contract doc-2
//! §1) and then runs the operations in document order.

use oxc_ast::ast::{Expression, Statement};
use oxc_span::Span;

use super::Codegen;
use super::html::{self, Namespace};

#[derive(Debug)]
pub enum NodeKind {
    Element {
        tag: String,
        /// Static attributes baked into the HTML (`None` = boolean attribute).
        attrs: Vec<(String, Option<String>)>,
    },
    /// Decoded text.
    Text(String),
    /// Verbatim HTML (SVG `<style>` blocks).
    Raw(String),
    /// `<!>`: a comment used as an insertion marker.
    Marker,
}

#[derive(Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub parent: Option<usize>,
    pub children: Vec<usize>,
    pub span: Span,
}

/// A marker argument: a node, the next static sibling (resolved when it is added), or `null`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Marker {
    Node(usize),
    Append,
}

/// One operation on the cloned DOM. `Insert`, `List`, `Branch` and `Component` mutate the tree.
pub enum Op<'a> {
    /// `helper(node, ...args)`
    Call {
        span: Span,
        helper: &'static str,
        node: usize,
        args: Vec<Expression<'a>>,
    },
    /// `bind(node, compute, apply)`
    Bind {
        span: Span,
        node: usize,
        compute: Expression<'a>,
        apply: Expression<'a>,
    },
    /// `node.prop = value`
    Assign {
        span: Span,
        node: usize,
        prop: String,
        value: Expression<'a>,
    },
    /// Statements emitted as they are (selector setup).
    Statements(Vec<Statement<'a>>),
    /// `insert(parent, value, marker)`
    Insert {
        span: Span,
        parent: usize,
        value: Expression<'a>,
        marker: Marker,
    },
    /// `list(parent, marker, source, render, key?)`
    List {
        span: Span,
        parent: usize,
        marker: Marker,
        source: Expression<'a>,
        render: Expression<'a>,
        key: Option<Expression<'a>>,
    },
    /// `branch(parent, marker, cond, whenTrue, whenFalse?)`
    Branch {
        span: Span,
        parent: usize,
        marker: Marker,
        cond: Expression<'a>,
        when_true: Expression<'a>,
        when_false: Option<Expression<'a>>,
    },
}

impl Op<'_> {
    fn nodes(&self) -> Vec<usize> {
        let marker = |m: &Marker| match m {
            Marker::Node(n) => Some(*n),
            Marker::Append => None,
        };
        match self {
            Op::Call { node, .. } | Op::Bind { node, .. } | Op::Assign { node, .. } => vec![*node],
            Op::Statements(_) => Vec::new(),
            Op::Insert {
                parent, marker: m, ..
            }
            | Op::List {
                parent, marker: m, ..
            }
            | Op::Branch {
                parent, marker: m, ..
            } => std::iter::once(*parent).chain(marker(m)).collect(),
        }
    }

    fn marker_mut(&mut self) -> Option<&mut Marker> {
        match self {
            Op::Insert { marker, .. } | Op::List { marker, .. } | Op::Branch { marker, .. } => {
                Some(marker)
            }
            _ => None,
        }
    }
}

/// A template under construction.
pub struct Template<'a> {
    pub nodes: Vec<Node>,
    pub roots: Vec<usize>,
    pub ops: Vec<Op<'a>>,
    pub namespace: Namespace,
    /// Ops whose marker is the next static node added under `parent`: (parent, op index).
    pending_markers: Vec<(Option<usize>, usize)>,
}

impl<'a> Template<'a> {
    pub fn new(namespace: Namespace) -> Self {
        Self {
            nodes: Vec::new(),
            roots: Vec::new(),
            ops: Vec::new(),
            namespace,
            pending_markers: Vec::new(),
        }
    }

    pub fn add(&mut self, parent: Option<usize>, kind: NodeKind, span: Span) -> usize {
        let index = self.nodes.len();
        self.nodes.push(Node {
            kind,
            parent,
            children: Vec::new(),
            span,
        });
        match parent {
            Some(p) => self.nodes[p].children.push(index),
            None => self.roots.push(index),
        }
        let pending = std::mem::take(&mut self.pending_markers);
        for (p, op) in pending {
            if p == parent {
                if let Some(marker) = self.ops[op].marker_mut() {
                    *marker = Marker::Node(index);
                }
            } else {
                self.pending_markers.push((p, op));
            }
        }
        index
    }

    pub fn push(&mut self, op: Op<'a>) {
        self.ops.push(op);
    }

    /// Pushes an op whose marker is the next static node added under `parent`.
    pub fn push_before_next(&mut self, parent: Option<usize>, op: Op<'a>) {
        self.pending_markers.push((parent, self.ops.len()));
        self.ops.push(op);
    }

    pub fn last_child(&self, parent: Option<usize>) -> Option<usize> {
        match parent {
            Some(p) => self.nodes[p].children.last().copied(),
            None => self.roots.last().copied(),
        }
    }

    /// Appends text, merging with a preceding text node.
    pub fn add_text(&mut self, parent: Option<usize>, text: &str, span: Span) -> usize {
        if let Some(last) = self.last_child(parent)
            && let NodeKind::Text(existing) = &mut self.nodes[last].kind
            && !self.pending_markers.iter().any(|(p, _)| *p == parent)
        {
            existing.push_str(text);
            return last;
        }
        self.add(parent, NodeKind::Text(text.to_owned()), span)
    }

    pub fn tag(&self, node: usize) -> Option<&str> {
        match &self.nodes[node].kind {
            NodeKind::Element { tag, .. } => Some(tag),
            _ => None,
        }
    }

    pub fn element_attrs_mut(&mut self, node: usize) -> &mut Vec<(String, Option<String>)> {
        match &mut self.nodes[node].kind {
            NodeKind::Element { attrs, .. } => attrs,
            _ => unreachable!("attributes on a non-element node"),
        }
    }

    /// The minified HTML. Closing tags at the very end are omitted (the parser closes them).
    pub fn html(&self) -> String {
        let mut out = String::new();
        let last_root = self.roots.len().saturating_sub(1);
        for (i, &root) in self.roots.iter().enumerate() {
            self.write_node(root, i == last_root, &mut out);
        }
        out
    }

    fn write_node(&self, index: usize, trailing: bool, out: &mut String) {
        let node = &self.nodes[index];
        match &node.kind {
            NodeKind::Text(text) => html::escape_text(text, out),
            NodeKind::Raw(raw) => out.push_str(raw),
            NodeKind::Marker => out.push_str("<!>"),
            NodeKind::Element { tag, attrs } => {
                out.push('<');
                out.push_str(tag);
                for (name, value) in attrs {
                    html::write_attribute(name, value.as_deref(), out);
                }
                out.push('>');
                if html::is_void(tag) {
                    return;
                }
                // The parser drops a newline right after these start tags; keep the authored one.
                if matches!(tag.as_str(), "pre" | "textarea" | "listing")
                    && let Some(&first) = node.children.first()
                    && matches!(&self.nodes[first].kind, NodeKind::Text(text) if text.starts_with('\n'))
                {
                    out.push('\n');
                }
                let last = node.children.len().saturating_sub(1);
                for (i, &child) in node.children.iter().enumerate() {
                    self.write_node(child, trailing && i == last, out);
                }
                if !trailing || is_raw_text(tag) {
                    out.push_str("</");
                    out.push_str(tag);
                    out.push('>');
                }
            }
        }
    }

    pub fn has_ops(&self) -> bool {
        !self.ops.is_empty()
    }

    /// Emits the creation code: setup statements, the whole value (the root node, or the
    /// `Node[]` of a multi-root template) and, with `need_roots`, one expression per root.
    pub fn emit(self, cg: &mut Codegen<'a, '_>, span: Span, need_roots: bool) -> Emitted<'a> {
        let flags = self.flags();
        let html = self.html();
        let factory = cg.template(&html, flags, span);
        if !self.has_ops() && !need_roots {
            return Emitted {
                setup: Vec::new(),
                whole: cg.ast.call(span, cg.ast.ident(span, &factory), []),
                roots: Vec::new(),
            };
        }
        Emitter::new(self, cg, span).run(factory, need_roots)
    }

    fn flags(&self) -> u8 {
        let mut flags = 0;
        if self.roots.len() > 1 {
            flags |= MULTI_ROOT;
        }
        match self.namespace {
            Namespace::Html => {}
            Namespace::Svg => flags |= SVG,
            Namespace::MathMl => flags |= MATHML,
        }
        flags
    }
}

/// The output of [`Template::emit`].
pub struct Emitted<'a> {
    pub setup: Vec<Statement<'a>>,
    pub whole: Expression<'a>,
    pub roots: Vec<Expression<'a>>,
}

pub const MULTI_ROOT: u8 = 1;
pub const SVG: u8 = 2;
pub const MATHML: u8 = 4;

/// Elements whose content the HTML parser reads as raw text: an omitted closing tag would swallow
/// whatever follows, so theirs is always written.
fn is_raw_text(tag: &str) -> bool {
    matches!(
        tag,
        "textarea"
            | "title"
            | "script"
            | "style"
            | "xmp"
            | "iframe"
            | "noembed"
            | "noframes"
            | "plaintext"
    )
}

struct Emitter<'t, 'a, 'c> {
    tpl: Template<'a>,
    cg: &'t mut Codegen<'a, 'c>,
    span: Span,
    /// Variable name per node.
    vars: Vec<Option<String>>,
    has_needed: Vec<bool>,
    needed: Vec<bool>,
    /// The `Node[]` variable of a multi-root template.
    roots_var: Option<String>,
}

impl<'t, 'a, 'c> Emitter<'t, 'a, 'c> {
    fn new(tpl: Template<'a>, cg: &'t mut Codegen<'a, 'c>, span: Span) -> Self {
        let len = tpl.nodes.len();
        let mut needed = vec![false; len];
        for op in &tpl.ops {
            for node in op.nodes() {
                needed[node] = true;
            }
        }
        // A node "has needed" when it or a descendant is referenced.
        let mut has_needed = needed.clone();
        for index in (0..len).rev() {
            if has_needed[index]
                && let Some(parent) = tpl.nodes[index].parent
            {
                has_needed[parent] = true;
            }
        }
        Self {
            tpl,
            cg,
            span,
            vars: vec![None; len],
            has_needed,
            needed,
            roots_var: None,
        }
    }

    fn run(mut self, factory: String, need_roots: bool) -> Emitted<'a> {
        let ast = self.cg.ast;
        let span = self.span;
        let multi = self.tpl.roots.len() > 1;
        let mut declarators: Vec<(String, Expression<'a>)> = Vec::new();
        let created = ast.call(span, ast.ident(span, &factory), []);
        let roots_var = if multi {
            let name = self.cg.names.fresh("_nodes");
            declarators.push((name.clone(), created));
            Some(name)
        } else {
            let root = self.tpl.roots[0];
            let name = self.cg.names.fresh("_el");
            declarators.push((name.clone(), created));
            self.vars[root] = Some(name);
            None
        };
        self.roots_var = roots_var.clone();
        if let Some(roots_var) = &roots_var {
            for (i, &root) in self.tpl.roots.clone().iter().enumerate() {
                if self.has_needed[root] {
                    let name = self.cg.names.fresh(&base_name(&self.tpl.nodes[root].kind));
                    declarators
                        .push((name.clone(), ast.index(span, ast.ident(span, roots_var), i)));
                    self.vars[root] = Some(name);
                }
            }
        }
        // Declare the referenced nodes in document order.
        for index in 0..self.tpl.nodes.len() {
            if self.vars[index].is_some() || !self.wants_var(index) {
                continue;
            }
            let path = self.path(index);
            let name = self.cg.names.fresh(&base_name(&self.tpl.nodes[index].kind));
            declarators.push((name.clone(), path));
            self.vars[index] = Some(name);
        }
        let mut statements = vec![ast.const_decls(span, declarators)];
        let ops = std::mem::take(&mut self.tpl.ops);
        for op in ops {
            self.emit_op(op, &mut statements);
        }
        let whole = match &roots_var {
            Some(name) => ast.ident(span, name),
            None => self.node_expr(self.tpl.roots[0]),
        };
        let roots = if need_roots {
            self.tpl
                .roots
                .iter()
                .map(|&root| self.node_expr(root))
                .collect()
        } else {
            Vec::new()
        };
        Emitted {
            setup: statements,
            whole,
            roots,
        }
    }

    /// Referenced nodes get a variable; so does an ancestor of referenced nodes that is followed
    /// by a referenced sibling (it anchors the sibling's walk).
    fn wants_var(&self, index: usize) -> bool {
        if self.needed[index] {
            return true;
        }
        if !self.has_needed[index] {
            return false;
        }
        let Some(parent) = self.tpl.nodes[index].parent else {
            return true;
        };
        let siblings = &self.tpl.nodes[parent].children;
        let position = siblings.iter().position(|&c| c == index).unwrap_or(0);
        siblings[position + 1..].iter().any(|&s| self.has_needed[s])
    }

    fn node_expr(&self, index: usize) -> Expression<'a> {
        match &self.vars[index] {
            Some(name) => self.cg.ast.ident(self.span, name),
            None => self.path(index),
        }
    }

    /// `base.firstChild.nextSibling…` from the nearest declared sibling or ancestor.
    fn path(&self, index: usize) -> Expression<'a> {
        let ast = self.cg.ast;
        let span = self.span;
        let Some(parent) = self.tpl.nodes[index].parent else {
            let roots_var = self.roots_var.as_deref().expect("multi-root template");
            let position = self.tpl.roots.iter().position(|&r| r == index).unwrap_or(0);
            return ast.index(span, ast.ident(span, roots_var), position);
        };
        let siblings = &self.tpl.nodes[parent].children;
        let position = siblings.iter().position(|&c| c == index).unwrap_or(0);
        let anchor = (0..position)
            .rev()
            .find(|&j| self.vars[siblings[j]].is_some());
        let (mut expr, hops) = match anchor {
            Some(j) => (self.node_expr(siblings[j]), position - j),
            None => (
                ast.member(span, self.node_expr(parent), "firstChild"),
                position,
            ),
        };
        for _ in 0..hops {
            expr = ast.member(span, expr, "nextSibling");
        }
        expr
    }

    fn marker_expr(&self, marker: Marker) -> Expression<'a> {
        match marker {
            Marker::Node(node) => self.node_expr(node),
            Marker::Append => self.cg.ast.null(self.span),
        }
    }

    fn emit_op(&mut self, op: Op<'a>, out: &mut Vec<Statement<'a>>) {
        let ast = self.cg.ast;
        match op {
            Op::Call {
                span,
                helper,
                node,
                args,
            } => {
                let callee = self.cg.runtime(helper, span);
                let call = ast.call(
                    span,
                    callee,
                    std::iter::once(self.node_expr(node)).chain(args),
                );
                out.push(ast.expr_stmt(span, call));
            }
            Op::Bind {
                span,
                node,
                compute,
                apply,
            } => {
                let callee = self.cg.runtime("bind", span);
                let call = ast.call(span, callee, [self.node_expr(node), compute, apply]);
                out.push(ast.expr_stmt(span, call));
            }
            Op::Assign {
                span,
                node,
                prop,
                value,
            } => {
                out.push(ast.assign_member(span, self.node_expr(node), &prop, value));
            }
            Op::Statements(statements) => out.extend(statements),
            Op::Insert {
                span,
                parent,
                value,
                marker,
            } => {
                let callee = self.cg.runtime("insert", span);
                let mut args = vec![self.node_expr(parent), value];
                if marker != Marker::Append {
                    args.push(self.marker_expr(marker));
                }
                out.push(ast.expr_stmt(span, ast.call(span, callee, args)));
            }
            Op::List {
                span,
                parent,
                marker,
                source,
                render,
                key,
            } => {
                let callee = self.cg.runtime("list", span);
                let mut args = vec![
                    self.node_expr(parent),
                    self.marker_expr(marker),
                    source,
                    render,
                ];
                args.extend(key);
                out.push(ast.expr_stmt(span, ast.call(span, callee, args)));
            }
            Op::Branch {
                span,
                parent,
                marker,
                cond,
                when_true,
                when_false,
            } => {
                let callee = self.cg.runtime("branch", span);
                let mut args = vec![
                    self.node_expr(parent),
                    self.marker_expr(marker),
                    cond,
                    when_true,
                ];
                args.extend(when_false);
                out.push(ast.expr_stmt(span, ast.call(span, callee, args)));
            }
        }
    }
}

/// `_el` for roots and elements named after their tag (`_button`), `_text`, `_marker`.
fn base_name(kind: &NodeKind) -> String {
    match kind {
        NodeKind::Element { tag, .. } => {
            let clean: String = tag
                .chars()
                .map(|c| {
                    if c.is_ascii_alphanumeric() {
                        c.to_ascii_lowercase()
                    } else {
                        '_'
                    }
                })
                .collect();
            format!("_{clean}")
        }
        NodeKind::Text(_) => "_text".to_owned(),
        NodeKind::Raw(_) => "_raw".to_owned(),
        NodeKind::Marker => "_marker".to_owned(),
    }
}
