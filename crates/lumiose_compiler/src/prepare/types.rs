//! TypeScript stripping with OXC's transformer (TypeScript preset only; JSX is preserved for the
//! Lumiose codegen and no syntax is lowered).

use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_semantic::Scoping;
use oxc_transformer::{JsxOptions, TransformOptions, Transformer};

use crate::diagnostics::{Code, Diagnostic};

/// A JSX pragma name that never matches a user binding, so the TypeScript preset does not keep
/// a `React` import alive just because the file contains JSX.
const NO_PRAGMA: &str = "__lumiose_no_jsx_pragma__";

/// Removes types (annotations, interfaces, type-only imports and exports) and lowers TypeScript
/// runtime syntax (enums, namespaces, parameter properties). Unused value imports are elided as
/// TypeScript does without `verbatimModuleSyntax`.
pub fn strip_types<'a>(
    allocator: &'a Allocator,
    program: &mut Program<'a>,
    scoping: Scoping,
    filename: &str,
) -> Vec<Diagnostic> {
    if !program.source_type.is_typescript() {
        return Vec::new();
    }
    let mut options = TransformOptions {
        jsx: JsxOptions::disable(),
        ..TransformOptions::default()
    };
    options.typescript.jsx_pragma = NO_PRAGMA.into();
    options.typescript.jsx_pragma_frag = NO_PRAGMA.into();
    let result = Transformer::new(allocator, Path::new(filename), &options)
        .build_with_scoping(scoping, program);
    result
        .diagnostics
        .into_vec()
        .into_iter()
        .map(|d| super::from_oxc(Code::Unsupported, &d))
        .collect()
}
