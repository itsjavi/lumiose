//! WebAssembly bindings for the Lumen compiler (playground). See spec doc-1 §5.5.
//!
//! Like the napi binding, every offset is in UTF-16 code units and `masked` is the UTF-16
//! masked text, so JavaScript can index the source string directly.

use lumen_compiler::{ScanResult, Utf16Index};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
struct ScanView<'a> {
    masked: String,
    #[serde(flatten)]
    result: &'a ScanResult,
}

/// The compiler version, for cache keys.
#[wasm_bindgen]
pub fn version() -> String {
    lumen_compiler::VERSION.to_owned()
}

/// Scans a `.stsx` / `.tsx` source: `{ kind, masked, blocks, diagnostics }`.
#[wasm_bindgen]
pub fn scan(source: &str, filename: &str) -> Result<JsValue, JsError> {
    let view = scan_view(source, filename);
    let view = ScanView {
        masked: view.0,
        result: &view.1,
    };
    serde_wasm_bindgen::to_value(&view).map_err(|error| JsError::new(&error.to_string()))
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
