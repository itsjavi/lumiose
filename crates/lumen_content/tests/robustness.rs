//! `markdown` and `html` must never panic, on truncated files or odd input: the dev server runs
//! them on every save.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;

use lumen_content::{html, markdown};

const ODD: &[&str] = &[
    "",
    "<",
    "</div></div>",
    "<table><tr><td>a<td>b</table><p><li>x",
    "<svg><foreignObject><math><mi><style>x</style></svg><template><template><style>",
    "<html><head><script>a</script></head><body><body><html>",
    "<script src></script><script type=module></script><style global></style>",
    "<x.y a.b=1 @c=d :e=f [g]=h>",
    "---\n---\n---\n",
    "# \n## !!!\n###### #\n[^1]\n\n[^1]: \n",
    "| a |\n|---|\n| <style>",
    "<pre>\n\n</pre><textarea>\n</textarea>",
];

#[test]
fn odd_input_never_panics() {
    let mut failures = Vec::new();
    for source in ODD {
        if catch_unwind(AssertUnwindSafe(|| markdown(source, "a.md"))).is_err() {
            failures.push(format!("markdown: {source:?}"));
        }
        if catch_unwind(AssertUnwindSafe(|| html(source, "a.html"))).is_err() {
            failures.push(format!("html: {source:?}"));
        }
    }
    assert!(failures.is_empty(), "panicked:\n{}", failures.join("\n"));
}

#[test]
fn deep_nesting_never_overflows() {
    let deep = "<div>".repeat(20_000);
    let _ = html(&deep, "deep.html");
    let quotes = "> ".repeat(5_000);
    let _ = markdown(&quotes, "deep.md");
}

#[test]
fn truncated_files_never_panic() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut failures = Vec::new();
    for entry in std::fs::read_dir(dir).expect("fixtures directory") {
        let path = entry.expect("entry").path();
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if ext != "md" && ext != "html" {
            continue;
        }
        let source = std::fs::read_to_string(&path).expect("fixture");
        // Every few characters keeps the test quick in debug builds.
        let ends = source.char_indices().map(|(i, _)| i).step_by(3);
        for end in ends.chain([source.len()]) {
            let text = &source[..end];
            let run = || {
                if ext == "md" {
                    markdown(text, "a.md")
                } else {
                    html(text, "a.html")
                }
            };
            if catch_unwind(AssertUnwindSafe(run)).is_err() {
                failures.push(format!("{} at {end}", path.display()));
            }
        }
    }
    assert!(failures.is_empty(), "panicked:\n{}", failures.join("\n"));
}
