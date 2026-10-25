//! Shared checks for scanner tests: the masking invariant in both offset spaces and an OXC
//! parse of the masked TSX.

#![allow(dead_code)]

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use lumiose_compiler::scanner::{AttributeValue, Placement, ScanResult};
use lumiose_compiler::{
    CompileOptions, CompileResult, HostModule, ResolvedModule, Span, TsxOptions, TsxResult,
    Utf16Index, compile, compile_tsx,
};
use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

pub fn fixtures(dir: &str) -> Vec<PathBuf> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(dir);
    let mut files: Vec<PathBuf> = std::fs::read_dir(&root)
        .unwrap_or_else(|error| panic!("{}: {error}", root.display()))
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            matches!(
                path.extension().and_then(|e| e.to_str()),
                Some("stsx" | "tsx")
            )
        })
        .collect();
    files.sort();
    files
}

/// Compiles `source` like a host would: module requests are answered from
/// `tests/fixtures/client/modules` (ids `/src/<path>`), and the file is compiled again until
/// nothing is missing.
pub fn compile_with_modules(source: &str, id: &str, mut options: CompileOptions) -> CompileResult {
    let modules_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/client/modules");
    for _ in 0..8 {
        let result = compile(source, id, &options);
        if result.module_requests.is_empty() {
            return result;
        }
        for request in result.module_requests {
            let resolved = resolve(&request.importer, &request.specifier).and_then(|path| {
                let file = modules_dir.join(path.trim_start_matches("/src/"));
                std::fs::read_to_string(file)
                    .ok()
                    .map(|source| ResolvedModule { id: path, source })
            });
            options.modules.push(HostModule {
                importer: request.importer,
                specifier: request.specifier,
                resolved,
            });
        }
    }
    panic!("{id}: module requests did not settle");
}

/// [`compile_with_modules`] for [`compile_tsx`].
pub fn compile_tsx_with_modules(source: &str, id: &str, mut options: TsxOptions) -> TsxResult {
    let modules_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/client/modules");
    for _ in 0..8 {
        let result = compile_tsx(source, id, &options);
        if result.module_requests.is_empty() {
            return result;
        }
        for request in result.module_requests {
            let resolved = resolve(&request.importer, &request.specifier).and_then(|path| {
                let file = modules_dir.join(path.trim_start_matches("/src/"));
                std::fs::read_to_string(file)
                    .ok()
                    .map(|source| ResolvedModule { id: path, source })
            });
            options.modules.push(HostModule {
                importer: request.importer,
                specifier: request.specifier,
                resolved,
            });
        }
    }
    panic!("{id}: module requests did not settle");
}

/// Resolves a relative specifier against an importer id (`/src/a/b.ts` + `../c.ts`).
fn resolve(importer: &str, specifier: &str) -> Option<String> {
    if !specifier.starts_with('.') {
        return None;
    }
    let mut segments: Vec<&str> = importer.split('/').collect();
    segments.pop();
    for segment in specifier.split('/') {
        match segment {
            "." => {}
            ".." => {
                segments.pop();
            }
            segment => segments.push(segment),
        }
    }
    Some(segments.join("/"))
}

/// Parse errors of `text` as TSX, rendered for assertion messages.
pub fn parse_errors(text: &str) -> Vec<String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, text, SourceType::tsx()).parse();
    let mut errors: Vec<String> = parsed
        .diagnostics
        .iter()
        .map(|error| format!("{error:?}"))
        .collect();
    if parsed.fatal_error && errors.is_empty() {
        errors.push("fatal parse error".to_owned());
    }
    errors
}

const LINE_TERMINATORS: [char; 4] = ['\n', '\r', '\u{2028}', '\u{2029}'];

/// The masking invariant: same length, same line terminators, identical outside blocks,
/// in UTF-8 bytes and in UTF-16 code units.
pub fn check_invariants(source: &str, result: &ScanResult) {
    let masked = result.masked();
    assert_eq!(masked.len(), source.len(), "UTF-8 length changed");
    let spans: Vec<Span> = result.blocks.iter().map(|block| block.span).collect();

    let (src_bytes, masked_bytes) = (source.as_bytes(), masked.as_bytes());
    for (offset, (&a, &b)) in src_bytes.iter().zip(masked_bytes).enumerate() {
        let inside = spans.iter().any(|span| span.contains(offset as u32));
        if !inside {
            assert_eq!(a, b, "UTF-8 byte {offset} changed outside blocks");
        }
        assert_eq!(
            matches!(a, b'\n' | b'\r'),
            matches!(b, b'\n' | b'\r'),
            "line break moved at byte {offset}"
        );
    }

    let src16: Vec<u16> = source.encode_utf16().collect();
    let masked16 = result.masked_utf16(source);
    assert_eq!(masked16.len(), src16.len(), "UTF-16 length changed");
    let index = Utf16Index::new(source);
    let spans16: Vec<Span> = spans
        .iter()
        .map(|span| span.map(&|o| index.to_utf16(o)))
        .collect();
    for (offset, (&a, &b)) in src16.iter().zip(&masked16).enumerate() {
        let inside = spans16.iter().any(|span| span.contains(offset as u32));
        if !inside {
            assert_eq!(a, b, "UTF-16 unit {offset} changed outside blocks");
        }
        let is_break = |unit: u16| {
            char::from_u32(u32::from(unit)).is_some_and(|c| LINE_TERMINATORS.contains(&c))
        };
        assert_eq!(
            is_break(a),
            is_break(b),
            "line break moved at UTF-16 unit {offset}"
        );
    }

    // Both views describe the same text once decoded, except for the padding of
    // multi-unit characters inside blocks.
    let decoded16 = String::from_utf16(&masked16).expect("masked UTF-16 is valid");
    assert_eq!(decoded16.lines().count(), masked.lines().count());
    if source.is_ascii() {
        assert_eq!(decoded16, masked);
    }
}

