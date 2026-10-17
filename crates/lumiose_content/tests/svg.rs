//! Inline SVG in an HTML or Markdown import (TASK-474, L14 of the pre-release review).

use lumiose_content::html;

/// A page reads an inline SVG's `<style>` as markup: decoded `<` and `&` must not reach it raw.
#[test]
fn escapes_markup_characters_in_svg_style_text() {
    let source = html(
        "<svg><style>.a{font-family:\"&lt;img src=x onerror=alert(1)&gt;\"} .b{content:\"&amp;lt;\"} .c{content:\"&lt;/style&gt;\"}</style><path class=\"a b c\"/></svg>",
        "a.html",
    )
    .source;
    let style = &source[source.find("<style").unwrap()..source.find("</style>").unwrap()];
    assert!(!style[1..].contains('<') && !style.contains('&'), "{style}");
    assert!(
        style.contains(r"\3c img") && style.contains(r"\26 lt;") && style.contains(r"\3c /style>"),
        "{style}"
    );
}
