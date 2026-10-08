//! `compile()` API behaviour beyond the codegen goldens: targets, syntax errors, metadata,
//! source maps, style reference resolution, constant folding with host modules and CSS output.

use lumen_compiler::prepare::StyleRefBindingKind;
use lumen_compiler::{
    Code, CompileOptions, ConstValue, HostModule, ModuleRequest, ResolvedModule, Target, compile,
};
use oxc_sourcemap::SourceMap;

const COUNTER: &str = r#"import { signal } from "lumen";
import { radius } from "./tokens.ts";
const gap = 4;
export async function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);
  await Promise.resolve();
  return (
    <button onClick={() => count.update((c) => c + 1)}>
      {count()}
      <style>button { border-radius: $radius.lg; margin: $gap; }</style>
    </button>
  );
}
"#;

#[test]
fn server_target_imports_lumen_server() {
    let options = CompileOptions {
        target: Target::Server,
        ..CompileOptions::default()
    };
    let result = compile(COUNTER, "/src/Counter.stsx", &options);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    assert!(result.code.contains(r#"from "lumen/server""#));
    assert!(!result.code.contains("lumen/dom"));
    assert!(!result.code.contains("onClick") && !result.code.contains("delegateEvents"));
    assert_eq!(
        result.meta.runtime_helpers,
        ["ssr", "insert", "$await", "$leave", "$async"]
    );
    assert!(result.meta.delegated_events.is_empty());
    assert_eq!(result.meta.templates, 1);
}

#[test]
fn syntax_errors_use_lum1001_with_spans() {
    let source = "export const A = () => <div>;\n";
    let result = compile(source, "/src/a.tsx", &CompileOptions::default());
    let diagnostic = result
        .diagnostics
        .iter()
        .find(|d| d.code == Code::SyntaxError)
        .expect("a syntax error");
    assert!(diagnostic.span.end as usize <= source.len());
}

#[test]
fn metadata_lists_components_await_sites_and_style_refs() {
    let result = compile(COUNTER, "/src/Counter.stsx", &CompileOptions::default());
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let component = &result.meta.components[0];
    assert_eq!(component.name, "Counter");
    assert!(component.exported && component.is_async);
    assert_eq!(component.await_sites.len(), 1);
    assert_eq!(
        component.await_sites[0].source_text(COUNTER),
        "await Promise.resolve()"
    );
    assert_eq!(result.meta.delegated_events, ["click"]);
    assert!(result.meta.has_styles);

    let refs = &result.meta.style_refs;
    assert_eq!(refs.len(), 2);
    let radius = refs[0].binding.as_ref().expect("resolved");
    assert_eq!(
        radius.kind,
        StyleRefBindingKind::Import {
            source: "./tokens.ts".to_owned(),
            imported: "radius".to_owned()
        }
    );
    let gap = refs[1].binding.as_ref().expect("resolved");
    assert_eq!(gap.kind, StyleRefBindingKind::Module { constant: true });
    assert_eq!(gap.declaration.source_text(COUNTER), "gap");
    // `radius` is only used by the CSS: its import is dropped from the JS.
    assert!(!result.code.contains("./tokens.ts"), "{}", result.code);
    assert!(result.code.contains("const gap = 4"));
}

#[test]
fn source_map_points_at_the_original_source() {
    let result = compile(COUNTER, "/src/Counter.stsx", &CompileOptions::default());
    let json = result.map.expect("a source map");
    let map = SourceMap::from_json_string(&json).expect("valid JSON");
    assert_eq!(map.get_sources().collect::<Vec<_>>(), ["/src/Counter.stsx"]);
    assert_eq!(map.get_source_contents().next().flatten(), Some(COUNTER));

    let table = map.generate_lookup_table();
    let (line, column) = position(&result.code, "count.update");
    let token = map
        .lookup_token(&table, line, column)
        .expect("a mapping for the handler");
    let (src_line, src_column) = position(COUNTER, "count.update");
    assert_eq!(
        (token.get_src_line(), token.get_src_col()),
        (src_line, src_column)
    );
}

#[test]
fn source_maps_are_optional() {
    let options = CompileOptions {
        source_map: false,
        ..CompileOptions::default()
    };
    assert!(
        compile(COUNTER, "/src/Counter.stsx", &options)
            .map
            .is_none()
    );
}

#[test]
fn plain_typescript_modules_are_stripped() {
    let source = "export const n: number = 1;\nexport type T = string;\n";
    let result = compile(source, "/src/n.ts", &CompileOptions::default());
    assert_eq!(result.code, "export const n = 1;\n");
}

/// 0-based line and UTF-16 column of the first occurrence of `needle`.
fn position(text: &str, needle: &str) -> (u32, u32) {
    let offset = text.find(needle).expect("needle");
    let before = &text[..offset];
    let line = before.matches('\n').count() as u32;
    let column = before
        .rsplit('\n')
        .next()
        .map_or(0, |l| l.encode_utf16().count()) as u32;
    (line, column)
}

#[test]
fn islands_are_reported_with_root_relative_refs() {
    let source = r#"import { TeamPanel } from "../components/Team.stsx";
export function Page() {
  return <main><TeamPanel client:visible ids={[]} /></main>;
}
"#;
    for target in [Target::Client, Target::Server] {
        let options = CompileOptions {
            target,
            root: Some("/app/".into()),
            ..CompileOptions::default()
        };
        let result = compile(source, "/app/src/routes/index.stsx", &options);
        assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
        let island = &result.meta.islands[0];
        assert_eq!(island.reference, "/src/components/Team.stsx#TeamPanel");
        assert_eq!(island.module, "/src/components/Team.stsx");
        assert_eq!(island.export, "TeamPanel");
        assert_eq!(island.strategy, "visible");
        assert_eq!(island.span.source_text(source), "TeamPanel");
        assert_eq!(
            result
                .code
                .contains(r#"island("/src/components/Team.stsx#TeamPanel""#),
            target == Target::Server
        );
    }
}

fn tokens_module(source: &str) -> HostModule {
    HostModule {
        importer: "/src/Counter.stsx".into(),
        specifier: "./tokens.ts".into(),
        resolved: Some(ResolvedModule {
            id: "/src/tokens.ts".into(),
            source: source.into(),
        }),
    }
}

#[test]
fn imported_constants_are_requested_from_the_host() {
    let first = compile(COUNTER, "/src/Counter.stsx", &CompileOptions::default());
    assert_eq!(
        first.module_requests,
        [ModuleRequest {
            importer: "/src/Counter.stsx".into(),
            specifier: "./tokens.ts".into(),
        }]
    );
    // Incomplete: no CSS and no diagnostics for the pending reference.
    assert!(first.css.is_none());
    assert!(first.diagnostics.is_empty(), "{:?}", first.diagnostics);

    let options = CompileOptions {
        modules: vec![tokens_module(
            "import { unit } from './unit.ts';\nexport const radius = { lg: `${unit * 3}px` } as const;\n",
        )],
        ..CompileOptions::default()
    };
    // `radius` reads another module: requested with the host module as importer.
    let second = compile(COUNTER, "/src/Counter.stsx", &options);
    assert_eq!(
        second.module_requests,
        [ModuleRequest {
            importer: "/src/tokens.ts".into(),
            specifier: "./unit.ts".into(),
        }]
    );
    let mut options = options;
    options.modules.push(HostModule {
        importer: "/src/tokens.ts".into(),
        specifier: "./unit.ts".into(),
        resolved: Some(ResolvedModule {
            id: "/src/unit.ts".into(),
            source: "export const unit = 4;".into(),
        }),
    });
    let third = compile(COUNTER, "/src/Counter.stsx", &options);
    assert!(third.module_requests.is_empty());
    assert!(third.diagnostics.is_empty(), "{:?}", third.diagnostics);
    assert_eq!(third.css_deps, ["/src/tokens.ts", "/src/unit.ts"]);
    let css = third.css.expect("css");
    assert!(
        css.contains("border-radius: 12px") && css.contains("margin: 4"),
        "{css}"
    );
    assert_eq!(
        third.meta.style_refs[0].value,
        Some(ConstValue::String("12px".into()))
    );
}

#[test]
fn unresolvable_and_non_constant_imports_are_lum3008() {
    let mut options = CompileOptions {
        modules: vec![HostModule {
            resolved: None,
            ..tokens_module("")
        }],
        ..CompileOptions::default()
    };
    let result = compile(COUNTER, "/src/Counter.stsx", &options);
    let diagnostic = &result.diagnostics[0];
    assert_eq!(diagnostic.code, Code::NonConstantStyleRef);
    assert_eq!(diagnostic.span.source_text(COUNTER), "$radius.lg");
    assert!(diagnostic.message.contains("could not be resolved"));
    assert!(result.css.is_some());

    options.modules = vec![tokens_module(
        "export let radius = { lg: 1 };\nradius = { lg: 2 };",
    )];
    let result = compile(COUNTER, "/src/Counter.stsx", &options);
    assert_eq!(result.diagnostics[0].code, Code::NonConstantStyleRef);
    assert!(
        result.diagnostics[0]
            .message
            .contains("`radius` is a `let` binding")
    );
}

#[test]
fn scope_tokens_hash_the_root_relative_path() {
    let source = r#"export function Card() {
  return <article class="card"><style>.card { color: red; }</style></article>;
}
<style>article { margin: 0; }</style>
"#;
    let options = CompileOptions {
        root: Some("/app".into()),
        ..CompileOptions::default()
    };
    let result = compile(source, "/app/src/Card.stsx", &options);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let file = lumen_css::scope_token("src/Card.stsx", None);
    let card = lumen_css::scope_token("src/Card.stsx", Some("Card"));
    assert!(
        result
            .code
            .contains(&format!("<article class=card data-l-{file} data-l-{card}>")),
        "{}",
        result.code
    );
    let css = result.css.expect("css");
    assert!(css.contains(&format!("article[data-l-{file}]")), "{css}");
    assert!(css.contains(&format!(".card[data-l-{card}]")), "{css}");
    // File scope first, then component blocks.
    assert!(css.find("article[").unwrap() < css.find(".card[").unwrap());
}

#[test]
fn css_source_map_points_into_the_stsx() {
    let source = "export const A = () => <p class=\"x\">é<style>\n  .x {\n    color: red;\n  }\n</style></p>;\n";
    let result = compile(source, "/src/A.stsx", &CompileOptions::default());
    let css = result.css.expect("css");
    let json = result.css_map.expect("css map");
    let map = SourceMap::from_json_string(&json).expect("valid JSON");
    assert_eq!(map.get_sources().collect::<Vec<_>>(), ["/src/A.stsx"]);
    let table = map.generate_lookup_table();
    // Lightning CSS maps rules (selectors), not declarations.
    let (line, column) = position(&css, ".x[");
    let token = map.lookup_token(&table, line, column).expect("a mapping");
    assert_eq!(
        (token.get_src_line(), token.get_src_col()),
        position(source, ".x {")
    );
}

#[test]
fn css_can_be_disabled_and_minified() {
    let source = "export const A = () => <p class=\"x\"><style>.x { color: red; .y & { margin: 0 } }</style></p>;\n";
    let options = CompileOptions {
        emit_css: false,
        ..CompileOptions::default()
    };
    assert!(compile(source, "/src/A.stsx", &options).css.is_none());
    let options = CompileOptions {
        css: lumen_compiler::CssOptions {
            minify: true,
            targets: lumen_css::Targets {
                browsers: Some(lumen_css::Browsers {
                    safari: Some(15 << 16),
                    ..lumen_css::Browsers::default()
                }),
                ..lumen_css::Targets::default()
            },
        },
        ..CompileOptions::default()
    };
    let css = compile(source, "/src/A.stsx", &options).css.expect("css");
    assert!(!css.contains('\n') && !css.contains('&'), "{css}");
}

/// The scanner (masking, `$ref` binding) and `lumen_css` (substitution) must agree on where
/// references are, or a reference would be resolved but never substituted (or the reverse).
#[test]
fn scanner_and_css_pipeline_find_the_same_references() {
    let mut checked = 0;
    for dir in ["client", "scanner"] {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(dir);
        for entry in std::fs::read_dir(root).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().and_then(|e| e.to_str()) != Some("stsx") {
                continue;
            }
            let source = std::fs::read_to_string(&path).unwrap();
            let scan = lumen_compiler::scan(&source, path.to_str().unwrap());
            for block in scan.blocks.iter().filter(|b| !b.svg) {
                let css = block.content.source_text(&source);
                let ours: Vec<(u32, u32)> = block
                    .refs
                    .iter()
                    .map(|r| (r.span.start, r.span.end))
                    .collect();
                let theirs: Vec<(u32, u32)> = lumen_css::find_refs(css)
                    .iter()
                    .map(|site| {
                        let start = block.content.start + site.range.start as u32;
                        (start, block.content.start + site.range.end as u32)
                    })
                    .collect();
                assert_eq!(ours, theirs, "{}: {css}", path.display());
                checked += ours.len();
            }
        }
    }
    assert!(checked > 10, "only {checked} references checked");
}
