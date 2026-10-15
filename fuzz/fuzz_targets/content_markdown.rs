//! `lumiose_content::markdown` (TASK-312): frontmatter, CommonMark + GFM, raw HTML in Markdown and
//! the depth limits. Any input returns a component (possibly with diagnostics) without panicking.
#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(source) = std::str::from_utf8(data) else {
        return;
    };
    let _ = lumiose_content::markdown(source, "fuzz.md");
});
