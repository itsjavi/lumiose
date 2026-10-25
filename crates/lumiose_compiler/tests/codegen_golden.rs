//! Codegen goldens: each `tests/fixtures/client/<name>.{stsx,tsx}` compiles to `<name>.js` (client
//! target) and `<name>.server.js` (server target), each output followed by its diagnostics as
//! comments, plus `<name>.css` when the file has styles (the same for both targets). Regenerate
//! with `UPDATE_GOLDEN=1 cargo test -p lumiose_compiler --test codegen_golden`.
//!
//! Fixtures are compiled as `/src/<name>` with the root `/`; imported constants are read from
//! `tests/fixtures/client/modules` (`./tokens.ts` → `modules/tokens.ts`). Every output must parse
//! as a JavaScript module.
//!
//! One test compiles each fixture for both targets: the `.css` golden is shared, so a client and
//! a server test running in parallel would race on it in update mode (TASK-547).

mod support;

use std::fmt::Write as _;

use lumiose_compiler::{CompileOptions, CompileResult, Target};
use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

#[test]
fn codegen_goldens() {
    let files = support::fixtures("client");
    assert!(!files.is_empty());
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        let source = std::fs::read_to_string(&path).unwrap();
        let stem = name
            .rsplit_once('.')
            .map_or(name.as_str(), |(stem, _)| stem);
        let client = compile(&name, &source, Target::Client);
        let server = compile(&name, &source, Target::Server);
        support::assert_golden(&path.with_file_name(format!("{stem}.js")), &client.0);
        support::assert_golden(&path.with_file_name(format!("{stem}.server.js")), &server.0);
        assert_eq!(
            client.1, server.1,
            "{name}: server CSS differs from client CSS"
        );
        let css_path = path.with_file_name(format!("{stem}.css"));
        match &client.1 {
            Some(css) => support::assert_golden(&css_path, css),
            None if std::env::var_os("UPDATE_GOLDEN").is_some() && css_path.exists() => {
                std::fs::remove_file(&css_path).unwrap();
            }
            None => assert!(!css_path.exists(), "{name}: no CSS but {css_path:?} exists"),
        }
    }
}

/// Compiles a fixture for `target`: its golden output (code, then diagnostics as comments) and
/// its CSS.
fn compile(name: &str, source: &str, target: Target) -> (String, Option<String>) {
    let options = CompileOptions {
        target,
        root: Some("/".to_owned()),
        css: lumiose_compiler::CssOptions {
            scoped: scoped_styles(source),
            ..lumiose_compiler::CssOptions::default()
        },
        ..CompileOptions::default()
    };
    let CompileResult {
        code,
        css,
        diagnostics,
        ..
    } = support::compile_with_modules(source, &format!("/src/{name}"), options);
    assert!(!code.is_empty(), "{name}: no output");
    assert_parses_as_js(name, &code);
    let mut output = code;
    if !diagnostics.is_empty() {
        output.push_str("\n// --- diagnostics ---\n");
        for diagnostic in &diagnostics {
            let (line, column) = line_column(source, diagnostic.span.start);
            writeln!(
                output,
                "// {} {} {line}:{column} {}",
                diagnostic.code,
                diagnostic.severity.as_str(),
                diagnostic.message
            )
            .unwrap();
        }
    }
    (output, css)
}

/// A `// @scoped-styles <attribute|class> <default|zero> [namespace]` line (decision-85), else
/// the defaults.
fn scoped_styles(source: &str) -> lumiose_compiler::ScopedStyles {
    use lumiose_compiler::{ScopeSpecificity, ScopeStrategy, ScopedStyles};
    let Some(line) = source
        .lines()
        .find_map(|line| line.strip_prefix("// @scoped-styles "))
    else {
        return ScopedStyles::default();
    };
    let mut parts = line.split_whitespace();
    let strategy = match parts.next() {
        Some("class") => ScopeStrategy::Class,
        _ => ScopeStrategy::Attribute,
    };
    let specificity = match parts.next() {
        Some("zero") => ScopeSpecificity::Zero,
        _ => ScopeSpecificity::Default,
    };
    ScopedStyles {
        strategy,
        specificity,
        namespace: parts.next().unwrap_or("lum").to_owned(),
    }
}

fn assert_parses_as_js(name: &str, code: &str) {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, code, SourceType::mjs()).parse();
    assert!(
        parsed.diagnostics.is_empty() && !parsed.fatal_error,
        "{name}: output is not valid JS: {:?}\n{code}",
        parsed.diagnostics
    );
}

fn line_column(source: &str, offset: u32) -> (usize, usize) {
    let before = &source[..offset as usize];
    let line = before.matches('\n').count() + 1;
    let column = before.rsplit('\n').next().map_or(0, |l| l.chars().count()) + 1;
    (line, column)
}
