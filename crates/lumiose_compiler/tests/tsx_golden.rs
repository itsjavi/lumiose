//! TSX goldens (`@lumiose/stsx`, decision-86): each `tests/fixtures/tsx/<name>.stsx` compiles to
//! `<name>.tsx` (the TSX, then its diagnostics as comments) and `<name>.css`. Regenerate with
//! `UPDATE_GOLDEN=1 cargo test -p lumiose_compiler --test tsx_golden`.
//!
//! A first line `// @tsx <className|class> [attribute|class] [default|zero] [namespace]` sets the
//! class attribute and `scopedStyles`. Fixtures are compiled as `/src/<name>` with the root `/`.

mod support;

use std::fmt::Write as _;

use lumiose_compiler::{
    CssOptions, ScopeSpecificity, ScopeStrategy, ScopedStyles, TsxOptions, TsxResult,
};
use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

#[test]
fn tsx_goldens() {
    let files = support::fixtures("tsx");
    assert!(!files.is_empty());
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        // The `.tsx` goldens sit beside their sources.
        let Some(stem) = name.strip_suffix(".stsx") else {
            continue;
        };
        let source = std::fs::read_to_string(&path).unwrap();
        let result = compile(&name, &source);
        let mut output = result.code.clone();
        assert_parses_as_tsx(&name, &output);
        if !result.diagnostics.is_empty() {
            output.push_str("\n// --- diagnostics ---\n");
            for diagnostic in &result.diagnostics {
                writeln!(
                    output,
                    "// {} {} {}",
                    diagnostic.code,
                    diagnostic.severity.as_str(),
                    diagnostic.message
                )
                .unwrap();
            }
        }
        support::assert_golden(&path.with_file_name(format!("{stem}.tsx")), &output);
        let css_path = path.with_file_name(format!("{stem}.css"));
        if let Some(css) = &result.css {
            support::assert_golden(&css_path, css);
        }
    }
}

#[test]
fn source_map_points_at_the_stsx_source() {
    let source = "export function A() {\n  return (\n    <p class=\"a\">\n      <style>.a { color: red; }</style>\n      {label}\n    </p>\n  );\n}\n";
    let result = compile("map.stsx", &format!("// @tsx class\n{source}"));
    let map = oxc_sourcemap::SourceMap::from_json_string(result.map.as_deref().unwrap()).unwrap();
    assert_eq!(map.get_sources().collect::<Vec<_>>(), ["/src/map.stsx"]);
    // `{label}` sits two lines lower in the output (the import line and nothing else shift it).
    let line = result
        .code
        .lines()
        .position(|l| l.contains("{label}"))
        .unwrap() as u32;
    let column = result
        .code
        .lines()
        .nth(line as usize)
        .unwrap()
        .find("label")
        .unwrap() as u32;
    let lookup = map.generate_lookup_table();
    let token = map.lookup_token(&lookup, line, column).unwrap();
    // Line 6 of the fixture source (0-based 5), after the `// @tsx` header line.
    assert_eq!((token.get_src_line(), token.get_src_col()), (5, 7));
}

fn compile(name: &str, source: &str) -> TsxResult {
    let header = source
        .lines()
        .next()
        .and_then(|l| l.strip_prefix("// @tsx "));
    let mut parts = header.unwrap_or("className").split_whitespace();
    let class_attribute = parts.next().unwrap_or("className").to_owned();
    let strategy = match parts.next() {
        Some("class") => ScopeStrategy::Class,
        _ => ScopeStrategy::Attribute,
    };
    let specificity = match parts.next() {
        Some("zero") => ScopeSpecificity::Zero,
        _ => ScopeSpecificity::Default,
    };
    let options = TsxOptions {
        root: Some("/".to_owned()),
        class_attribute,
        style_import: Some(format!("/src/{name}.css")),
        css: CssOptions {
            scoped: ScopedStyles {
                strategy,
                specificity,
                namespace: parts.next().unwrap_or("lum").to_owned(),
            },
            ..CssOptions::default()
        },
        ..TsxOptions::default()
    };
    support::compile_tsx_with_modules(source, &format!("/src/{name}"), options)
}

fn assert_parses_as_tsx(name: &str, code: &str) {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, code, SourceType::tsx()).parse();
    assert!(
        parsed.diagnostics.is_empty() && !parsed.fatal_error,
        "{name}: output is not valid TSX: {:?}\n{code}",
        parsed.diagnostics
    );
}

#[test]
fn reports_value_exports() {
    let source = "// @tsx className\nexport type Props = { a: string };\nexport interface Other {}\nexport function loader() { return 1; }\nexport const meta = () => [], action = 2;\nconst Local = () => <p />;\nexport { Local as Card };\nexport default function Page() { return <p />; }\n";
    let result = compile("exports.stsx", source);
    assert_eq!(
        result.exports,
        ["Card", "action", "default", "loader", "meta"]
    );
}
