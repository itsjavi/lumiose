//! `lumiose_css` value warnings (LUM3017-3019, TASK-76/67) reach `compile()` diagnostics with
//! their spans (in `.stsx` coordinates), help and fix intact (TASK-81).

use lumiose_compiler::{CompileOptions, Severity, compile};

#[test]
fn css_value_warnings_convert_with_span_help_and_fix() {
    let source = r#"const gap = 8;
const angle = 45;
export function Card() {
  return <div class="card"><style>.card { color: notacolor; gap: $gap; rotate: $angle; margin: $gap px; }</style></div>;
}
"#;
    let options = CompileOptions {
        root: Some("/app".into()),
        ..CompileOptions::default()
    };
    let result = compile(source, "/app/src/Card.stsx", &options);
    let text = |start: u32, end: u32| &source[start as usize..end as usize];
    let found: Vec<_> = result
        .diagnostics
        .iter()
        .map(|d| {
            assert_eq!(d.severity, Severity::Warning, "{d:?}");
            assert!(d.help.is_some(), "{d:?}");
            let fix = d.fix.as_ref().map(|fix| {
                let edit = &fix.edits[0];
                (text(edit.span.start, edit.span.end), edit.text.as_str())
            });
            (d.code.id(), text(d.span.start, d.span.end), fix)
        })
        .collect();
    assert_eq!(
        found,
        [
            ("LUM3017", "notacolor", None),
            ("LUM3018", "$gap", Some(("$gap", "calc($gap * 1px)"))),
            ("LUM3018", "$angle", Some(("$angle", "calc($angle * 1deg)"))),
            ("LUM3019", "$gap px", Some(("$gap px", "calc($gap * 1px)"))),
        ]
    );
}
