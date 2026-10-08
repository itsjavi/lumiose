//! Client codegen goldens: each `tests/fixtures/client/<name>.{stsx,tsx}` compiles to
//! `<name>.js` (the client output followed by its diagnostics as comments). Regenerate with
//! `UPDATE_GOLDEN=1 cargo test -p lumen_compiler --test client_golden`.
//!
//! A fixture may start with `// @scope file=data-l-f1 Counter=data-l-c1` to provide the scope
//! tokens the CSS pipeline would compute. Every output must parse as a JavaScript module.

mod support;

use std::fmt::Write as _;

use lumen_compiler::{CompileOptions, ScopeTokens, compile};
use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

#[test]
fn client_goldens() {
    let files = support::fixtures("client");
    assert!(!files.is_empty());
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        let source = std::fs::read_to_string(&path).unwrap();
        let options = CompileOptions {
            scope_tokens: scope_tokens(&source),
            ..CompileOptions::default()
        };
        let id = format!("/src/{name}");
        let result = compile(&source, &id, &options);
        assert!(!result.code.is_empty(), "{name}: no output");
        assert_parses_as_js(&name, &result.code);
        let mut output = result.code.clone();
        if !result.diagnostics.is_empty() {
            output.push_str("\n// --- diagnostics ---\n");
            for diagnostic in &result.diagnostics {
                let (line, column) = line_column(&source, diagnostic.span.start);
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
        let stem = name
            .rsplit_once('.')
            .map_or(name.as_str(), |(stem, _)| stem);
        support::assert_golden(&path.with_file_name(format!("{stem}.js")), &output);
    }
}

fn scope_tokens(source: &str) -> ScopeTokens {
    let mut tokens = ScopeTokens::default();
    let Some(header) = source
        .lines()
        .next()
        .and_then(|line| line.strip_prefix("// @scope "))
    else {
        return tokens;
    };
    for entry in header.split_whitespace() {
        let (scope, token) = entry.split_once('=').expect("scope=token");
        if scope == "file" {
            tokens.file = Some(token.to_owned());
        } else {
            tokens.components.insert(scope.to_owned(), token.to_owned());
        }
    }
    tokens
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
