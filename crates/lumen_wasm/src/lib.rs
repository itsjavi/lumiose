//! WebAssembly bindings for the Lumen compiler (the playground, TASK-58). See spec doc-1 §5.5.
//!
//! Like the napi binding, every offset is in UTF-16 code units and `masked` is the UTF-16
//! masked text, so JavaScript can index the source string directly. `compile` and `compileSvg`
//! take the napi binding's option names, so the playground shows the real output; `cssTargets`
//! is not available here (browserslist needs a file system).

use lumen_compiler::{ScanResult, Utf16Index};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
struct ScanView<'a> {
    kind: &'a lumen_compiler::scanner::FileKind,
    masked: String,
    blocks: &'a [lumen_compiler::scanner::StyleBlock],
    diagnostics: Vec<DiagnosticView<'a>>,
}

/// `CompileResult` with diagnostics in the napi shape.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompileView<'a> {
    code: &'a str,
    map: &'a Option<String>,
    css: &'a Option<String>,
    css_map: &'a Option<String>,
    css_deps: &'a [String],
    module_requests: &'a [lumen_compiler::ModuleRequest],
    diagnostics: Vec<DiagnosticView<'a>>,
    meta: &'a lumen_compiler::CompileMeta,
}

/// A diagnostic as the napi binding returns it: the code as `LUM1004` and its docs topic.
#[derive(Serialize)]
struct DiagnosticView<'a> {
    code: &'static str,
    severity: &'a lumen_compiler::Severity,
    message: &'a str,
    span: &'a lumen_compiler::Span,
    labels: &'a [lumen_compiler::diagnostics::Label],
    help: &'a Option<String>,
    fix: &'a Option<lumen_compiler::diagnostics::Fix>,
    docs: String,
}

fn diagnostic_views(diagnostics: &[lumen_compiler::Diagnostic]) -> Vec<DiagnosticView<'_>> {
    diagnostics
        .iter()
        .map(|diagnostic| DiagnosticView {
            code: diagnostic.code.id(),
            severity: &diagnostic.severity,
            message: &diagnostic.message,
            span: &diagnostic.span,
            labels: &diagnostic.labels,
            help: &diagnostic.help,
            fix: &diagnostic.fix,
            docs: diagnostic.docs(),
        })
        .collect()
}

fn compile_js(result: &lumen_compiler::CompileResult) -> Result<JsValue, JsError> {
    to_js(&CompileView {
        code: &result.code,
        map: &result.map,
        css: &result.css,
        css_map: &result.css_map,
        css_deps: &result.css_deps,
        module_requests: &result.module_requests,
        diagnostics: diagnostic_views(&result.diagnostics),
        meta: &result.meta,
    })
}

/// `CompileOptions` of the napi binding, without `cssTargets`.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct CompileOptions {
    target: Option<String>,
    source_map: Option<bool>,
    style_import: Option<bool>,
    emit_css: Option<bool>,
    css_minify: Option<bool>,
    root: Option<String>,
    packages: Vec<PackageRoot>,
    modules: Vec<HostModule>,
    contract: Option<bool>,
}

#[derive(Deserialize)]
struct PackageRoot {
    name: String,
    dir: String,
}

#[derive(Deserialize)]
struct HostModule {
    importer: String,
    specifier: String,
    resolved: Option<ResolvedModule>,
}

#[derive(Deserialize)]
struct ResolvedModule {
    id: String,
    source: String,
}

/// `SvgCompileOptions` of the napi binding.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct SvgCompileOptions {
    target: Option<String>,
    root: Option<String>,
}

/// The compiler version, for cache keys.
#[wasm_bindgen]
pub fn version() -> String {
    lumen_compiler::VERSION.to_owned()
}

/// Scans a `.stsx` / `.tsx` source: `{ kind, masked, blocks, diagnostics }`.
#[wasm_bindgen]
pub fn scan(source: &str, filename: &str) -> Result<JsValue, JsError> {
    let (masked, result) = scan_view(source, filename);
    to_js(&ScanView {
        kind: &result.kind,
        masked,
        blocks: &result.blocks,
        diagnostics: diagnostic_views(&result.diagnostics),
    })
}

/// Compiles a module like the napi binding's `compile`: `{ code, map, css, cssMap, cssDeps,
/// moduleRequests, diagnostics, meta }` with UTF-16 spans. `options` has the napi option names
/// (`target`, `sourceMap`, `styleImport`, `emitCss`, `cssMinify`, `root`, `packages`, `modules`).
#[wasm_bindgen]
pub fn compile(source: &str, filename: &str, options: JsValue) -> Result<JsValue, JsError> {
    let options = from_js::<CompileOptions>(options)?;
    compile_js(&compile_view(source, filename, compiler_options(options)))
}

