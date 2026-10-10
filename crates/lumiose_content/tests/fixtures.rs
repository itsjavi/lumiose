//! Golden fixtures: every `tests/fixtures/<name>.md` or `.html` becomes `<name>.<ext>.out`: the
//! generated component source, then its scripts and frontmatter. Each source must also compile
//! without diagnostics for both targets (the compiled code belongs to `lumiose_compiler`). Run with
//! `UPDATE_FIXTURES=1` to rewrite the expectations.

use std::fmt::Write as _;
use std::path::Path;

use lumiose_compiler::{CompileOptions, Target, compile};
use lumiose_content::{Component, Script, html, markdown};

#[test]
fn fixtures() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let update = std::env::var_os("UPDATE_FIXTURES").is_some();
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .expect("fixtures directory")
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().into_string().ok()?;
            (name.ends_with(".md") || name.ends_with(".html")).then_some(name)
        })
        .collect();
    names.sort();
    assert!(!names.is_empty());
    let mut failures = Vec::new();
    for name in &names {
        let source = std::fs::read_to_string(dir.join(name)).unwrap();
        let component = if name.ends_with(".md") {
            markdown(&source, name)
        } else {
            html(&source, name)
        };
        for target in [Target::Client, Target::Server] {
            let result = compile(
                &component.source,
                &format!("/project/src/{name}.stsx"),
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
                failures.push(format!(
                    "{name} ({target:?}): {diagnostics:?}\n{}",
                    component.source
                ));
            }
        }
        let actual = golden(&component);
        let path = dir.join(format!("{name}.out"));
        if update {
            std::fs::write(&path, &actual).unwrap();
        } else if std::fs::read_to_string(&path).unwrap_or_default() != actual {
            failures.push(format!("--- {name}.out differs; actual:\n{actual}"));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

fn golden(component: &Component) -> String {
    let mut out = component.source.clone();
    for script in &component.scripts {
        match script {
            Script::Src(src) => {
                let _ = writeln!(out, "// script src: {src}");
            }
            Script::Inline(code) => {
                let _ = writeln!(out, "// script inline: {code:?}");
            }
        }
    }
    for diagnostic in &component.diagnostics {
        let _ = writeln!(
            out,
            "// {} at {:?}: {}",
            diagnostic.code, diagnostic.span, diagnostic.message
        );
    }
    if let Some(frontmatter) = &component.frontmatter {
        let _ = writeln!(out, "// frontmatter: {frontmatter:?}");
    }
    out
}
