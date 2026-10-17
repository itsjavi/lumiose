//! `lumiose_svg::component_source` (TASK-312): the allowlist sanitizer and the component it emits
//! for an imported `.svg`. Any input returns a component or an error, without panicking, and no
//! emitted SMIL animation targets an `href`, an event handler or `style`, or holds a
//! `javascript:` value (TASK-468).
#![no_main]

use libfuzzer_sys::fuzz_target;

#[path = "../../crates/lumiose_svg/tests/support/animations.rs"]
mod animations;

fuzz_target!(|data: &[u8]| {
    let Ok(svg) = std::str::from_utf8(data) else {
        return;
    };
    if let Ok(source) = lumiose_svg::component_source(svg)
        && let Some(line) = animations::unsafe_animation(&source)
    {
        panic!("an unsafe animation was emitted: {line}");
    }
});
