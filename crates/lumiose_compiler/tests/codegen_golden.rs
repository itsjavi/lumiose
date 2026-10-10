//! Codegen goldens: each `tests/fixtures/client/<name>.{stsx,tsx}` compiles to `<name>.js` (client
//! target) and `<name>.server.js` (server target), each output followed by its diagnostics as
//! comments, plus `<name>.css` when the file has styles (the same for both targets). Regenerate
//! with `UPDATE_GOLDEN=1 cargo test -p lumiose_compiler --test codegen_golden`.
//!
//! Fixtures are compiled as `/src/<name>` with the root `/`; imported constants are read from
//! `tests/fixtures/client/modules` (`./tokens.ts` → `modules/tokens.ts`). Every output must parse
//! as a JavaScript module.

mod support;

use std::fmt::Write as _;

use lumiose_compiler::{CompileOptions, Target};
use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

#[test]
fn client_goldens() {
    goldens(Target::Client, "js");
}

#[test]
fn server_goldens() {
    goldens(Target::Server, "server.js");
}

fn goldens(target: Target, extension: &str) {
    let files = support::fixtures("client");
    assert!(!files.is_empty());
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        let source = std::fs::read_to_string(&path).unwrap();
        let options = CompileOptions {
            target,
            root: Some("/".to_owned()),
            ..CompileOptions::default()
        };
        let id = format!("/src/{name}");
        let result = support::compile_with_modules(&source, &id, options);
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
        support::assert_golden(&path.with_file_name(format!("{stem}.{extension}")), &output);
        let css_path = path.with_file_name(format!("{stem}.css"));
        match &result.css {
            Some(css) if target == Target::Client => support::assert_golden(&css_path, css),
            Some(css) => assert_eq!(
                Some(css.as_str()),
                std::fs::read_to_string(&css_path).ok().as_deref(),
                "{name}: server CSS differs from client CSS"
            ),
            None => assert!(!css_path.exists(), "{name}: no CSS but {css_path:?} exists"),
        }
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
