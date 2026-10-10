//! `LUM3013`: a top-level block references a top-level binding declared after it.
//!
//! Top-level masked references are `;name;` statements, so TypeScript reports them as
//! used before declaration. The check parses the masked text with OXC (exact top-level
//! bindings, including destructuring) and only runs when a top-level block has references.
//! Only lexical bindings (`const`, `let`, `using`, `class`) have this ordering hazard.

use oxc_allocator::Allocator;
use oxc_ast::ast::{BindingPattern, Declaration, Statement, VariableDeclarationKind};
use oxc_parser::Parser;
use oxc_span::SourceType;

use super::{Placement, StyleBlock};
use crate::diagnostics::{Code, Diagnostic};
use crate::span::Span;

pub(super) fn check_ref_order(
    masked: &str,
    blocks: &[StyleBlock],
    diagnostics: &mut Vec<Diagnostic>,
) {
    let has_top_level_refs = blocks
        .iter()
        .any(|block| block.placement == Placement::TopLevel && !block.refs.is_empty());
    if !has_top_level_refs {
        return;
    }
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, masked, SourceType::tsx()).parse();
    if parsed.fatal_error {
        return;
    }
    let mut bindings: Vec<(&str, Span)> = Vec::new();
    for statement in &parsed.program.body {
        let declaration = match statement {
            Statement::ExportDeclaration(export) => &export.declaration,
            _ => match statement.as_declaration() {
                Some(declaration) => declaration,
                None => continue,
            },
        };
        collect_lexical_bindings(declaration, &mut bindings);
    }
    for block in blocks
        .iter()
        .filter(|block| block.placement == Placement::TopLevel)
    {
        for reference in &block.refs {
            let root = reference.path[0].as_str();
            let Some(&(_, declared)) = bindings.iter().find(|(name, _)| *name == root) else {
                continue;
            };
            if declared.start < reference.span.start {
                continue;
            }
            diagnostics.push(
                Diagnostic::new(
                    Code::StyleRefBeforeDeclaration,
                    reference.span,
                    format!("`${root}` is used before its declaration"),
                )
                .with_label(declared, "declared here")
                .with_help(
                    "Move the `<style>` block below the declaration. Top-level blocks conventionally go at the end of the file.",
                ),
            );
        }
    }
}

fn collect_lexical_bindings<'a>(
    declaration: &Declaration<'a>,
    bindings: &mut Vec<(&'a str, Span)>,
) {
    match declaration {
        Declaration::VariableDeclaration(variables)
            if variables.kind != VariableDeclarationKind::Var =>
        {
            for declarator in &variables.declarations {
                push_pattern(&declarator.id, bindings);
            }
        }
        Declaration::ClassDeclaration(class) => {
            if let Some(id) = &class.id {
                bindings.push((id.name.as_str(), id.span.into()));
            }
        }
        _ => {}
    }
}

fn push_pattern<'a>(pattern: &BindingPattern<'a>, bindings: &mut Vec<(&'a str, Span)>) {
    for id in pattern.get_binding_identifiers() {
        bindings.push((id.name.as_str(), id.span.into()));
    }
}
