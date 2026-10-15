//! `lumiose_content::html` (TASK-312): HTML imports (tree building, scripts, the depth limit). Any
//! input returns a component (possibly with diagnostics) without panicking.
#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(source) = std::str::from_utf8(data) else {
        return;
    };
    let _ = lumiose_content::html(source, "fuzz.html");
});
