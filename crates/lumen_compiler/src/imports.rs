//! The module's imports (static, re-exports and literal dynamic imports), for hosts that walk
//! module graphs without bundling: `lumen check`'s LUM4003 check of client graphs (TASK-116).

use oxc_ast::ast::{Expression, ImportExpression, ModuleDeclaration, Program, StringLiteral};
use oxc_ast_visit::{Visit, walk};

use crate::span::Span;

/// An import of the module, after TypeScript stripping (type-only imports are gone).
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ImportMeta {
    pub specifier: String,
    /// The specifier as written, without its quotes.
    pub span: Span,
    /// `import("…")`.
    pub dynamic: bool,
}

/// The imports of `program`, in source order.
pub fn imports(program: &Program<'_>) -> Vec<ImportMeta> {
    let mut collector = Collector(Vec::new());
    collector.visit_program(program);
    collector.0.sort_by_key(|import| import.span.start);
    collector.0
}

struct Collector(Vec<ImportMeta>);

impl Collector {
    fn push(&mut self, source: &StringLiteral<'_>, dynamic: bool) {
        // Synthetic literals (no source text) have empty spans.
        if source.span.end < source.span.start + 2 {
            return;
        }
        self.0.push(ImportMeta {
            specifier: source.value.to_string(),
            span: Span::new(source.span.start + 1, source.span.end - 1),
            dynamic,
        });
    }
}

impl<'a> Visit<'a> for Collector {
    fn visit_module_declaration(&mut self, it: &ModuleDeclaration<'a>) {
        match it {
            ModuleDeclaration::ImportDeclaration(import) => self.push(&import.source, false),
            ModuleDeclaration::ExportAllDeclaration(export) => self.push(&export.source, false),
            ModuleDeclaration::ExportFromDeclaration(export) => self.push(&export.source, false),
            _ => {}
        }
        walk::walk_module_declaration(self, it);
    }

    fn visit_import_expression(&mut self, it: &ImportExpression<'a>) {
        if let Expression::StringLiteral(source) = &it.source {
            self.push(source, true);
        }
        walk::walk_import_expression(self, it);
    }
}
