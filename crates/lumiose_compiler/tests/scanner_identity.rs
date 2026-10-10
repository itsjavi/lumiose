//! The golden identity test (spec §4.1): masking style-free TSX is the identity.
//!
//! The corpus lives in `tests/fixtures/identity/`. Each file is also scanned with a
//! top-level block appended, which forces the full lexer over the whole file: the prefix
//! must stay byte-identical and the lexer must end at the top level (the block is found as
//! a top-level block with no diagnostics).

mod support;

use lumiose_compiler::scanner::{FileKind, Placement, scan_kind};

const TRAILING_BLOCK: &str = "\n<style>\n  .x { color: $accent; }\n</style>\n";

#[test]
fn style_free_tsx_masks_to_itself() {
    let files = support::fixtures("identity");
    assert!(files.len() >= 8, "the identity corpus is too small");
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        let source = std::fs::read_to_string(&path).unwrap();
        let errors = support::parse_errors(&source);
        assert!(
            errors.is_empty(),
            "{name}: corpus file is not valid TSX:\n{}",
            errors.join("\n")
        );

        for kind in [FileKind::Stsx, FileKind::Tsx] {
            let result = scan_kind(&source, kind);
            assert!(
                result.blocks.is_empty(),
                "{name} ({kind:?}): found blocks {:?}",
                result.blocks
            );
            assert!(
                result.diagnostics.is_empty(),
                "{name} ({kind:?}): {:?}",
                result.diagnostics
            );
            assert_eq!(
                result.masked(),
                source,
                "{name} ({kind:?}): not the identity"
            );
            assert_eq!(
                result.masked_utf16(&source),
                source.encode_utf16().collect::<Vec<_>>()
            );
        }

        let extended = format!("{source}{TRAILING_BLOCK}");
        let result = scan_kind(&extended, FileKind::Stsx);
        assert_eq!(
            result.blocks.len(),
            1,
            "{name}: expected only the trailing block, got {:#?}",
            result.blocks
        );
        let block = &result.blocks[0];
        assert_eq!(
            block.placement,
            Placement::TopLevel,
            "{name}: lexer did not end at the top level"
        );
        assert_eq!(block.span.start as usize, source.len() + 1, "{name}");
        assert!(
            result.diagnostics.is_empty(),
            "{name}: {:?}",
            result.diagnostics
        );
        assert_eq!(
            &result.masked()[..source.len()],
            source,
            "{name}: prefix changed"
        );
        support::check_invariants(&extended, &result);
        support::assert_masked_parses(&name, &extended, &result);
    }
}

/// Opt-in robustness check over real-world TSX:
/// `LUMIOSE_SCAN_CORPUS=/path/to/dir cargo test -p lumiose_compiler --test scanner_identity -- --ignored`.
/// Files that do not parse as TSX are skipped.
#[test]
#[ignore = "needs LUMIOSE_SCAN_CORPUS"]
fn external_corpus() {
    let root = std::env::var("LUMIOSE_SCAN_CORPUS").expect("set LUMIOSE_SCAN_CORPUS");
    let mut stack = vec![std::path::PathBuf::from(root)];
    let (mut checked, mut failures) = (0usize, Vec::new());
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
            let path = entry.path();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            if path.is_dir() {
                if !matches!(
                    name,
                    ".git" | "node_modules" | "dist" | "build" | ".next" | "target"
                ) {
                    stack.push(path);
                }
                continue;
            }
            if !name.ends_with(".tsx") {
                continue;
            }
            let Ok(source) = std::fs::read_to_string(&path) else {
                continue;
            };
            if source.contains("<style") || !support::parse_errors(&source).is_empty() {
                continue;
            }
            checked += 1;
            let extended = format!("{source}{TRAILING_BLOCK}");
            let result = scan_kind(&extended, FileKind::Stsx);
            let problem =
                if result.blocks.len() != 1 || result.blocks[0].placement != Placement::TopLevel {
                    let found: Vec<_> = result
                        .blocks
                        .iter()
                        .map(|b| (b.span.start, &b.placement))
                        .collect();
                    Some(format!("blocks {found:?}"))
                } else if !result.diagnostics.is_empty() {
                    Some(format!("diagnostics {:?}", result.diagnostics))
                } else if result.masked()[..source.len()] != source {
                    Some("prefix changed".to_owned())
                } else {
                    support::parse_errors(result.masked()).first().cloned()
                };
            if let Some(problem) = problem {
                failures.push(format!("{}: {problem}", path.display()));
            }
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {checked} files failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
    eprintln!("checked {checked} files");
}
