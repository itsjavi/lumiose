//! `compile()` API behaviour beyond the codegen goldens: targets, syntax errors, metadata,
//! source maps and style reference resolution.

use lumen_compiler::prepare::StyleRefBindingKind;
use lumen_compiler::{Code, CompileOptions, Target, compile};
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
    assert_eq!(result.meta.runtime_helpers, ["ssr", "insert"]);
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
