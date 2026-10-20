//! `.md` and `.html` imports as Lumiose components (decision-22, TASK-69).
//!
//! [`markdown`] and [`html`] turn a file into the `.stsx` source of a module whose default export
//! renders the file's content statically; the host compiles that source with `lumiose_compiler`
//! (as `<file>.stsx`), so the component is a static template on the client and static parts on
//! the server, and its styles go through the regular style pipeline.
//!
//! # Markdown
//!
//! CommonMark plus the GFM extensions (tables, strikethrough, task lists, autolinks, footnotes),
//! rendered by comrak. Raw HTML is kept (the file is the project's own) and goes through the HTML
//! pipeline below. Headings get GitHub-style ids (`## Hello, World!` → `id="hello-world"`, then
//! `-1`, `-2` for repeats) unless they have one. The module exports them as `headings`
//! (`{ depth, text, id }`, document order; headings whose text has no slug are left out). A leading `---` YAML block is the frontmatter:
//! returned raw in [`Component::frontmatter`] (the host parses it) and re-exported by the module
//! from `./<name>?lumiose-frontmatter`. A `<script>` element in the raw HTML is an error,
//! [`SCRIPT_IN_MARKDOWN`] (decision-22): only `.html` imports run scripts. It is left out of the
//! markup.
//!
//! # HTML
//!
//! Parsed with html5ever, the way a browser does. A full document (a doctype, or an `<html>`,
//! `<head>` or `<body>` tag) contributes its `<body>` content, plus the `<style>` and `<script>`
//! elements of its `<head>`; anything else is a fragment, used as it is.
//!
//! - Top-level `<style>` elements become file-level style blocks: scoped to the file's content
//!   (`<style global>` is not scoped). A `<style>` nested in an element scopes to that element's
//!   subtree, as in `.stsx`. `<style>` inside `<svg>` or `<template>` is left as it is.
//! - JavaScript `<script>` elements (no `type`, `module` or a JavaScript MIME type) are removed
//!   from the markup and returned in [`Component::scripts`], in document order. The component
//!   then calls the client script (`?client`, decision-71) `./<name>?lumiose-script?client`, a
//!   module the host makes import the scripts, so the pages that render it load them as a module
//!   script, without the island runtime. Other scripts (JSON-LD, import maps) stay in the markup.
//! - A `<template>`'s content (a web component's shadow DOM) is kept verbatim, as are the raw
//!   text elements (`<noscript>`, `<xmp>`, `<iframe>`…).
//! - Comments and the doctype are dropped. Attributes JSX cannot write (`@click`) are passed
//!   through a spread object.
//! - Relative asset URLs (`<img src="./photo.jpg">`, `srcset`, `<a href="./report.pdf">`) become
//!   `?url` imports of the files, which the host bundles; in Markdown too.

mod assets;
mod dom;
mod emit;
mod limits;
mod markdown;

use html5ever::tendril::TendrilSink;
use html5ever::tree_builder::TreeBuilderOpts;
use html5ever::{ParseOpts, QualName, local_name, ns};

use crate::dom::{Data, Handle, Sink};

/// The module of a content file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Component {
    /// The `.stsx` source of the module.
    pub source: String,
    /// The raw YAML of a Markdown file's frontmatter (without its `---` lines).
    pub frontmatter: Option<String>,
    /// The client scripts, in document order.
    pub scripts: Vec<Script>,
    /// Errors in the file; the host fails the import with them.
    pub diagnostics: Vec<Diagnostic>,
}

/// The diagnostic code of a `<script>` in a Markdown file (registered in `lumiose_compiler`).
pub const SCRIPT_IN_MARKDOWN: &str = "LUM1008";

/// The diagnostic code of a file nested too deeply to parse (registered in `lumiose_compiler`).
pub const NESTED_TOO_DEEP: &str = "LUM1009";

/// An error in a content file. Its code is registered in `lumiose_compiler`'s diagnostics registry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    /// A registered code, such as `LUM1008`.
    pub code: &'static str,
    pub message: String,
    /// Byte offsets in the file's source.
    pub span: std::ops::Range<usize>,
    pub help: Option<String>,
}

/// A client script of the file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Script {
    /// `<script src="…">`: the URL as written, resolved against the file.
    Src(String),
    /// An inline script's code.
    Inline(String),
}

/// The component module of a Markdown file named `name` (`post.md`).
pub fn markdown(source: &str, name: &str) -> Component {
    let (frontmatter, body) = markdown::split_frontmatter(source);
    // `body` is the end of `source`.
    let body_start = source.len() - body.len();
    if let Some(offset) = limits::quotes_too_deep(body) {
        return too_deep(name, true, frontmatter, body_start + offset);
    }
    let (html, scripts) = markdown::to_html(body);
    if limits::html_too_deep(&html).is_some() {
        return too_deep(name, true, frontmatter, body_start);
    }
    let nodes = fragment(&html);
    let headings = markdown::heading_ids(&nodes);
    let mut component = emit::module(emit::Input {
        nodes,
        name,
        markdown: Some(headings),
        frontmatter: frontmatter.map(str::to_owned),
    });
    component.diagnostics = scripts
        .into_iter()
        .map(|offset| Diagnostic {
            code: SCRIPT_IN_MARKDOWN,
            message: "`<script>` is not supported in Markdown".to_owned(),
            span: body_start + offset..body_start + offset + "<script".len(),
            help: Some(
                "Markdown is content only. Move the script to an `.html` file and import that \
                 instead, or render this content from a component that loads the script \
                 (an island or a `.stsx` module)."
                    .to_owned(),
            ),
        })
        .collect();
    component
}

