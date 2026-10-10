//! A minimal DOM for html5ever's tree builder: elements, text and template contents (comments,
//! doctypes and processing instructions are kept as inert nodes and never emitted).

use std::borrow::Cow;
use std::cell::{Cell, RefCell};
use std::rc::{Rc, Weak};

use html5ever::interface::{ElementFlags, NodeOrText, QuirksMode, TreeSink};
use html5ever::tendril::StrTendril;
use html5ever::{Attribute, ExpandedName, QualName};

pub(crate) type Handle = Rc<Node>;

pub(crate) struct Node {
    pub(crate) data: Data,
    parent: Cell<Option<Weak<Node>>>,
    pub(crate) children: RefCell<Vec<Handle>>,
}

pub(crate) enum Data {
    Document,
    Element {
        name: QualName,
        attrs: RefCell<Vec<Attribute>>,
        /// The contents of a `<template>`, a document-like fragment.
        template: Option<Handle>,
        mathml_annotation_xml_integration_point: bool,
    },
    Text(RefCell<StrTendril>),
    /// Comments, doctypes and processing instructions.
    Inert,
}

impl Node {
    pub(crate) fn new(data: Data) -> Handle {
        Rc::new(Self {
            data,
            parent: Cell::new(None),
            children: RefCell::new(Vec::new()),
        })
    }

    /// The local name of an element in the HTML namespace.
    pub(crate) fn html_name(&self) -> Option<&str> {
        match &self.data {
            Data::Element { name, .. } if name.ns == html5ever::ns!(html) => Some(&name.local),
            _ => None,
        }
    }

    pub(crate) fn attribute(&self, local: &str) -> Option<String> {
        let Data::Element { attrs, .. } = &self.data else {
            return None;
        };
        attrs
            .borrow()
            .iter()
            .find(|a| a.name.ns.is_empty() && &*a.name.local == local)
            .map(|a| a.value.to_string())
    }

    pub(crate) fn set_attribute(&self, local: &str, value: &str) {
        if let Data::Element { attrs, .. } = &self.data {
            attrs.borrow_mut().push(Attribute {
                name: QualName::new(None, html5ever::ns!(), local.into()),
                value: value.into(),
            });
        }
    }

    /// The concatenated text of the node's descendants.
    pub(crate) fn text_content(&self, out: &mut String) {
        let mut stack: Vec<Handle> = self.children.borrow().iter().rev().cloned().collect();
        while let Some(node) = stack.pop() {
            match &node.data {
                Data::Text(text) => out.push_str(&text.borrow()),
                Data::Element { .. } => stack.extend(node.children.borrow().iter().rev().cloned()),
                _ => {}
            }
        }
    }
}

// Dropping a deep tree recursively could overflow the stack: the children of nodes that are
// dropped with this one (no other owner) are moved to a list first. Nodes still owned elsewhere
// (the content returned by a parse) keep theirs.
impl Drop for Node {
    fn drop(&mut self) {
        let mut nodes = std::mem::take(&mut *self.children.borrow_mut());
        take_template_contents(&self.data, &mut nodes);
        while let Some(node) = nodes.pop() {
            if Rc::strong_count(&node) == 1 {
                nodes.extend(std::mem::take(&mut *node.children.borrow_mut()));
                take_template_contents(&node.data, &mut nodes);
            }
        }
    }
}

/// Moves the children of a template's contents that are dropped with it to `nodes`.
fn take_template_contents(data: &Data, nodes: &mut Vec<Handle>) {
    if let Data::Element {
        template: Some(contents),
        ..
    } = data
        && Rc::strong_count(contents) == 1
    {
        nodes.extend(std::mem::take(&mut *contents.children.borrow_mut()));
    }
}

/// The tree builder's sink; `finish` returns the document node.
pub(crate) struct Sink {
    document: Handle,
}

impl Default for Sink {
    fn default() -> Self {
        Self {
            document: Node::new(Data::Document),
        }
    }
}

fn append(parent: &Handle, child: Handle) {
    let previous = child.parent.replace(Some(Rc::downgrade(parent)));
    debug_assert!(previous.is_none(), "a node with a parent is appended");
    parent.children.borrow_mut().push(child);
}

/// Merges `text` into `node` when it is a text node.
fn append_to_text(node: &Handle, text: &str) -> bool {
    if let Data::Text(contents) = &node.data {
        contents.borrow_mut().push_slice(text);
        true
    } else {
        false
    }
}

fn parent_and_index(target: &Handle) -> Option<(Handle, usize)> {
    let weak = target.parent.take()?;
    let parent = weak.upgrade()?;
    target.parent.set(Some(weak));
    let index = parent
        .children
        .borrow()
        .iter()
        .position(|child| Rc::ptr_eq(child, target))?;
    Some((parent, index))
}

