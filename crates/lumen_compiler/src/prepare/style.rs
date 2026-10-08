//! The masked style artifacts in the parsed AST (spec §5.1 "Handling the masked artifacts").
//!
//! - Resolves each `$name` reference to its JS binding with `oxc_semantic`, on the masked AST
//!   where the references are still present, and folds it to a constant ([`super::constants`])
//!   for the CSS pipeline (`LUM3008` when it is not one).
//! - Drops the reference placeholder nodes: `{ref}` JSX children and `;ref;` statements.
//! - Removes import specifiers that only `$` references use (their modules become CSS
//!   dependencies).
//!
//! Masked block whitespace inside JSX text is removed later by the codegen, before JSX
//! whitespace normalisation, because SVG `<style>` blocks are re-emitted verbatim there.

use std::collections::{HashMap, HashSet};

use oxc_allocator::{Allocator, TakeIn};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, VisitMut, walk_mut};
use oxc_semantic::{Scoping, Semantic};
use oxc_span::GetSpan;
use oxc_syntax::symbol::{SymbolFlags, SymbolId};

use super::constants::{ConstValue, FoldError, Folder, HostModule, HostModules, ModuleRequest};
use crate::codegen::ast::Ast;
use crate::diagnostics::{Code, Diagnostic};
use crate::scanner::{Placement, StyleBlock, StyleRef};
use crate::span::Span;

/// A `$name` reference with its resolved binding.
#[derive(Debug, Clone, PartialEq)]
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
    /// `None` when the root name does not resolve (`LUM3008`).
    pub binding: Option<StyleRefBinding>,
    /// The folded constant; `None` when it cannot be folded (`LUM3008`, `LUM3009`) or a host
    /// module is still missing.
    pub value: Option<ConstValue>,
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

/// The style references of a file, resolved and folded (input of the CSS pipeline).
#[derive(Debug, Default)]
pub struct StyleArtifacts {
    pub refs: Vec<ResolvedStyleRef>,
    /// `LUM3008` for references that cannot be folded.
    pub diagnostics: Vec<Diagnostic>,
    /// Host modules needed to fold imported constants (see [`super::constants`]).
    pub requests: Vec<ModuleRequest>,
    /// Ids of the host modules the folded constants were read from.
    pub deps: Vec<String>,
    /// Import bindings that only `$` references use.
    remove_imports: Vec<SymbolId>,
}

impl StyleArtifacts {
    /// True when every imported constant could be folded (no host module is missing).
    pub fn is_complete(&self) -> bool {
        self.requests.is_empty()
    }
}

/// Resolves every `$name` reference of `blocks` to its binding with `oxc_semantic` and folds
/// it to a constant. References whose start is in `skip` (hyphenated ones, reported by the CSS
/// pipeline as `LUM3009`) are resolved but neither folded nor reported. `semantic` must be built
/// from `program` with nodes when a block has references.
pub fn resolve_style_refs<'p>(
    allocator: &'p Allocator,
    program: &'p Program<'p>,
    semantic: &Semantic<'p>,
    filename: &str,
    blocks: &[StyleBlock],
    modules: &[HostModule],
    skip: &HashSet<u32>,
) -> StyleArtifacts {
    if blocks.is_empty() {
        return StyleArtifacts::default();
    }
    let scoping = semantic.scoping();
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

    let hosts = HostModules::new(modules);
    let mut folder = Folder::new(allocator, program, semantic, filename, &hosts);
    let mut artifacts = StyleArtifacts::default();
    for (index, block) in blocks.iter().enumerate() {
        if block.placement == Placement::Expression {
            continue;
        }
        for reference in &block.refs {
            let symbol = collector.found.get(&(reference.span.start + 1)).copied();
            let binding =
                symbol.map(|symbol| describe_binding(scoping, symbol, &collector.imports));
            let mut value = None;
            if !skip.contains(&reference.span.start) {
                match symbol.map(|symbol| folder.fold(symbol, &reference.path)) {
                    Some(Ok(folded)) => value = Some(folded),
                    Some(Err(FoldError::Pending)) => {}
                    Some(Err(FoldError::NotConstant {
                        reason,
                        declaration,
                    })) => {
                        artifacts
                            .diagnostics
                            .push(not_constant(reference, &reason, declaration))
                    }
                    Some(Err(FoldError::Missing(reason))) => artifacts
                        .diagnostics
                        .push(not_constant(reference, &reason, None)),
                    None => artifacts.diagnostics.push(not_constant(
                        reference,
                        &format!("`{}` is not declared in scope", reference.path[0]),
                        None,
                    )),
                }
            }
            artifacts.refs.push(ResolvedStyleRef {
                block: index as u32,
                path: reference.path.clone(),
                span: reference.span,
                binding,
                value,
            });
        }
    }
    artifacts.requests = folder.requests.into_iter().collect();
    artifacts.deps = folder.deps;
    artifacts.remove_imports = collector
        .imports
        .keys()
        .copied()
        .filter(|&symbol| {
            let references = scoping.get_resolved_references(symbol).count();
            let ref_uses = collector.found.values().filter(|&&s| s == symbol).count();
            references > 0 && ref_uses == references
        })
        .collect();
    artifacts
}

fn not_constant(reference: &StyleRef, reason: &str, declaration: Option<Span>) -> Diagnostic {
    let mut diagnostic = Diagnostic::new(
        Code::NonConstantStyleRef,
        reference.span,
        format!(
            "`${}` cannot be inlined into CSS: {reason}",
            reference.dotted()
        ),
    )
    .with_help(
        "`$` references are replaced at build time by constants: literals, template literals, arithmetic and `as const` objects. For a runtime value, set a custom property with the `style` prop (`style={{ \"--name\": value }}`) and read it with `var(--name)`.",
    );
    if let Some(declaration) = declaration {
        diagnostic = diagnostic.with_label(declaration, "declared here");
    }
    diagnostic
}

/// Strips the placeholders (`{ref}` children, `;ref;` statements) and the imports only `$`
/// references use from `program`.
pub fn strip_style_artifacts<'a>(
    ast: &Ast<'a>,
    program: &mut Program<'a>,
    blocks: &[StyleBlock],
    artifacts: &StyleArtifacts,
) {
    if blocks.is_empty() {
        return;
    }
    let block_spans: Vec<Span> = blocks
        .iter()
        .filter(|b| !matches!(b.placement, Placement::Expression))
        .map(|b| b.span)
        .collect();
    let mut stripper = Stripper {
        ast,
        blocks: &block_spans,
        remove_imports: &artifacts.remove_imports,
    };
    stripper.visit_program(program);
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
    roots: &'r HashMap<u32, (usize, &'r StyleRef)>,
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
