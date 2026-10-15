//! `lumiose_css::process` (TASK-312): the CSS of one `<style>` block, with its `$name` references
//! resolved, under each scope, minified or not, with a source map or not. It must never panic:
//! the language server and `lumiose dev` run it on every keystroke. The first byte picks the
//! scope and the options.
#![no_main]

use libfuzzer_sys::fuzz_target;
use lumiose_css::{
    CssBlock, CssInput, CssOptions, ElementInventory, RefValue, ResolvedRef, Scope, Span,
    find_refs, process,
};

fuzz_target!(|data: &[u8]| {
    let Some((&flags, rest)) = data.split_first() else {
        return;
    };
    let Ok(css) = std::str::from_utf8(rest) else {
        return;
    };
    let scope = match flags % 4 {
        0 => Scope::Global { component: None },
        1 => Scope::File { token: "f".into() },
        2 => Scope::Component {
            name: "Card".into(),
            token: "t".into(),
        },
        _ => Scope::Subtree {
            name: "Card".into(),
            token: "t".into(),
            outer: vec!["o".into()],
            element: "p".into(),
        },
    };
    let blocks = [CssBlock {
        content: Span::new(0, css.len() as u32),
        scope,
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
    let _ = process(
        &CssInput {
            filename: "fuzz.stsx",
            source: css,
            blocks: &blocks,
            refs: &refs,
            inventories: &inventories,
            ..CssInput::default()
        },
        &CssOptions {
            minify: flags & 4 != 0,
            source_map: flags & 8 != 0,
            ..CssOptions::default()
        },
    );
});