pub fn assert_masked_parses(name: &str, source: &str, result: &ScanResult) {
    let errors = parse_errors(result.masked());
    assert!(
        errors.is_empty(),
        "{name}: masked UTF-8 TSX does not parse:\n{}\n---\n{}",
        errors.join("\n"),
        result.masked()
    );
    let decoded16 = String::from_utf16(&result.masked_utf16(source)).unwrap();
    let errors = parse_errors(&decoded16);
    assert!(
        errors.is_empty(),
        "{name}: masked UTF-16 TSX does not parse:\n{}",
        errors.join("\n")
    );
}

fn line_col(source: &str, offset: u32) -> String {
    let before = &source[..offset as usize];
    let line = before.matches('\n').count() + 1;
    let col = before.rsplit('\n').next().map_or(0, |l| l.chars().count()) + 1;
    format!("{line}:{col}")
}

fn snippet(source: &str, span: Span) -> String {
    let text: String = span.source_text(source).chars().take(40).collect();
    format!("{text:?}")
}

/// A stable, readable rendering of the scan result for golden files.
pub fn summary(source: &str, result: &ScanResult) -> String {
    let mut out = String::new();
    writeln!(out, "kind: {:?}", result.kind).unwrap();
    for (index, block) in result.blocks.iter().enumerate() {
        let placement = match &block.placement {
            Placement::TopLevel => "top-level".to_owned(),
            Placement::Expression => "expression".to_owned(),
            Placement::InJsx { parent } => format!("jsx {:?} <{}>", parent.kind, parent.name),
        };
        let mut flags = String::new();
        if block.global {
            flags.push_str(" global");
        }
        if block.svg {
            flags.push_str(" svg");
        }
        if block.close_tag.is_none() {
            flags.push_str(" unclosed");
        }
        writeln!(
            out,
            "block {index}: {placement}{flags} at {} span={}..{} content={}..{}",
            line_col(source, block.span.start),
            block.span.start,
            block.span.end,
            block.content.start,
            block.content.end,
        )
        .unwrap();
        for attribute in &block.attributes {
            let value = match attribute.value {
                None => String::new(),
                Some(AttributeValue::String { span }) => {
                    format!(" = string {}", snippet(source, span))
                }
                Some(AttributeValue::Expression { span }) => {
                    format!(" = expression {}", snippet(source, span))
                }
            };
            writeln!(out, "  attribute {}{value}", attribute.name).unwrap();
        }
        for reference in &block.refs {
            let close = reference.close.map_or("-".to_owned(), |c| format!("{c}"));
            writeln!(
                out,
                "  ref ${} at {} span={}..{} close={close}",
                reference.dotted(),
                line_col(source, reference.span.start),
                reference.span.start,
                reference.span.end,
            )
            .unwrap();
        }
    }
    for diagnostic in &result.diagnostics {
        writeln!(
            out,
            "{} {} at {} {}: {}",
            diagnostic.code,
            diagnostic.severity.as_str(),
            line_col(source, diagnostic.span.start),
            snippet(source, diagnostic.span),
            diagnostic.message,
        )
        .unwrap();
        for label in &diagnostic.labels {
            writeln!(
                out,
                "  label at {} {}: {}",
                line_col(source, label.span.start),
                snippet(source, label.span),
                label.message
            )
            .unwrap();
        }
        if let Some(help) = &diagnostic.help {
            writeln!(out, "  help: {help}").unwrap();
        }
        if let Some(fix) = &diagnostic.fix {
            for edit in &fix.edits {
                writeln!(
                    out,
                    "  fix: {} ({} -> {:?})",
                    fix.message,
                    snippet(source, edit.span),
                    edit.text
                )
                .unwrap();
            }
        }
    }
    out
}

/// Compares `actual` with the golden file, or rewrites it when `UPDATE_GOLDEN` is set.
pub fn assert_golden(path: &Path, actual: &str) {
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(path, actual).unwrap();
        return;
    }
    let expected = std::fs::read_to_string(path).unwrap_or_else(|_| {
        panic!(
            "missing golden {} (run with UPDATE_GOLDEN=1)",
            path.display()
        )
    });
    assert!(
        expected == actual,
        "golden mismatch: {}\n--- expected\n{expected}\n--- actual\n{actual}",
        path.display()
    );
}
