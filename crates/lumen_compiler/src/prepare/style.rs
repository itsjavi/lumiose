//! The masked style artifacts in the parsed AST (spec §5.1 "Handling the masked artifacts").
//!
//! - Resolves each `$name` reference to its JS binding with `oxc_semantic`, on the masked AST
//!   where the references are still present. This is the hook for the CSS pipeline (TASK-10).
//! - Drops the reference placeholder nodes: `{ref}` JSX children and `;ref;` statements.
//! - Removes import specifiers that only `$` references use (their modules become CSS
//!   dependencies).
//!
//! Masked block whitespace inside JSX text is removed later by the codegen, before JSX
//! whitespace normalisation, because SVG `<style>` blocks are re-emitted verbatim there.

use std::collections::HashMap;

use oxc_allocator::TakeIn;
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, VisitMut, walk_mut};
use oxc_semantic::Scoping;
use oxc_span::GetSpan;
use oxc_syntax::symbol::{SymbolFlags, SymbolId};

use crate::codegen::ast::Ast;
use crate::scanner::{Placement, StyleBlock};
use crate::span::Span;

/// A `$name` reference with its resolved binding.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ResolvedStyleRef {
    /// Index of the block in the scan result.
    pub block: u32,
    /// `$radius.lg` → `["radius", "lg"]`.
    pub path: Vec<String>,
    pub span: Span,
    /// `None` when the root name does not resolve (the CSS pipeline reports LUM3008).
    pub binding: Option<StyleRefBinding>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct StyleRefBinding {
    pub name: String,
    /// The binding identifier's span.
    pub declaration: Span,
    pub kind: StyleRefBindingKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(tag = "type", rename_all = "camelCase")
)]
pub enum StyleRefBindingKind {
    /// A module top-level binding (`const radius = …`).
    Module { constant: bool },
    /// A binding inside a function (a component's `const`).
    Local { constant: bool },
    /// An import; `imported` is `"default"` / `"*"` for default / namespace imports.
    Import { source: String, imported: String },
}

/// Resolves references, then strips the placeholders from `program`.
pub fn prepare_style_artifacts<'a>(
    ast: &Ast<'a>,
    program: &mut Program<'a>,
    scoping: &Scoping,
    blocks: &[StyleBlock],
) -> Vec<ResolvedStyleRef> {
    if blocks.is_empty() {
        return Vec::new();
    }
    let mut roots = HashMap::new();
    for (index, block) in blocks.iter().enumerate() {
        for reference in &block.refs {
            if reference.close.is_some() {
                roots.insert(reference.span.start + 1, (index, reference));
            }
        }
    }
    let mut collector = Collector {
        scoping,
        roots: &roots,
        found: HashMap::new(),
        imports: HashMap::new(),
    };
    collector.visit_program(program);

    let mut resolved = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        for reference in &block.refs {
            let binding = collector
                .found
                .get(&(reference.span.start + 1))
                .map(|&symbol| describe_binding(scoping, symbol, &collector.imports));
            resolved.push(ResolvedStyleRef {
                block: index as u32,
                path: reference.path.clone(),
                span: reference.span,
                binding,
            });
        }
    }

    let block_spans: Vec<Span> = blocks
        .iter()
        .filter(|b| !matches!(b.placement, Placement::Expression))
        .map(|b| b.span)
        .collect();
    let ref_only_imports: Vec<SymbolId> = collector
        .imports
        .keys()
        .copied()
        .filter(|&symbol| {
            let references = scoping.get_resolved_references(symbol).collect::<Vec<_>>();
            !references.is_empty()
                && collector.found.values().any(|&s| s == symbol)
                && references.len() == collector.found.values().filter(|&&s| s == symbol).count()
        })
        .collect();
    let mut stripper = Stripper {
        ast,
        blocks: &block_spans,
        remove_imports: &ref_only_imports,
    };
    stripper.visit_program(program);
    resolved
}

fn describe_binding(
    scoping: &Scoping,
    symbol: SymbolId,
    imports: &HashMap<SymbolId, (String, String)>,
) -> StyleRefBinding {
    let flags = scoping.symbol_flags(symbol);
    let constant = flags.contains(SymbolFlags::ConstVariable) && !scoping.symbol_is_mutated(symbol);
    let kind = if let Some((source, imported)) = imports.get(&symbol) {
        StyleRefBindingKind::Import {
            source: source.clone(),
            imported: imported.clone(),
        }
    } else if scoping.symbol_scope_id(symbol) == scoping.root_scope_id() {
        StyleRefBindingKind::Module { constant }
    } else {
        StyleRefBindingKind::Local { constant }
    };
    StyleRefBinding {
        name: scoping.symbol_name(symbol).to_owned(),
        declaration: scoping.symbol_span(symbol).into(),
        kind,
    }
}

struct Collector<'s, 'r> {
    scoping: &'s Scoping,
    roots: &'r HashMap<u32, (usize, &'r crate::scanner::StyleRef)>,
    /// Ref root offset → symbol.
    found: HashMap<u32, SymbolId>,
    /// Import symbol → (source, imported name).
    imports: HashMap<SymbolId, (String, String)>,
}

impl<'a> Visit<'a> for Collector<'_, '_> {
    fn visit_import_declaration(&mut self, it: &ImportDeclaration<'a>) {
        for specifier in it.specifiers.iter().flatten() {
            let imported = match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(s) => s.imported.name().to_string(),
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => "default".to_owned(),
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => "*".to_owned(),
            };
            if let Some(symbol) = specifier.local().symbol_id.get() {
                self.imports
                    .insert(symbol, (it.source.value.to_string(), imported));
            }
        }
    }

    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if self.roots.contains_key(&it.span.start)
            && let Some(reference_id) = it.reference_id.get()
            && let Some(symbol) = self.scoping.get_reference(reference_id).symbol_id()
        {
            self.found.insert(it.span.start, symbol);
        }
    }
}

struct Stripper<'s, 'a> {
    ast: &'s Ast<'a>,
    blocks: &'s [Span],
    remove_imports: &'s [SymbolId],
}

impl Stripper<'_, '_> {
    fn in_block(&self, span: oxc_span::Span) -> bool {
        self.blocks
            .iter()
            .any(|b| b.start <= span.start && span.end <= b.end)
    }
}

impl<'a> VisitMut<'a> for Stripper<'_, 'a> {
    fn visit_program(&mut self, it: &mut Program<'a>) {
        let body = it.body.take_in(self.ast);
        let mut kept = self.ast.vec();
        for mut statement in body {
            match &mut statement {
                Statement::EmptyStatement(s) if self.in_block(s.span) => continue,
                Statement::ExpressionStatement(s) if self.in_block(s.span) => continue,
                Statement::ImportDeclaration(import) if !self.remove_imports.is_empty() => {
                    if let Some(specifiers) = &mut import.specifiers {
                        let before = specifiers.len();
                        specifiers.retain(|s| {
                            s.local()
                                .symbol_id
                                .get()
                                .is_none_or(|symbol| !self.remove_imports.contains(&symbol))
                        });
                        if before > 0 && specifiers.is_empty() {
                            continue;
                        }
                    }
                }
                _ => {}
            }
            kept.push(statement);
        }
        it.body = kept;
        walk_mut::walk_program(self, it);
    }

    fn visit_jsx_children(&mut self, it: &mut oxc_allocator::ArenaVec<'a, JSXChild<'a>>) {
        it.retain(
            |child| !matches!(child, JSXChild::ExpressionContainer(c) if self.in_block(c.span())),
        );
        walk_mut::walk_jsx_children(self, it);
    }
}
