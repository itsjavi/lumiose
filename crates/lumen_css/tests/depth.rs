//! Deep nesting is an error, never a stack overflow (TASK-169): blocks, functions, selectors and
//! unclosed blocks at depth 100 000, and the deepest nesting allowed still compiles.

use lumen_css::{CssBlock, CssInput, CssOptions, Scope, Span, process};

/// The diagnostics of one block, as `code message`.
fn diagnostics(css: &str) -> Vec<String> {
    let blocks = [CssBlock {
        content: Span::new(0, u32::try_from(css.len()).unwrap()),
        scope: Scope::File { token: "t".into() },
        svg: false,
    }];
    let output = process(
        &CssInput {
            filename: "deep.stsx",
            source: css,
            blocks: &blocks,
            ..CssInput::default()
        },
        &CssOptions::default(),
    );
    output
        .diagnostics
        .iter()
        .map(|d| format!("{} {}", d.code, d.message))
        .collect()
}

const TOO_DEEP: &str =
    "LUM3014 blocks are nested deeper than 64 levels, or parentheses deeper than 16";

#[test]
fn deep_nesting_is_an_error() {
    let n = 100_000;
    for css in [
        format!("{}color:red{}", ".a{".repeat(n), "}".repeat(n)),
        ".a{color:red;".repeat(n),
        format!(".a{{width:{}1px{}}}", "calc(".repeat(n), ")".repeat(n)),
        format!("{}.a{}{{color:red}}", ":is(".repeat(n), ")".repeat(n)),
        format!(
            "@media {}screen{} {{ .a {{ color: red }} }}",
            "(".repeat(n),
            ")".repeat(n)
        ),
    ] {
        assert_eq!(diagnostics(&css), [TOO_DEEP], "{}", &css[..40]);
    }
}

#[test]
fn the_deepest_nesting_allowed_compiles() {
    // Lightning CSS recurses per level: in debug builds it needs more than a test thread's
    // 2 MB of stack at the limits (release builds need a fraction).
    let ok = std::thread::Builder::new()
        .stack_size(64 << 20)
        .spawn(|| {
            let blocks = diagnostics(&format!("{}color:red{}", ".a{".repeat(64), "}".repeat(64)));
            let calc = diagnostics(&format!(
                ".a{{width:{}1px{}}}",
                "calc(".repeat(16),
                ")".repeat(16)
            ));
            (blocks, calc)
        })
        .unwrap()
        .join()
        .unwrap();
    assert!(
        !ok.0.iter().any(|d| d.contains("nested deeper")),
        "{:?}",
        ok.0
    );
    assert!(
        !ok.1.iter().any(|d| d.contains("nested deeper")),
        "{:?}",
        ok.1
    );
}
