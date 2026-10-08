//! Golden fixtures: every `tests/fixtures/<name>.svg` becomes `<name>.out`, the generated
//! component source. Each source must also compile without diagnostics for both targets (the
//! compiled code is not golden: it belongs to `lumen_compiler`). Run with `UPDATE_FIXTURES=1` to
//! rewrite the expectations.
//!
//! Options come from comments in the fixture: `<!-- @no-optimize -->`, `<!-- @current-color -->`.

use std::path::Path;

use lumen_compiler::{CompileOptions, Target, compile};
use lumen_svg::{SvgOptions, component_source};

#[test]
fn fixtures() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let update = std::env::var_os("UPDATE_FIXTURES").is_some();
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .expect("fixtures directory")
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            (path.extension()? == "svg").then(|| path.file_stem()?.to_str().map(String::from))?
        })
        .collect();
    names.sort();
    assert!(!names.is_empty());
    let mut failures = Vec::new();
    for name in &names {
        let svg = std::fs::read_to_string(dir.join(format!("{name}.svg"))).unwrap();
        let options = SvgOptions {
            optimize: !svg.contains("<!-- @no-optimize -->"),
            current_color: svg.contains("<!-- @current-color -->"),
        };
        let source = component_source(&svg, &options).unwrap_or_else(|e| panic!("{name}: {e}"));
        for target in [Target::Client, Target::Server] {
            let result = compile(
                &source,
                &format!("/project/src/{name}.svg.stsx"),
                &CompileOptions {
                    target,
                    source_map: false,
                    ..CompileOptions::default()
                },
            );
            let diagnostics: Vec<String> = result
                .diagnostics
                .iter()
                .map(|d| format!("{} {}", d.code.id(), d.message))
                .collect();
            if !diagnostics.is_empty() || result.code.is_empty() {
                failures.push(format!("{name} ({target:?}): {diagnostics:?}\n{source}"));
            }
        }
        let path = dir.join(format!("{name}.out"));
        if update {
            std::fs::write(&path, &source).unwrap();
        } else if std::fs::read_to_string(&path).unwrap_or_default() != source {
            failures.push(format!("--- {name}.out differs; actual:\n{source}"));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
