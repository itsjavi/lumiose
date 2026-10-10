//! Golden fixtures: every `tests/fixtures/<name>.stsx` is processed and compared with
//! `<name>.out` (CSS, diagnostics and a readable source map). Run with `UPDATE_FIXTURES=1`
//! to rewrite the expectations.
//!
//! Fixture header lines (`// @…`) configure the run:
//! - `// @ref radius.lg = "8px"` / `// @ref gap = 4`: a resolved `$` constant;
//! - `// @inventory <file|Component> tags=a,b classes=c component-classes=d ids=e dynamic=classes`;
//! - `// @style-prop --name`: a custom property set in a JSX `style` prop;
//! - `// @minify`, `// @sourcemap`, `// @targets <browserslist query>`;
//! - `// @crlf`: run on the source with CRLF line endings.
//!
//! Blocks are found with a small heuristic instead of the compiler's scanner: a `<style>` at
//! column 0 is top-level, an indented one belongs to the last `function Name` above it, and
//! one after an unclosed `<svg` is an SVG block.
#![cfg(feature = "browserslist")]

use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;
use std::path::Path;

use lumiose_css::{
    CssBlock, CssInput, CssOptions, CustomPropertySet, ElementInventory, RefValue, ResolvedRef,
    Scope, Span, browserslist_targets, find_refs, process, scope_token,
};
use parcel_sourcemap::SourceMap;

