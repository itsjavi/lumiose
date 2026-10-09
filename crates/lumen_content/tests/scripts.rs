//! `<script>` is not supported in Markdown (decision-22): each one is a `LUM1008` error at its
//! start tag, and is left out of the markup. `.html` files keep their scripts.

use lumen_compiler::{Code, Severity};
use lumen_content::{SCRIPT_IN_MARKDOWN, html, markdown};

/// The source text at each diagnostic's span.
fn reported(source: &str) -> Vec<(usize, &str)> {
    markdown(source, "a.md")
        .diagnostics
        .iter()
        .map(|d| (d.span.start, &source[d.span.clone()]))
        .collect()
}

#[test]
fn the_code_is_a_registered_error() {
    let code = Code::from_id(SCRIPT_IN_MARKDOWN).expect("registered");
    assert_eq!(code.info().default_severity, Severity::Error);
}

#[test]
fn reports_each_script_at_its_tag() {
    let source = "---\ntitle: A\n---\n# A\n\n<script>a()</script>\n\nText <SCRIPT src=x.js></SCRIPT> and more.\n\n> <div>\n> <script type=\"application/ld+json\">{}</script>\n";
    let found = reported(source);
    assert_eq!(found.len(), 3, "{found:?}");
    assert_eq!(found[0], (source.find("<script>").unwrap(), "<script"));
    assert_eq!(found[1], (source.find("<SCRIPT src").unwrap(), "<SCRIPT"));
    assert_eq!(found[2], (source.find("<script type").unwrap(), "<script"));
    let component = markdown(source, "a.md");
    assert!(component.scripts.is_empty());
    assert!(
        !component.source.to_lowercase().contains("script"),
        "{}",
        component.source
    );
}

#[test]
fn ignores_code_comments_and_lookalikes() {
    let source = "`<script>`\n\n```html\n<script></script>\n```\n\n    <script>\n\n<!-- <script> -->\n\n<scripts></scripts>\n";
    assert!(reported(source).is_empty(), "{:?}", reported(source));
}

#[test]
fn finds_the_second_script_on_a_line() {
    let source = "<p><script>a</script> x <script>b</script></p>\n";
    let found = reported(source);
    assert_eq!(found.len(), 2, "{found:?}");
    assert_eq!(found[1].0, source.rfind("<script>").unwrap());
}

#[test]
fn html_files_keep_their_scripts() {
    let component = html("<p>x</p><script>a()</script>", "a.html");
    assert!(component.diagnostics.is_empty());
    assert_eq!(component.scripts.len(), 1);
}
