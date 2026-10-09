//! `$` constants are inserted as CSS text inside one value (TASK-169): text that could end the
//! declaration, the rule or the `<style>` is an error (`LUM3021`) and is not inserted.

use lumen_css::{
    CssBlock, CssInput, CssOptions, RefValue, ResolvedRef, Scope, Span, find_refs, process,
};

/// The CSS and the diagnostic codes of `.a { color: $c; }` with `$c` = `value`.
fn compile(value: &str) -> (String, Vec<String>) {
    let css = ".a { color: $c; }";
    let blocks = [CssBlock {
        content: Span::new(0, u32::try_from(css.len()).unwrap()),
        scope: Scope::File { token: "t".into() },
        svg: false,
    }];
    let refs: Vec<ResolvedRef> = find_refs(css)
        .into_iter()
        .map(|site| ResolvedRef {
            span: Span::new(site.range.start as u32, site.range.end as u32),
            value: RefValue::String(value.to_owned()),
        })
        .collect();
    let output = process(
        &CssInput {
            filename: "a.stsx",
            source: css,
            blocks: &blocks,
            refs: &refs,
            ..CssInput::default()
        },
        &CssOptions::default(),
    );
    let codes = output
        .diagnostics
        .iter()
        .map(|d| d.code.to_string())
        .collect();
    (output.css, codes)
}

#[test]
fn rejects_values_that_break_out() {
    for value in [
        "red;} body{background:url(//evil.example/x)} .x{color:red",
        "red</style><script>alert(1)</script>",
        "red/*</style><img src=x onerror=alert(1)>*/",
        "\"</style><img src=x onerror=alert(1)>\"",
        "red; color: blue",
        "\"unterminated",
        "red /* a comment",
        "red\\",
    ] {
        let (css, codes) = compile(value);
        assert!(codes.contains(&"LUM3021".to_owned()), "{value}: {codes:?}");
        for absent in ["evil", "script", "img", "blue", "unterminated", "comment"] {
            assert!(!css.contains(absent), "{value}: {css}");
        }
    }
}

#[test]
fn accepts_values_with_strings_and_functions() {
    for value in [
        "red",
        "1px solid rgb(0 0 0 / 50%)",
        "\"a;b{c}\"",
        "'it''s'",
        "url(\"x.png\")",
        "var(--x, \"}\")",
        "\\31 0px",
    ] {
        let (_, codes) = compile(value);
        assert!(!codes.contains(&"LUM3021".to_owned()), "{value}: {codes:?}");
    }
}
