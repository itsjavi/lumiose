//! A Markdown module exports `headings` (decision-26 §3): `{ depth, text, id }` in document order,
//! with the ids of the rendered anchors.

use lumen_content::markdown;

/// The `headings` export of a file's module.
fn headings(source: &str) -> String {
    let module = markdown(source, "a.md").source;
    let start = module.find("export const headings = ").expect("a headings export");
    let end = start + module[start..].find("];").expect("the end of the array") + 2;
    module[start..end].to_owned()
}

#[test]
fn exports_the_headings_with_their_anchor_ids() {
    let source = "# Intro\n\nText\n\n## The `code`  and *more*\n\n<h3 id=\"custom\">Raw  <em>HTML</em></h3>\n\n#### !!!\n\nSetext\n------\n\n# Intro\n";
    assert_eq!(
        headings(source),
        "export const headings = [\n  \
         { depth: 1, text: \"Intro\", id: \"intro\" },\n  \
         { depth: 2, text: \"The code and more\", id: \"the-code--and-more\" },\n  \
         { depth: 3, text: \"Raw HTML\", id: \"custom\" },\n  \
         { depth: 2, text: \"Setext\", id: \"setext\" },\n  \
         { depth: 1, text: \"Intro\", id: \"intro-1\" }\n];"
    );
    // The same ids as the rendered anchors.
    let module = markdown(source, "a.md").source;
    for id in ["intro", "the-code--and-more", "custom", "setext", "intro-1"] {
        assert!(module.contains(&format!("id=\"{id}\"")), "{id}");
    }
}

#[test]
fn exports_an_empty_list_without_headings() {
    assert_eq!(headings("Just text.\n"), "export const headings = [];");
}
