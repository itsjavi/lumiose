//! The `.stsx` scanner and masking (spec §4.1): any input scans without panicking, and the masked
//! text keeps the source's length and line structure in UTF-8 bytes and in UTF-16 code units (the
//! masking invariant the compiler, shadow TSX and language server rely on).
#![no_main]

use libfuzzer_sys::fuzz_target;
use lumiose_compiler::scanner::{FileKind, scan_kind};

fuzz_target!(|data: &[u8]| {
    let Ok(source) = std::str::from_utf8(data) else {
        return;
    };
    for kind in [FileKind::Stsx, FileKind::Tsx] {
        let result = scan_kind(source, kind);
        let masked = result.masked();
        assert_eq!(masked.len(), source.len(), "masking changed the length");
        let lines = |text: &str| {
            text.match_indices('\n')
                .map(|(at, _)| at)
                .collect::<Vec<_>>()
        };
        assert_eq!(lines(masked), lines(source), "masking moved a line break");
        assert_eq!(
            result.masked_utf16(source).len(),
            source.encode_utf16().count(),
            "masking changed the UTF-16 length"
        );
        for diagnostic in &result.diagnostics {
            let span = diagnostic.span;
            assert!(span.start <= span.end && span.end as usize <= source.len());
        }
        if !result.has_errors() && result.blocks.is_empty() {
            assert_eq!(masked, source, "a file without blocks must mask to itself");
        }
    }
});
