//! `compile()` API behaviour beyond the codegen goldens: targets, syntax errors, metadata,
//! source maps, style reference resolution, constant folding with host modules and CSS output.

use lumiose_compiler::prepare::StyleRefBindingKind;
use lumiose_compiler::{
    Code, CompileOptions, ConstValue, HostModule, ModuleRequest, PackageRoot, ResolvedModule,
    Target, compile,
};
use oxc_sourcemap::SourceMap;

const COUNTER: &str = r#"import { signal } from "lumiose";
import { radius } from "./tokens.ts";
const gap = 4;
export async function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);
  await Promise.resolve();
  return (
    <button onClick={() => count.update((c) => c + 1)}>
      {count()}
      <style>button { border-radius: $radius.lg; margin: calc($gap * 1px); }</style>
    </button>
  );
}
"#;

#[test]
fn server_target_imports_lumiose_server() {
    let options = CompileOptions {
        target: Target::Server,
        ..CompileOptions::default()
    };
    let result = compile(COUNTER, "/src/Counter.stsx", &options);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    assert!(result.code.contains(r#"from "lumiose/server""#));
    assert!(!result.code.contains("lumiose/dom"));
    assert!(!result.code.contains("onClick") && !result.code.contains("delegateEvents"));
    assert_eq!(
        result.meta.runtime_helpers,
        ["ssr", "SSRHtml", "insertText", "$await", "$leave", "$async"]
    );
    assert!(result.meta.delegated_events.is_empty());
    assert_eq!(result.meta.templates, 1);
}

#[test]
fn server_attributes_of_custom_elements_leave_objects_to_the_client() {
    // TASK-337: on a custom element (a tag with a dash), `attr(name, value, true)` and
    // `spreadAttrs(props, true)`; other elements keep the two-argument forms.
    let source = r#"export function A(props: { items: string[]; rest: object }) {
  return (
    <div>
      <rating-stars max={props.items.length} items={props.items} />
      <rating-stars {...props.rest} />
      <p title={props.items.join()} />
    </div>
  );
}
"#;
    let options = CompileOptions {
        target: Target::Server,
        ..CompileOptions::default()
    };
    let code = compile(source, "/src/a.tsx", &options).code;
    assert!(
        code.contains(r#"attr("items", props.items, true)"#),
        "{code}"
    );
    assert!(
        code.contains(r#"attr("max", props.items.length, true)"#),
        "{code}"
    );
    assert!(code.contains("spreadAttrs(props.rest, true)"), "{code}");
    assert!(
        code.contains(r#"attr("title", props.items.join())"#),
        "{code}"
    );
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

#[test]
fn islands_and_scope_tokens_outside_the_root_are_package_relative() {
    let source = r#"import { Nav } from "./Nav.stsx";
import { Menu } from "../../menu/src/Menu.stsx";
import { Search } from "@acme/search";
export function Header() {
  return (
    <header class="top">
      <Nav client:load />
      <Menu client:idle />
      <Search client:visible />
      <style>.top { color: red; }</style>
    </header>
  );
}
"#;
    let filename = "/repo/packages/kit/src/Header.stsx";
    let package = |name: &str, dir: &str| PackageRoot {
        name: name.into(),
        dir: dir.into(),
    };
    let options = CompileOptions {
        target: Target::Server,
        root: Some("/repo/apps/web".into()),
        packages: vec![
            package("@acme/kit", "/repo/packages/kit"),
            package("@acme/menu", "/repo/packages/menu/"),
        ],
        ..CompileOptions::default()
    };
    let result = compile(source, filename, &options);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let islands: Vec<_> = result
        .meta
        .islands
        .iter()
        .map(|island| (island.reference.as_str(), island.module.as_str()))
        .collect();
    // Refs (in the HTML) are machine-independent; modules stay importable by the bundler.
    assert_eq!(
        islands,
        [
            (
                "@acme/kit/src/Nav.stsx#Nav",
                "/repo/packages/kit/src/Nav.stsx"
            ),
            (
                "@acme/menu/src/Menu.stsx#Menu",
                "/repo/packages/menu/src/Menu.stsx"
            ),
            ("@acme/search#Search", "@acme/search"),
        ]
    );
    assert!(
        result
            .code
            .contains(r#"island("@acme/kit/src/Nav.stsx#Nav""#),
        "{}",
        result.code
    );
    assert!(!result.code.contains(r#"island("/repo"#), "{}", result.code);
    let token = lumiose_css::scope_token("@acme/kit/src/Header.stsx", Some("Header"));
    assert!(
        result.code.contains(&format!("data-l-{token}")),
        "{}",
        result.code
    );

    // Without the package, the absolute id is kept (and hashed).
    let bare = compile(
        source,
        filename,
        &CompileOptions {
            packages: Vec::new(),
            ..options
        },
    );
    assert_eq!(
        bare.meta.islands[0].reference,
        "/repo/packages/kit/src/Nav.stsx#Nav"
    );
    let token = lumiose_css::scope_token(filename, Some("Header"));
    assert!(
        bare.code.contains(&format!("data-l-{token}")),
        "{}",
        bare.code
    );
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
        css.contains("border-radius: 12px") && css.contains("margin: 4px"),
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
    let file = lumiose_css::scope_token("src/Card.stsx", None);
    let card = lumiose_css::scope_token("src/Card.stsx", Some("Card"));
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
fn nested_blocks_scope_to_their_enclosing_element() {
    // decision-23: one token per style-bearing element, reported with the element's span.
    let source = r#"export function Card() {
  return (
    <article>
      <p class="a">a</p>
      <div class="b"><p class="c">c</p><style>.c { color: red; }</style></div>
      <style>article { margin: 0; }</style>
    </article>
  );
}
"#;
    let result = compile(source, "/src/Card.stsx", &CompileOptions::default());
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let subtrees = &result.meta.scope_tokens.components["Card"];
    let card = lumiose_css::scope_token("/src/Card.stsx", Some("Card"));
    let nested = lumiose_css::scope_token("/src/Card.stsx", Some("Card#1"));
    let text = |span: lumiose_compiler::Span| &source[span.start as usize..span.end as usize];
    assert_eq!(subtrees.len(), 2);
    assert_eq!(subtrees[0].attribute, format!("data-l-{card}"));
    assert!(text(subtrees[0].span).starts_with("<article>"));
    assert_eq!(subtrees[1].attribute, format!("data-l-{nested}"));
    assert!(text(subtrees[1].span).starts_with(r#"<div class="b">"#));
    assert!(text(subtrees[1].span).ends_with("</div>"));
    let code = &result.code;
    assert!(
        code.contains(&format!("<p class=a data-l-{card}>")),
        "{code}"
    );
    assert!(
        code.contains(&format!("<p class=c data-l-{card} data-l-{nested}>")),
        "{code}"
    );
    let css = result.css.expect("css");
    assert!(css.contains(&format!(".c[data-l-{nested}]")), "{css}");
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
        css: lumiose_compiler::CssOptions {
            minify: true,
            targets: lumiose_css::Targets {
                browsers: Some(lumiose_css::Browsers {
                    safari: Some(15 << 16),
                    ..lumiose_css::Browsers::default()
                }),
                ..lumiose_css::Targets::default()
            },
        },
        ..CompileOptions::default()
    };
    let css = compile(source, "/src/A.stsx", &options).css.expect("css");
    assert!(!css.contains('\n') && !css.contains('&'), "{css}");
}

/// The scanner (masking, `$ref` binding) and `lumiose_css` (substitution) must agree on where
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
            let scan = lumiose_compiler::scan(&source, path.to_str().unwrap());
            for block in scan.blocks.iter().filter(|b| !b.svg) {
                let css = block.content.source_text(&source);
                let ours: Vec<(u32, u32)> = block
                    .refs
                    .iter()
                    .map(|r| (r.span.start, r.span.end))
                    .collect();
                let theirs: Vec<(u32, u32)> = lumiose_css::find_refs(css)
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

#[test]
fn metadata_lists_custom_properties_set_in_style_props_and_read_by_the_css() {
    let source = r#"export function Bar(props: { pct: number }) {
  return (
    <div class="bar" style={{ "--fill": `${props.pct}%`, "--unused": 1 }}>
      <style>.bar { inline-size: var(--fill); color: var(--theme-fg, var(--fallback)); }</style>
    </div>
  );
}
"#;
    let result = compile(source, "/src/Bar.stsx", &CompileOptions::default());
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let set: Vec<(&str, &str)> = result
        .meta
        .custom_properties
        .set
        .iter()
        .map(|p| {
            let written = &source[p.span.start as usize..p.span.end as usize];
            (p.name.as_str(), written)
        })
        .collect();
    assert_eq!(set, [("--fill", "--fill"), ("--unused", "--unused")]);
    assert_eq!(
        result.meta.custom_properties.read,
        ["--fallback", "--fill", "--theme-fg"]
    );
}

#[test]
fn contract_meta_classifies_each_jsx_expression() {
    let source = r#"import { signal, untrack } from "lumiose";
import { Card } from "./Card.tsx";
export async function Panel({ title }: { title: string }) {
  const count = signal(0);
  const label = "x";
  const data = await load();
  return (
    <section class={count() > 1 ? "big" : "small"} id={label} onClick={() => count.set(1)}>
      {title}
      {untrack(count)}
      {label}
      {count() > 0 && <p>positive</p>}
      <Card heading={title} size={2} ref={(el) => el} />
    </section>
  );
}
"#;
    let options = CompileOptions {
        contract: true,
        ..CompileOptions::default()
    };
    let result = compile(source, "/src/Panel.tsx", &options);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let contract = result
        .meta
        .contract
        .expect("contract with `contract: true`");
    let rows: Vec<String> = contract
        .iter()
        .map(|entry| {
            let text = &source[entry.span.start as usize..entry.span.end as usize];
            let reads: Vec<&str> = entry
                .reads
                .iter()
                .map(|r| &source[r.start as usize..r.end as usize])
                .collect();
            format!(
                "{text} | {:?} {:?} via {} in {} reads {reads:?}",
                entry.kind,
                entry.site,
                entry.via.as_deref().unwrap_or("-"),
                entry.component.as_deref().unwrap_or("-"),
            )
        })
        .collect();
    assert_eq!(
        rows,
        [
            "await load() | Once Await via $await in Panel reads []",
            r#"count() > 1 ? "big" : "small" | Tracked Class via setClass in Panel reads ["count()"]"#,
            "label | Once Attribute via setAttr in Panel reads []",
            "() => count.set(1) | Deferred Event via delegateEvents in Panel reads []",
            r#"title | Tracked Child via insert in Panel reads ["title"]"#,
            "untrack(count) | Untracked Child via insert in Panel reads []",
            "label | Once Child via insert in Panel reads []",
            r#"count() > 0 && <p>positive</p> | Tracked Child via branch in Panel reads ["count()"]"#,
            r#"title | Tracked Prop via getter in Panel reads ["title"]"#,
            "2 | Once Prop via - in Panel reads []",
            "(el) => el | Once Prop via - in Panel reads []",
        ]
    );
    let without = compile(source, "/src/Panel.tsx", &CompileOptions::default());
    assert!(without.meta.contract.is_none());
}

#[test]
fn metadata_lists_imports_without_type_only_ones() {
    let source = r#"import { signal } from "lumiose";
import type { Row } from "./types.ts";
import { type Db, open } from "../server/db.server.ts";
export { helper } from "./helper.ts";
export * from "./all.ts";
export const lazy = () => import("./Lazy.stsx");
export function A(props: { rows: Row[]; db: Db }) {
  open();
  return <p>{signal(props.rows.length)()}</p>;
}
"#;
    let result = compile(source, "/src/A.tsx", &CompileOptions::default());
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    let imports: Vec<(&str, &str, bool)> = result
        .meta
        .imports
        .iter()
        .map(|import| {
            let written = &source[import.span.start as usize..import.span.end as usize];
            (import.specifier.as_str(), written, import.dynamic)
        })
        .collect();
    assert_eq!(
        imports,
        [
            ("lumiose", "lumiose", false),
            ("../server/db.server.ts", "../server/db.server.ts", false),
            ("./helper.ts", "./helper.ts", false),
            ("./all.ts", "./all.ts", false),
            ("./Lazy.stsx", "./Lazy.stsx", true),
        ]
    );
}

#[test]
fn server_routes_read_their_own_props_without_lum2001() {
    let page = r#"export default function Book(props: { params: { slug: string } }) {
  const title = props.params.slug.toUpperCase();
  const { params } = props;
  return <h1>{title} {params.slug}</h1>;
}
"#;
    let named = r#"function Book({ params }: { params: { slug: string } }) {
  const title = params.slug.toUpperCase();
  return <h1>{title}</h1>;
}
function Helper(props: { n: number }) {
  const twice = props.n * 2;
  return <b>{twice}</b>;
}
export { Book as default, Helper };
"#;
    let stale = |source: &str, server_route: bool| -> Vec<String> {
        let options = CompileOptions {
            server_route,
            ..CompileOptions::default()
        };
        compile(source, "/src/routes/book.tsx", &options)
            .diagnostics
            .iter()
            .filter(|d| d.code == Code::StaleDerivedValue)
            .map(|d| source[d.span.start as usize..d.span.end as usize].to_owned())
            .collect()
    };
    // Islands and spa routes (no `server_route`) re-render with new props: still reported.
    assert_eq!(stale(page, false).len(), 2);
    assert_eq!(stale(page, true), Vec::<String>::new());
    assert_eq!(stale(named, false).len(), 2);
    // Only the default export (the page) gets plain props; other components keep the rule.
    assert_eq!(stale(named, true), ["twice = props.n * 2"]);
}

#[test]
fn control_flow_apis_are_not_reactive_reads() {
    let source = r#"import { signal, notFound, error, params } from "lumiose";
import { getProject } from "../lib/data.ts";
export default function Page() {
  const count = signal(0);
  const project = getProject(params().slug) ?? notFound();
  const checked = project.ok ? project : error();
  const stale = count() ?? notFound();
  return <h1>{project.name}{checked.name}{stale}</h1>;
}
"#;
    let result = compile(source, "/src/routes/[slug].tsx", &CompileOptions::default());
    let stale: Vec<&str> = result
        .diagnostics
        .iter()
        .filter(|d| d.code == Code::StaleDerivedValue)
        .map(|d| &source[d.span.start as usize..d.span.end as usize])
        .collect();
    assert_eq!(stale, ["stale = count() ?? notFound()"]);
}

#[test]
fn stable_list_sources_keep_the_index_without_lum2006() {
    let source = r#"import { signal } from "lumiose";
const CHANNELS = [{ name: "pulse" }, { name: "wave" }] as const;
const SORTED = ["b", "a"];
SORTED.sort();
export function Mixer() {
  const rows = signal([1, 2]);
  return (
    <div>
      <ul>{CHANNELS.map((info, i) => { const ch = i; return <li>{info.name}{ch}</li>; })}</ul>
      <ol>{SORTED.map((name, i) => { const at = i; return <li>{name}{at}</li>; })}</ol>
      <p>{rows().map((row, i) => { const n = i; return <b>{row}{n}</b>; })}</p>
    </div>
  );
}
"#;
    let result = compile(source, "/src/Mixer.tsx", &CompileOptions::default());
    let escapes: Vec<&str> = result
        .diagnostics
        .iter()
        .filter(|d| d.code == Code::ReactiveIndexEscapes)
        .map(|d| &source[d.span.start as usize..d.span.end as usize])
        .collect();
    // The constant array's rows never move; a sorted array and a signal still warn.
    assert_eq!(escapes, ["i", "i"]);
    assert!(result.code.contains("const ch = i();"));
}

#[test]
fn strict_csp_applies_static_styles_through_the_cssom_and_nonces_inline_elements() {
    let source = r#"export function Logo(props: { n: number }) {
  return (
    <div style="color: red" class="logo">
      <p style={{ margin: "0", width: `${props.n}px` }}>x</p>
      <script innerHTML="window.a = 1" />
      <script nonce="fixed" innerHTML="window.b = 2" />
    </div>
  );
}
"#;
    let svg = r#"export function Pixel() {
  return <svg viewBox="0 0 1 1"><style>rect { fill: teal; }</style><rect /></svg>;
}
"#;
    let compile_strict = |source: &str, id: &str, target: Target| {
        let options = CompileOptions {
            target,
            strict_csp: true,
            ..CompileOptions::default()
        };
        let result = compile(source, id, &options);
        assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
        result.code
    };
    let client = compile_strict(source, "/src/Logo.tsx", Target::Client);
    assert!(
        client
            .contains("template(`<div class=logo><p>x</p><script><\\/script><script nonce=fixed>")
    );
    assert!(client.contains(r#"setStyle(_el, "color: red");"#));
    assert!(client.contains(r#"setStyleProperty(_p, "margin", "0");"#));
    // Only the script without an explicit nonce gets the page's.
    assert_eq!(client.matches("setNonce(").count(), 1);
    let server = compile_strict(source, "/src/Logo.tsx", Target::Server);
    assert!(!server.contains("style="));
    assert!(server.contains(r#"styleAttr("color: red")"#));
    assert_eq!(server.matches("nonceAttr()").count(), 1);
    // A native SVG `<style>` block gets the nonce on both sides.
    let client = compile_strict(svg, "/src/Pixel.stsx", Target::Client);
    assert!(client.contains("setNonce(_raw);"));
    let server = compile_strict(svg, "/src/Pixel.stsx", Target::Server);
    assert!(
        server.contains(r#""<svg viewBox=\"0 0 1 1\"><style", ">rect { fill: teal; }</style>"#)
    );
    // Without strict CSP nothing changes.
    let plain = compile(source, "/src/Logo.tsx", &CompileOptions::default()).code;
    assert!(plain.contains("style=\"color: red\"") && !plain.contains("setNonce"));
}

#[test]
fn hot_registers_components_with_versions_that_ignore_styles_and_other_components() {
    let source = r#"const label = "count";
export function Counter() {
  return <p class="c">{label}<style>.c { color: red; }</style></p>;
}
export const Other = () => <i>other</i>;
export default async function Page() {
  await Promise.resolve();
  return <main />;
}
"#;
    let hot = |source: &str| {
        let options = CompileOptions {
            hot: true,
            ..CompileOptions::default()
        };
        compile(source, "/src/Counter.stsx", &options).code
    };
    let version = |code: &str, name: &str| -> String {
        let marker = format!("{name} = $$lumioseHot(import.meta.hot, {name:?}, {name}, \"");
        let start = code.find(&marker).expect(name) + marker.len();
        code[start..start + 16].to_owned()
    };
    let code = hot(source);
    assert!(code.contains("export let Other = "), "{code}");
    assert!(
        code.contains(
            r#"$$lumioseHotAccept(import.meta.hot, ["Counter", "Other", "default"], next)"#
        )
    );
    // Async components keep their `$async` mark: not registered (the module falls back).
    assert!(!code.contains("\"Page\""));
    // A style-only edit changes no version; an edit inside a component changes only its own;
    // an edit outside every component changes all of them.
    let styled = hot(&source.replace("color: red;", "color: blue; margin: 0;"));
    assert_eq!(version(&styled, "Counter"), version(&code, "Counter"));
    let edited = hot(&source.replace("<i>other</i>", "<i>changed</i>"));
    assert_eq!(version(&edited, "Counter"), version(&code, "Counter"));
    assert_ne!(version(&edited, "Other"), version(&code, "Other"));
    let shared = hot(&source.replace("\"count\"", "\"total\""));
    assert_ne!(version(&shared, "Counter"), version(&code, "Counter"));
    assert_ne!(version(&shared, "Other"), version(&code, "Other"));
    // Off by default, and never for the server target.
    assert!(
        !compile(source, "/src/Counter.stsx", &CompileOptions::default())
            .code
            .contains("lumioseHot")
    );
    let server = CompileOptions {
        hot: true,
        target: Target::Server,
        ..CompileOptions::default()
    };
    assert!(
        !compile(source, "/src/Counter.stsx", &server)
            .code
            .contains("lumioseHot")
    );
}

#[test]
fn dev_source_locates_elements_components_and_signals_for_the_inspector() {
    let source = r#"import { computed, signal as cell } from "lumiose";
const signal = (n: number) => n;
export function Counter() {
  const count = cell(0);
  const doubled = computed(() => count() * 2);
  const plain = signal(1);
  return (
    <p class="n">
      <b>{doubled()}</b> {plain}
    </p>
  );
}
"#;
    let dev = |target: Target| {
        let options = CompileOptions {
            target,
            hot: true,
            dev_source: true,
            root: Some("/repo/app".into()),
            ..CompileOptions::default()
        };
        let result = compile(source, "/repo/app/src/Counter.stsx", &options);
        assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
        result.code
    };
    let client = dev(Target::Client);
    assert!(
        client.contains(
            "template(`<p class=n data-lumiose-source=src/Counter.stsx:8:5><b data-lumiose-source=src/Counter.stsx:9:7>"
        ),
        "{client}"
    );
    assert!(client.contains(r#"$$lumioseHot(import.meta.hot, "Counter", Counter, "#));
    assert!(client.contains(r#", "src/Counter.stsx:3:8");"#));
    // Only `lumiose`'s constructors, under their local names.
    assert!(client.contains(r#"const count = $$lumioseLabel(cell(0), "count");"#));
    assert!(client.contains(r#"$$lumioseLabel(computed(() => count() * 2), "doubled")"#));
    assert!(client.contains("const plain = signal(1);"));
    assert!(client.contains(r#"import { $label as $$lumioseLabel } from "lumiose/dom/hot";"#));
    // Server HTML carries the same attributes, so server-only markup can be located too.
    let server = dev(Target::Server);
    assert!(
        server.contains("<p class=n data-lumiose-source=src/Counter.stsx:8:5>"),
        "{server}"
    );
    assert!(!server.contains("lumioseLabel") && !server.contains("lumioseHot"));
    // Off by default.
    let plain = compile(
        source,
        "/repo/app/src/Counter.stsx",
        &CompileOptions::default(),
    )
    .code;
    assert!(!plain.contains("data-lumiose-source") && !plain.contains("lumioseLabel"));
}

#[test]
fn lum4004_reports_browser_globals_evaluated_at_module_scope_on_the_server() {
    let source = r#"import { onMount, signal } from "lumiose";
const saved = localStorage.getItem("theme");
const wide = window.innerWidth > 800;
const guarded = typeof window !== "undefined" ? window.location.href : "/";
if (typeof document !== "undefined") document.title = "x";
const kind = typeof navigator;
function document2(document: string) { return document; }
class Store { width = window.innerWidth; }
export function Theme() {
  const theme = signal(saved);
  onMount(() => theme.set(localStorage.getItem("theme")));
  return <button onClick={() => alert(document.title)}>{theme()}{String(wide)}</button>;
}
"#;
    let reported = |target: Target, browser_globals: bool| -> Vec<String> {
        let options = CompileOptions {
            target,
            browser_globals,
            ..CompileOptions::default()
        };
        compile(source, "/src/Theme.tsx", &options)
            .diagnostics
            .iter()
            .filter(|d| d.code == Code::BrowserApiAtModuleScope)
            .map(|d| source[d.span.start as usize..d.span.end as usize].to_owned())
            .collect()
    };
    assert_eq!(reported(Target::Server, false), ["localStorage", "window"]);
    assert_eq!(reported(Target::Client, true), ["localStorage", "window"]);
    assert!(reported(Target::Client, false).is_empty());
}
