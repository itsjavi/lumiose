//! `lumiose_svg::component_source` (TASK-312): the allowlist sanitizer and the component it emits
//! for an imported `.svg`. Any input returns a component or an error, without panicking.
#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(svg) = std::str::from_utf8(data) else {
        return;
    };
    let _ = lumiose_svg::component_source(svg);
});