/// The component module of an HTML file named `name` (`card.html`).
pub fn html(source: &str, name: &str) -> Component {
    if let Some(offset) = limits::html_too_deep(source) {
        return too_deep(name, false, None, offset);
    }
    let nodes = if is_document(source) {
        document(source)
    } else {
        fragment(source)
    };
    emit::module(emit::Input {
        nodes,
        name,
        markdown: None,
        frontmatter: None,
    })
}

/// An empty component and the `LUM1009` error at `offset`: the file nests deeper than
/// [`limits::MAX_NESTING`] and is not parsed.
fn too_deep(name: &str, markdown: bool, frontmatter: Option<&str>, offset: usize) -> Component {
    let mut component = emit::module(emit::Input {
        nodes: Vec::new(),
        name,
        markdown: markdown.then(Vec::new),
        frontmatter: frontmatter.map(str::to_owned),
    });
    component.diagnostics.push(Diagnostic {
        code: NESTED_TOO_DEEP,
        message: format!(
            "the content is nested deeper than {} levels",
            limits::MAX_NESTING
        ),
        span: offset..offset + 1,
        help: Some(
            "Close the elements or block quotes you open; no document nests this deep.".to_owned(),
        ),
    });
    component
}

fn parse_options() -> ParseOpts {
    ParseOpts {
        tree_builder: TreeBuilderOpts {
            scripting_enabled: true,
            ..TreeBuilderOpts::default()
        },
        ..ParseOpts::default()
    }
}

/// The top-level nodes of `html` parsed as the content of a `<template>`, which accepts any
/// element (`<tr>`, `<li>`) at the top level.
fn fragment(html: &str) -> Vec<Handle> {
    let context = QualName::new(None, ns!(html), local_name!("template"));
    let document =
        html5ever::parse_fragment(Sink::default(), parse_options(), context, vec![], true)
            .one(html);
    // The fragment's nodes are the children of an `<html>` root.
    let root = first_element(&document);
    root.map_or_else(Vec::new, |root| root.children.borrow().clone())
}

/// A full document's content: the `<style>` elements and client scripts of its `<head>`, then
/// the children of its `<body>`.
fn document(html: &str) -> Vec<Handle> {
    let document = html5ever::parse_document(Sink::default(), parse_options()).one(html);
    let Some(root) = first_element(&document) else {
        return Vec::new();
    };
    let mut nodes = Vec::new();
    for part in root.children.borrow().iter() {
        match part.html_name() {
            Some("head") => nodes.extend(
                part.children
                    .borrow()
                    .iter()
                    .filter(|node| {
                        node.html_name() == Some("style") || emit::is_client_script(node)
                    })
                    .cloned(),
            ),
            Some("body") => nodes.extend(part.children.borrow().iter().cloned()),
            _ => {}
        }
    }
    nodes
}

fn first_element(node: &Handle) -> Option<Handle> {
    node.children
        .borrow()
        .iter()
        .find(|child| matches!(child.data, Data::Element { .. }))
        .cloned()
}

/// Whether `source` is a full document: a doctype or an `<html>` start tag first, or a `<head>`
/// or `<body>` start tag anywhere.
fn is_document(source: &str) -> bool {
    let lower = source.to_ascii_lowercase();
    let mut rest = lower.trim_start_matches(['\u{feff}', ' ', '\t', '\n', '\r', '\x0c']);
    while let Some(after) = rest.strip_prefix("<!--") {
        rest = after
            .split_once("-->")
            .map_or("", |(_, after)| after)
            .trim_start();
    }
    let tag = |text: &str, name: &str| {
        text.strip_prefix('<')
            .and_then(|t| t.strip_prefix(name))
            .is_some_and(|t| {
                t.starts_with(|c: char| c.is_ascii_whitespace() || c == '>' || c == '/')
            })
    };
    rest.starts_with("<!doctype")
        || tag(rest, "html")
        || lower
            .match_indices('<')
            .any(|(i, _)| tag(&lower[i..], "head") || tag(&lower[i..], "body"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_documents() {
        assert!(is_document("<!DOCTYPE html><p>x"));
        assert!(is_document("\u{feff}<!-- c --> <HTML lang=en>"));
        assert!(is_document("<p>x</p><body class=a>"));
        assert!(!is_document("<p>x</p>"));
        assert!(!is_document("<header>x</header><bodyx>"));
    }
}