/// Compiles an `.svg` file to the module of an inline component, like the napi binding's
/// `compileSvg` (without SVGO: optimising is the host's job).
#[wasm_bindgen(js_name = compileSvg)]
pub fn compile_svg(source: &str, filename: &str, options: JsValue) -> Result<JsValue, JsError> {
    let options = from_js::<SvgCompileOptions>(options)?;
    let component = lumen_svg::component_source(source)
        .map_err(|error| JsError::new(&format!("{filename}: {error}")))?;
    let options = compiler_options(CompileOptions {
        target: options.target,
        source_map: Some(false),
        style_import: Some(false),
        emit_css: Some(false),
        root: options.root,
        ..CompileOptions::default()
    });
    to_js(&compile_view(
        &component,
        &format!("{filename}.stsx"),
        options,
    ))
}

fn compiler_options(options: CompileOptions) -> lumen_compiler::CompileOptions {
    let defaults = lumen_compiler::CompileOptions::default();
    lumen_compiler::CompileOptions {
        target: match options.target.as_deref() {
            Some("server") => lumen_compiler::Target::Server,
            _ => lumen_compiler::Target::Client,
        },
        source_map: options.source_map.unwrap_or(defaults.source_map),
        style_import: options.style_import.unwrap_or(defaults.style_import),
        emit_css: options.emit_css.unwrap_or(defaults.emit_css),
        css: lumen_compiler::CssOptions {
            targets: lumen_compiler::CssTargets::default(),
            minify: options.css_minify.unwrap_or(false),
        },
        root: options.root,
        packages: options
            .packages
            .into_iter()
            .map(|package| lumen_compiler::PackageRoot {
                name: package.name,
                dir: package.dir,
            })
            .collect(),
        modules: options
            .modules
            .into_iter()
            .map(|module| lumen_compiler::HostModule {
                importer: module.importer,
                specifier: module.specifier,
                resolved: module
                    .resolved
                    .map(|resolved| lumen_compiler::ResolvedModule {
                        id: resolved.id,
                        source: resolved.source,
                    }),
            })
            .collect(),
        contract: options.contract.unwrap_or(defaults.contract),
    }
}

fn compile_view(
    source: &str,
    filename: &str,
    options: lumen_compiler::CompileOptions,
) -> lumen_compiler::CompileResult {
    let mut result = lumen_compiler::compile(source, filename, &options);
    let index = Utf16Index::new(source);
    if !index.is_identity() {
        result.map_spans(&|offset| index.to_utf16(offset));
    }
    result
}

/// `undefined` and `null` options are the defaults.
fn from_js<T: Default + for<'de> Deserialize<'de>>(value: JsValue) -> Result<T, JsError> {
    if value.is_undefined() || value.is_null() {
        return Ok(T::default());
    }
    serde_wasm_bindgen::from_value(value).map_err(|error| JsError::new(&error.to_string()))
}

/// Plain objects, not `Map`s, for maps (`meta.scopeTokens.components`), as napi returns them.
fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))
        .map_err(|error| JsError::new(&error.to_string()))
}

/// The scan result with UTF-16 offsets, and the UTF-16 masked text as a string.
fn scan_view(source: &str, filename: &str) -> (String, ScanResult) {
    let mut result = lumen_compiler::scan(source, filename);
    let masked = String::from_utf16(&result.masked_utf16(source))
        .expect("masking only replaces whole characters with ASCII");
    let index = Utf16Index::new(source);
    if !index.is_identity() {
        result.map_spans(&|offset| index.to_utf16(offset));
    }
    (masked, result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compile_uses_utf16_offsets() {
        let source = "const s = \"é\";\nexport const A = () => <p>{s}</p>;\nA();\n";
        let result = compile_view(source, "a.tsx", compiler_options(CompileOptions::default()));
        // `s` is a text const: a template text node written once (TASK-65).
        assert!(result.code.contains("template(`<p> `)"), "{}", result.code);
        let diagnostic = &result.diagnostics[0];
        assert_eq!(diagnostic.code.id(), "LUM2004");
        let units: Vec<u16> = source.encode_utf16().collect();
        assert_eq!(
            String::from_utf16(&units[diagnostic.span.range()]).unwrap(),
            "A()"
        );
    }

    #[test]
    fn options_select_the_server_target() {
        let source = "export const A = () => <p>a</p>;\n";
        let options = compiler_options(CompileOptions {
            target: Some("server".to_owned()),
            source_map: Some(false),
            ..CompileOptions::default()
        });
        let result = compile_view(source, "a.tsx", options);
        assert!(result.code.contains("lumen/server"), "{}", result.code);
        assert!(result.map.is_none());
    }

    #[test]
    fn view_uses_utf16_offsets() {
        let source = "const s = \"é\";\n<style>.a { margin: $s }</style>\n";
        let (masked, result) = scan_view(source, "a.stsx");
        assert_eq!(masked.encode_utf16().count(), source.encode_utf16().count());
        let reference = &result.blocks[0].refs[0];
        let units: Vec<u16> = source.encode_utf16().collect();
        let text = String::from_utf16(&units[reference.span.range()]).unwrap();
        assert_eq!(text, "$s");
    }
}