#[test]
fn fixtures() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let update = std::env::var_os("UPDATE_FIXTURES").is_some();
    let mut names: Vec<_> = std::fs::read_dir(&dir)
        .expect("fixtures directory")
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()? != "stsx" {
                return None;
            }
            Some(path.file_stem()?.to_str()?.to_owned())
        })
        .collect();
    names.sort();
    assert!(!names.is_empty());
    let mut failures = Vec::new();
    for name in &names {
        let mut source = std::fs::read_to_string(dir.join(format!("{name}.stsx"))).unwrap();
        if source.lines().any(|line| line == "// @crlf") {
            source = source.replace('\n', "\r\n");
        }
        let actual = run(name, &source);
        let expected_path = dir.join(format!("{name}.out"));
        if update {
            std::fs::write(&expected_path, &actual).unwrap();
            continue;
        }
        let expected = std::fs::read_to_string(&expected_path).unwrap_or_default();
        if expected != actual {
            failures.push(format!(
                "--- {name}.out (expected)\n{expected}\n+++ actual\n{actual}"
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

fn run(name: &str, source: &str) -> String {
    let path = format!("src/{name}.stsx");
    let header = Header::parse(source);
    let blocks = find_blocks(source, &path);
    let refs: Vec<ResolvedRef> = blocks
        .iter()
        .filter(|block| !block.svg)
        .flat_map(|block| {
            let start = block.content.start as usize;
            find_refs(&source[block.content.range()])
                .into_iter()
                .filter(|site| site.hyphenated.is_none())
                .filter_map(|site| {
                    let value = header.refs.get(&site.path.join("."))?.clone();
                    let span = Span::new(
                        (start + site.range.start) as u32,
                        (start + site.range.end) as u32,
                    );
                    Some(ResolvedRef { span, value })
                })
                .collect::<Vec<_>>()
        })
        .collect();
    let inventories: Vec<ElementInventory> = header
        .inventories
        .iter()
        .map(|(scope, inventory)| ElementInventory {
            token: scope_token(&path, (scope != "file").then_some(scope.as_str())),
            ..inventory.clone()
        })
        .collect();
    let input = CssInput {
        filename: &format!("/project/{path}"),
        source,
        blocks: &blocks,
        refs: &refs,
        inventories: &inventories,
        custom_properties_set: &header.style_props,
    };
    let output = process(&input, &header.options);

    let mut out = String::new();
    writeln!(out, "=== css").unwrap();
    out.push_str(&output.css);
    if !output.css.ends_with('\n') {
        out.push('\n');
    }
    if !output.diagnostics.is_empty() {
        writeln!(out, "=== diagnostics").unwrap();
    }
    for d in &output.diagnostics {
        let snippet = &source[d.span.range()];
        writeln!(
            out,
            "{} {} {}..{} `{snippet}`: {}",
            d.code,
            d.severity.as_str(),
            d.span.start,
            d.span.end,
            d.message
        )
        .unwrap();
        for label in &d.labels {
            let snippet = &source[label.span.range()];
            writeln!(out, "  label `{snippet}`: {}", label.message).unwrap();
        }
        if let Some(help) = &d.help {
            writeln!(out, "  help: {help}").unwrap();
        }
        if let Some(fix) = &d.fix {
            for edit in &fix.edits {
                let snippet = &source[edit.span.range()];
                writeln!(
                    out,
                    "  fix: {} (`{snippet}` → `{}`)",
                    fix.message, edit.text
                )
                .unwrap();
            }
        }
    }
    if !output.custom_properties_read.is_empty() {
        writeln!(out, "=== var() reads").unwrap();
        writeln!(out, "{}", output.custom_properties_read.join(" ")).unwrap();
    }
    if let Some(map) = &output.map {
        writeln!(out, "=== map").unwrap();
        out.push_str(&describe_map(map, &output.css, input.filename, source));
    }
    out
}

/// One line per mapping: generated position and text → original position and text.
fn describe_map(json: &str, css: &str, filename: &str, source: &str) -> String {
    let map = SourceMap::from_json("", json).expect("valid source map");
    assert_eq!(
        map.get_sources(),
        &vec![filename.trim_start_matches('/').to_owned()]
    );
    assert_eq!(map.get_sources_content(), &vec![source.to_owned()]);
    assert!(json.contains(&format!("\"sources\":[\"{filename}\"]")));
    let css_lines: Vec<&str> = css.split('\n').collect();
    let source_lines: Vec<&str> = source.split('\n').collect();
    let excerpt = |lines: &[&str], line: u32, column: u32| -> String {
        let text = lines.get(line as usize).copied().unwrap_or("");
        let start: usize = text
            .char_indices()
            .scan(0u32, |utf16, (offset, ch)| {
                let here = *utf16;
                *utf16 += ch.len_utf16() as u32;
                Some((offset, here))
            })
            .find(|&(_, utf16)| utf16 >= column)
            .map_or(text.len(), |(offset, _)| offset);
        text[start..]
            .chars()
            .take(24)
            .collect::<String>()
            .trim_end()
            .to_owned()
    };
    let mut out = String::new();
    for mapping in map.get_mappings() {
        let original = mapping
            .original
            .expect("every mapping has an original position");
        writeln!(
            out,
            "{}:{} `{}` → {}:{} `{}`",
            mapping.generated_line + 1,
            mapping.generated_column,
            excerpt(&css_lines, mapping.generated_line, mapping.generated_column),
            original.original_line + 1,
            original.original_column,
            excerpt(
                &source_lines,
                original.original_line,
                original.original_column
            ),
        )
        .unwrap();
    }
    out
}

#[derive(Default)]
struct Header {
    refs: HashMap<String, RefValue>,
    inventories: Vec<(String, ElementInventory)>,
    style_props: Vec<CustomPropertySet>,
    options: CssOptions,
}

impl Header {
    fn parse(source: &str) -> Self {
        let mut header = Self::default();
        let mut offset = 0;
        for line in source.split_inclusive('\n') {
            let start = offset;
            offset += line.len();
            let Some(directive) = line.trim_end().strip_prefix("// @") else {
                continue;
            };
            let (key, rest) = directive.split_once(' ').unwrap_or((directive, ""));
            match key {
                "ref" => {
                    let (path, value) = rest.split_once(" = ").expect("`@ref path = value`");
                    let value = match value.strip_prefix('"') {
                        Some(text) => RefValue::String(
                            text.strip_suffix('"')
                                .expect("a closing quote")
                                .replace("\\\"", "\""),
                        ),
                        None => RefValue::Number(value.parse().expect("a number")),
                    };
                    header.refs.insert(path.to_owned(), value);
                }
                "inventory" => {
                    let mut parts = rest.split_whitespace();
                    let scope = parts.next().expect("`@inventory <scope> …`").to_owned();
                    let mut inventory = ElementInventory::default();
                    for part in parts {
                        let (field, values) = part.split_once('=').expect("`field=a,b`");
                        let set: HashSet<String> = values
                            .split(',')
                            .filter(|v| !v.is_empty())
                            .map(String::from)
                            .collect();
                        match field {
                            "tags" => inventory.tags = set,
                            "classes" => inventory.classes = set,
                            "component-classes" => inventory.component_classes = set,
                            "ids" => inventory.ids = set,
                            "dynamic" => {
                                inventory.dynamic_tags = set.contains("tags");
                                inventory.dynamic_classes = set.contains("classes");
                                inventory.dynamic_ids = set.contains("ids");
                            }
                            _ => panic!("unknown inventory field `{field}`"),
                        }
                    }
                    header.inventories.push((scope, inventory));
                }
                "style-prop" => {
                    let name_start = start + line.find("--").expect("`@style-prop --name`");
                    header.style_props.push(CustomPropertySet {
                        name: rest.to_owned(),
                        span: Span::new(name_start as u32, (name_start + rest.len()) as u32),
                    });
                }
                "minify" => header.options.minify = true,
                "crlf" => {}
                "sourcemap" => header.options.source_map = true,
                "targets" => {
                    header.options.targets = browserslist_targets(&[rest]).expect("valid query");
                }
                _ => panic!("unknown fixture directive `{key}`"),
            }
        }
        header
    }
}

fn find_blocks(source: &str, path: &str) -> Vec<CssBlock> {
    let mut blocks = Vec::new();
    let mut search = 0;
    while let Some(found) = source[search..].find("<style") {
        let open = search + found;
        let after = open + "<style".len();
        search = after;
        if !source[after..].starts_with([' ', '>', '\n']) {
            continue;
        }
        let line_start = source[..open].rfind('\n').map_or(0, |i| i + 1);
        if source[line_start..].starts_with("//") {
            continue;
        }
        let tag_end = after + source[after..].find('>').expect("closed tag") + 1;
        let global = source[after..tag_end].contains("global");
        let close = tag_end + source[tag_end..].find("</style>").expect("closed block");
        let component = (open > line_start).then(|| {
            let before = &source[..open];
            let at = before
                .rfind("function ")
                .expect("a component function above");
            before[at + "function ".len()..]
                .split(|c: char| !c.is_alphanumeric())
                .next()
                .unwrap()
                .to_owned()
        });
        let svg = source[..open]
            .rfind("<svg")
            .is_some_and(|at| !source[at..open].contains("</svg>"));
        let scope = match (global, component) {
            (true, component) => Scope::Global { component },
            (false, Some(name)) => Scope::Component {
                token: scope_token(path, Some(&name)),
                name,
            },
            (false, None) => Scope::File {
                token: scope_token(path, None),
            },
        };
        blocks.push(CssBlock {
            content: Span::new(tag_end as u32, close as u32),
            scope,
            svg,
        });
        search = close;
    }
    blocks
}
