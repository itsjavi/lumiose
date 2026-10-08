//! `process` must never panic: the language server and `lumen dev` run it on every keystroke,
//! so truncated and malformed CSS has to come back as diagnostics. Every block of every
//! fixture is cut at each character and mutated with stray punctuation, with its `$refs`
//! resolved to numbers and strings so that the substitution paths run too.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;

use lumen_css::{
    CssBlock, CssInput, CssOptions, ElementInventory, RefValue, ResolvedRef, Scope, Span,
    find_refs, process,
};

/// Malformed snippets on top of the fixtures.
const SNIPPETS: &[&str] = &[
    ".oops { color: ; }",
    ".a { color:; width: $w px; margin: calc($w + ) }",
    ".a { width: $w",
    ".a { --x: $w; color: rgb( }",
    ".a { grid-template-columns: repeat(auto-fit, minmax(1rem, 1fr)) 1fr",
    ".a { animation: spin $w; } @keyframes spin { from { rotate: $w } }",
    ".a { font: $w/1.5 serif !important; color: red ! important; top: 1px !imp }",
    "@media (width > $w px) { .b { gap: $w } }",
    ".a { & .b { @media print { color: nope; width: $w } } }",
    "@font-face { font-weight: 100 900; src: url( }",
    ".a { width: min(100%, $w) max( ; height: clamp($w, ",
    ".a { content: \"é $w ü\"; width: $w émoji; }",
    ".a { transform: translateX($w) rotate($w) }",
    ".a { background: linear-gradient($w in oklch, red, blue) }",
];

/// Characters inserted at each position of each snippet.
const INSERTS: &[&str] = &[
    ";", "}", "{", "(", ")", "!", "$w", "\"", ":", "/*", "\\", " px", "é",
];

fn run(css: &str, scope: &Scope) -> Result<(), String> {
    let blocks = [CssBlock {
        content: Span::new(0, css.len() as u32),
        scope: scope.clone(),
        svg: false,
    }];
    let refs: Vec<ResolvedRef> = find_refs(css)
        .into_iter()
        .filter(|site| site.hyphenated.is_none())
        .enumerate()
        .map(|(i, site)| ResolvedRef {
            span: Span::new(site.range.start as u32, site.range.end as u32),
            value: match i % 3 {
                0 => RefValue::Number(8.0),
                1 => RefValue::String("8".into()),
                _ => RefValue::String("1rem".into()),
            },
        })
        .collect();
    let inventories = [ElementInventory {
        token: "t".into(),
        tags: ["div".to_owned()].into(),
        ..ElementInventory::default()
    }];
    catch_unwind(AssertUnwindSafe(|| {
        process(
            &CssInput {
                filename: "fuzz.stsx",
                source: css,
                blocks: &blocks,
                refs: &refs,
                inventories: &inventories,
                ..CssInput::default()
            },
            &CssOptions {
                source_map: true,
                ..CssOptions::default()
            },
        )
    }))
    .map(|_| ())
    .map_err(|_| format!("{css:?}"))
}

/// The CSS of every `<style>` block in the fixtures.
fn fixture_blocks() -> Vec<String> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut blocks = Vec::new();
    for entry in std::fs::read_dir(dir).expect("fixtures directory") {
        let path = entry.expect("entry").path();
        if path.extension().is_none_or(|ext| ext != "stsx") {
            continue;
        }
        let source = std::fs::read_to_string(&path).expect("fixture");
        let mut rest = source.as_str();
        while let Some(open) = rest.find("<style") {
            let Some(tag_end) = rest[open..].find('>') else {
                break;
            };
            let body = &rest[open + tag_end + 1..];
            let Some(close) = body.find("</style>") else {
                break;
            };
            blocks.push(body[..close].to_owned());
            rest = &body[close..];
        }
    }
    blocks
}

fn boundaries(text: &str) -> impl Iterator<Item = usize> + '_ {
    text.char_indices()
        .map(|(i, _)| i)
        .chain(std::iter::once(text.len()))
}

#[test]
fn truncated_blocks_never_panic() {
    let scope = Scope::Component {
        name: "Card".into(),
        token: "t".into(),
    };
    let mut inputs: Vec<String> = fixture_blocks();
    inputs.extend(SNIPPETS.iter().map(|s| (*s).to_owned()));
    let mut failures = Vec::new();
    for input in &inputs {
        for end in boundaries(input) {
            if let Err(css) = run(&input[..end], &scope) {
                failures.push(css);
            }
        }
    }
    assert!(failures.is_empty(), "panicked on:\n{}", failures.join("\n"));
}

#[test]
fn mutated_snippets_never_panic() {
    let scopes = [
        Scope::Global { component: None },
        Scope::Subtree {
            name: "Card".into(),
            token: "t".into(),
            outer: vec!["o".into()],
            element: "p".into(),
        },
    ];
    let mut failures = Vec::new();
    for snippet in SNIPPETS {
        for at in boundaries(snippet) {
            for insert in INSERTS {
                let css = format!("{}{insert}{}", &snippet[..at], &snippet[at..]);
                for scope in &scopes {
                    if let Err(css) = run(&css, scope) {
                        failures.push(css);
                    }
                }
            }
        }
    }
    assert!(failures.is_empty(), "panicked on:\n{}", failures.join("\n"));
}
