//! Invalid-value warnings (`LUM3017`–`LUM3019`) over corpora of declarations, one per line:
//! every line of `values/valid.txt` must produce none of them (including the valid CSS the
//! pinned Lightning CSS keeps as raw tokens), every line of `values/invalid.txt` exactly one.

use lumiose_css::{CssBlock, CssCode, CssInput, CssOptions, Scope, Span, process};

const VALUE_CODES: [CssCode; 3] = [
    CssCode::InvalidCssValue,
    CssCode::UnitlessStyleRef,
    CssCode::DetachedUnit,
];

/// The value warnings for `declaration` in a style rule, as `LUM30xx message` lines.
fn warnings(declaration: &str) -> Vec<String> {
    let source = format!(".a {{ {declaration} }}");
    let blocks = [CssBlock {
        content: Span::new(0, source.len() as u32),
        scope: Scope::Global { component: None },
        svg: false,
    }];
    let output = process(
        &CssInput {
            filename: "values.stsx",
            source: &source,
            blocks: &blocks,
            ..CssInput::default()
        },
        &CssOptions::default(),
    );
    output
        .diagnostics
        .iter()
        .filter(|d| VALUE_CODES.contains(&d.code))
        .map(|d| format!("{} {}", d.code, d.message))
        .collect()
}

fn corpus(name: &str) -> impl Iterator<Item = &'static str> {
    let text = match name {
        "valid" => include_str!("values/valid.txt"),
        "invalid" => include_str!("values/invalid.txt"),
        _ => unreachable!(),
    };
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
}

#[test]
fn valid_values_produce_no_warning() {
    let failures: Vec<String> = corpus("valid")
        .flat_map(|line| {
            warnings(line)
                .into_iter()
                .map(move |warning| format!("{line}\n    {warning}"))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn invalid_values_produce_one_warning() {
    let failures: Vec<String> = corpus("invalid")
        .filter_map(|line| {
            let warnings = warnings(line);
            (warnings.len() != 1).then(|| format!("{line}\n    {warnings:?}"))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
