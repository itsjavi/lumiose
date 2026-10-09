//! Files nested deeper than any document are an error (`LUM1009`), found before parsing: the HTML
//! tree builder and Markdown's block parser slow down quadratically with depth (TASK-169).

use std::time::Instant;

use lumen_compiler::{Code, Severity};
use lumen_content::{NESTED_TOO_DEEP, html, markdown};

#[test]
fn the_code_is_a_registered_error() {
    let code = Code::from_id(NESTED_TOO_DEEP).expect("registered");
    assert_eq!(code.info().default_severity, Severity::Error);
}

#[test]
fn deep_files_are_errors_and_fast() {
    let start = Instant::now();
    let cases = [
        (html(&"<div>".repeat(100_000), "a.html"), 512 * 5),
        (markdown(&format!("{} x", ">".repeat(100_000)), "a.md"), 0),
        (
            markdown(
                &format!("---\na: 1\n---\n{}", "<div>".repeat(100_000)),
                "a.md",
            ),
            13,
        ),
    ];
    for (component, at) in cases {
        let codes: Vec<_> = component
            .diagnostics
            .iter()
            .map(|d| (d.code, d.span.start))
            .collect();
        assert_eq!(codes, [(NESTED_TOO_DEEP, at)]);
        assert!(
            component
                .source
                .contains("export default function Content()")
        );
    }
    assert!(start.elapsed().as_secs() < 5, "{:?}", start.elapsed());
}

#[test]
fn ordinary_nesting_is_fine() {
    for component in [
        html(&"<li>a<p>b".repeat(20_000), "a.html"),
        html(
            &format!("{}x{}", "<div>".repeat(500), "</div>".repeat(500)),
            "a.html",
        ),
        markdown(&format!("{} x", "> ".repeat(100)), "a.md"),
    ] {
        assert!(
            component.diagnostics.is_empty(),
            "{:?}",
            component.diagnostics
        );
    }
}
