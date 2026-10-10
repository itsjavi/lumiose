//! `component_source` must return an error, never panic, on truncated or malformed files: the
//! dev server runs it on every save.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;

use lumiose_svg::component_source;

/// Well-formed documents with odd content, which reach the id prefixing and the emitter.
const ODD: &[&str] = &[
    "<svg/>",
    "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    "<svg><path d='M x y L'/><path d=''/><path d='M0 0 A 0 0 0 1 1 1e400 -1e400'/></svg>",
    "<svg><style>@@@ {{ fill: </style><g class=''><rect style=';;:'/></g></svg>",
    "<svg><g transform='rotate(abc) scale()'><circle r='-1' fill='url(#)'/></g></svg>",
    "<svg viewBox='a b c'><use href='#missing'/><use href='#self' id='self'/></svg>",
    "<svg><defs><linearGradient id='g' href='#g'/></defs><rect fill='url(#g)' id='g'/></svg>",
    "<svg><text>  <![CDATA[ <b>&amp; ]]>  </text><title/><desc/></svg>",
    "<svg><foreignObject><div xmlns='http://www.w3.org/1999/xhtml'><script>x</script></div></foreignObject></svg>",
    "<svg width='1e999' height='-0' fill='rgb(300,-1,x)' stroke-width='NaN'><g><g><g/></g></g></svg>",
    "<svg id='a'><style>#a{fill:url(#a  url(\"#a  :is(:not(.x</style><g class='x' begin='.;a.;;' aria-owns=' '/></svg>",
    "<svg id='a' class='a'><style>((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((#a</style></svg>",
];

#[test]
fn odd_documents_never_panic() {
    let mut failures = Vec::new();
    for svg in ODD {
        if catch_unwind(AssertUnwindSafe(|| component_source(svg))).is_err() {
            failures.push((*svg).to_owned());
        }
    }
    assert!(failures.is_empty(), "panicked:\n{}", failures.join("\n"));
}

#[test]
fn truncated_files_never_panic() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut failures = Vec::new();
    for entry in std::fs::read_dir(dir).expect("fixtures directory") {
        let path = entry.expect("entry").path();
        if path.extension().is_none_or(|ext| ext != "svg") {
            continue;
        }
        let svg = std::fs::read_to_string(&path).expect("fixture");
        let ends = svg.char_indices().map(|(i, _)| i).chain([svg.len()]);
        for end in ends {
            let text = &svg[..end];
            if catch_unwind(AssertUnwindSafe(|| component_source(text))).is_err() {
                failures.push(format!("{} at {end}", path.display()));
            }
        }
    }
    assert!(failures.is_empty(), "panicked:\n{}", failures.join("\n"));
}
