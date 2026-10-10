//! Source map composition: Lightning CSS maps the output to the rewritten block texts; every
//! mapping is moved through the block's position map to the `.stsx` source.

use parcel_sourcemap::{OriginalLocation, SourceMap};

use crate::lines::{LineIndex, Newlines};
use crate::process::Prepared;

/// A version 3 source map (JSON) with one source, `filename`, and its full text.
pub(crate) fn compose(
    printed: &SourceMap,
    blocks: &[Prepared],
    filename: &str,
    source: &str,
) -> String {
    let source_lines = LineIndex::new(source, Newlines::Js);
    let mut map = SourceMap::new("");
    for mapping in printed.get_mappings() {
        let Some(original) = mapping.original else {
            continue;
        };
        let Some(block) = blocks.get(original.source as usize) else {
            continue;
        };
        let offset = block.original_offset(original.original_line, original.original_column);
        let (original_line, original_column) = source_lines.position(source, offset);
        map.add_mapping(
            mapping.generated_line,
            mapping.generated_column,
            Some(OriginalLocation {
                original_line,
                original_column,
                source: 0,
                name: None,
            }),
        );
    }
    let mut mappings = Vec::new();
    map.write_vlq(&mut mappings)
        .expect("writing to a Vec cannot fail");
    let mappings = String::from_utf8(mappings).expect("VLQ mappings are ASCII");
    format!(
        "{{\"version\":3,\"sources\":[{}],\"sourcesContent\":[{}],\"names\":[],\"mappings\":\"{mappings}\"}}",
        json_string(filename),
        json_string(source),
    )
}

fn json_string(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            ch if u32::from(ch) < 0x20 || matches!(ch, '\u{2028}' | '\u{2029}') => {
                out.push_str(&format!("\\u{:04x}", u32::from(ch)));
            }
            ch => out.push(ch),
        }
    }
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_json_strings() {
        assert_eq!(json_string("a\"b\\c\nd\u{1}é"), r#""a\"b\\c\nd\u0001é""#);
        // U+2028 is valid JSON but breaks JavaScript string literals in older engines.
        assert_eq!(json_string("\u{2028}"), format!("\"{}u2028\"", '\\'));
    }
}
