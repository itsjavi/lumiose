//! Source locations for the in-page inspector of `lumiose dev` (decision-59, TASK-341,
//! `CompileOptions::dev_source`):
//!
//! - every intrinsic element gets `data-lumiose-source="<file>:<line>:<column>"`, in client
//!   templates and in server HTML alike, so Alt+click opens any element's source, server-only
//!   markup included (the file is root-relative, or the module id outside the root);
//! - `$hot` receives each component's location (`hot.rs`);
//! - `const count = signal(…)` and `computed(…)` imported from `lumiose` become
//!   `$label(signal(…), "count")` (`lumiose/dom/hot`), which names them in the inspector.
//!
//! Lines and columns are 1-based; columns count characters.

use std::collections::HashSet;

use oxc_ast::ast::*;
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_span::GetSpan;

use crate::codegen::ast::Ast;

/// The attribute that carries an element's source location.
pub const SOURCE_ATTRIBUTE: &str = "data-lumiose-source";
/// The local name `$label` is imported under (footer of the module).
const LABEL: &str = "$$lumioseLabel";
/// `lumiose`'s reactive constructors whose results get labels.
const LABELLED: [&str; 2] = ["signal", "computed"];

/// A module's file label and line starts.
pub struct DevSource {
    file: String,
    /// Byte offsets of each line's start.
    lines: Vec<u32>,
}

impl DevSource {
    /// `filename` relative to `root` when inside it.
    pub fn new(source: &str, filename: &str, root: Option<&str>) -> Self {
        let file = root
            .and_then(|root| filename.strip_prefix(root.trim_end_matches('/')))
            .and_then(|rest| rest.strip_prefix('/'))
            .unwrap_or(filename)
            .to_owned();
        let mut lines = vec![0];
        lines.extend(
            source
                .match_indices('\n')
                .map(|(index, _)| index as u32 + 1),
        );
        Self { file, lines }
    }

    /// `<file>:<line>:<column>` of the byte `offset` of `source`.
    pub fn at(&self, source: &str, offset: u32) -> String {
        let line = self.lines.partition_point(|&start| start <= offset) - 1;
        let start = self.lines[line] as usize;
        let column = source
            .get(start..offset as usize)
            .map_or(0, |text| text.chars().count());
        format!("{}:{}:{}", self.file, line + 1, column + 1)
    }
}

/// Wraps the initializers of `const x = signal(…)` / `computed(…)` in `$label`; returns the import
/// to append when it wrapped any.
pub fn label_signals<'a>(ast: &Ast<'a>, program: &mut Program<'a>) -> Option<String> {
    let mut locals = HashSet::new();
    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        if import.source.value.as_str() != "lumiose" {
            continue;
        }
        for specifier in import.specifiers.iter().flatten() {
            if let ImportDeclarationSpecifier::ImportSpecifier(s) = specifier
                && LABELLED.contains(&s.imported.name().as_str())
            {
                locals.insert(s.local.name.to_string());
            }
        }
    }
    if locals.is_empty() {
        return None;
    }
    let mut labels = Labels {
        ast,
        locals,
        any: false,
    };
    labels.visit_program(program);
    labels
        .any
        .then(|| format!("\nimport {{ $label as {LABEL} }} from \"lumiose/dom/hot\";\n"))
}

struct Labels<'a, 'b> {
    ast: &'b Ast<'a>,
    locals: HashSet<String>,
    any: bool,
}

impl<'a> VisitMut<'a> for Labels<'a, '_> {
    fn visit_variable_declarator(&mut self, declarator: &mut VariableDeclarator<'a>) {
        walk_mut::walk_variable_declarator(self, declarator);
        let BindingPattern::BindingIdentifier(id) = &declarator.id else {
            return;
        };
        let Some(Expression::CallExpression(call)) = &declarator.init else {
            return;
        };
        if !matches!(&call.callee, Expression::Identifier(callee) if self.locals.contains(callee.name.as_str()))
        {
            return;
        }
        let name = id.name.to_string();
        let init = declarator.init.take().unwrap();
        let span = init.span();
        let label = self.ast.call(
            span,
            self.ast.ident(span, LABEL),
            [init, self.ast.string(span, &name)],
        );
        declarator.init = Some(label);
        self.any = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locates_offsets_by_line_and_character_column() {
        let source = "const a = 1;\n  <p>é<b/></p>\n";
        let dev = DevSource::new(source, "/repo/app/src/x.stsx", Some("/repo/app"));
        assert_eq!(dev.at(source, 0), "src/x.stsx:1:1");
        assert_eq!(dev.at(source, 15), "src/x.stsx:2:3");
        // `é` is two bytes, one column.
        let b = source.find("<b").unwrap() as u32;
        assert_eq!(dev.at(source, b), "src/x.stsx:2:7");
    }

    #[test]
    fn keeps_module_ids_outside_the_root() {
        let dev = DevSource::new("", "/repo/kit/src/Nav.stsx", Some("/repo/app/"));
        assert_eq!(dev.at("", 0), "/repo/kit/src/Nav.stsx:1:1");
        let dev = DevSource::new("", "/repo/app/src/Nav.stsx", Some("/repo/app/"));
        assert_eq!(dev.at("", 0), "src/Nav.stsx:1:1");
    }
}