fn remove_from_parent(target: &Handle) {
    if let Some((parent, index)) = parent_and_index(target) {
        parent.children.borrow_mut().remove(index);
        target.parent.set(None);
    }
}

impl TreeSink for Sink {
    type Handle = Handle;
    type Output = Handle;
    type ElemName<'a> = ExpandedName<'a>;

    fn finish(self) -> Handle {
        self.document
    }

    // Authored files are parsed like a browser does; errors are not reported.
    fn parse_error(&self, _message: Cow<'static, str>) {}

    fn get_document(&self) -> Handle {
        self.document.clone()
    }

    fn elem_name<'a>(&'a self, target: &'a Handle) -> ExpandedName<'a> {
        match &target.data {
            Data::Element { name, .. } => name.expanded(),
            _ => unreachable!("the tree builder asks only elements for their name"),
        }
    }

    fn create_element(&self, name: QualName, attrs: Vec<Attribute>, flags: ElementFlags) -> Handle {
        Node::new(Data::Element {
            name,
            attrs: RefCell::new(attrs),
            template: flags.template.then(|| Node::new(Data::Document)),
            mathml_annotation_xml_integration_point: flags.mathml_annotation_xml_integration_point,
        })
    }

    fn create_comment(&self, _text: StrTendril) -> Handle {
        Node::new(Data::Inert)
    }

    fn create_pi(&self, _target: StrTendril, _data: StrTendril) -> Handle {
        Node::new(Data::Inert)
    }

    fn append(&self, parent: &Handle, child: NodeOrText<Handle>) {
        match child {
            NodeOrText::AppendText(text) => {
                let last = parent.children.borrow().last().cloned();
                if last.is_none_or(|last| !append_to_text(&last, &text)) {
                    append(parent, Node::new(Data::Text(RefCell::new(text))));
                }
            }
            NodeOrText::AppendNode(node) => append(parent, node),
        }
    }

    fn append_based_on_parent_node(
        &self,
        element: &Handle,
        prev_element: &Handle,
        child: NodeOrText<Handle>,
    ) {
        if parent_and_index(element).is_some() {
            self.append_before_sibling(element, child);
        } else {
            self.append(prev_element, child);
        }
    }

    fn append_doctype_to_document(&self, _: StrTendril, _: StrTendril, _: StrTendril) {}

    fn get_template_contents(&self, target: &Handle) -> Handle {
        match &target.data {
            Data::Element {
                template: Some(contents),
                ..
            } => contents.clone(),
            _ => unreachable!("only templates have contents"),
        }
    }

    fn same_node(&self, x: &Handle, y: &Handle) -> bool {
        Rc::ptr_eq(x, y)
    }

    fn set_quirks_mode(&self, _mode: QuirksMode) {}

    fn append_before_sibling(&self, sibling: &Handle, child: NodeOrText<Handle>) {
        let Some((parent, index)) = parent_and_index(sibling) else {
            return;
        };
        let child = match child {
            NodeOrText::AppendText(text) => {
                let previous = index
                    .checked_sub(1)
                    .map(|i| parent.children.borrow()[i].clone());
                if previous.is_some_and(|previous| append_to_text(&previous, &text)) {
                    return;
                }
                Node::new(Data::Text(RefCell::new(text)))
            }
            NodeOrText::AppendNode(node) => {
                remove_from_parent(&node);
                node
            }
        };
        child.parent.set(Some(Rc::downgrade(&parent)));
        parent.children.borrow_mut().insert(index, child);
    }

    fn add_attrs_if_missing(&self, target: &Handle, attrs: Vec<Attribute>) {
        if let Data::Element {
            attrs: existing, ..
        } = &target.data
        {
            let mut existing = existing.borrow_mut();
            for attr in attrs {
                if !existing.iter().any(|e| e.name == attr.name) {
                    existing.push(attr);
                }
            }
        }
    }

    fn remove_from_parent(&self, target: &Handle) {
        remove_from_parent(target);
    }

    fn reparent_children(&self, node: &Handle, new_parent: &Handle) {
        let children = std::mem::take(&mut *node.children.borrow_mut());
        for child in &children {
            child.parent.set(Some(Rc::downgrade(new_parent)));
        }
        new_parent.children.borrow_mut().extend(children);
    }

    fn is_mathml_annotation_xml_integration_point(&self, target: &Handle) -> bool {
        matches!(
            target.data,
            Data::Element {
                mathml_annotation_xml_integration_point: true,
                ..
            }
        )
    }
}
