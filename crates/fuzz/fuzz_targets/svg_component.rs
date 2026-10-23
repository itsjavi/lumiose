//! `lumiose_svg::component_source` (TASK-312): the allowlist sanitizer and the component it emits
//! for an imported `.svg`. Any input returns a component or an error, without panicking; no
//! emitted SMIL animation targets an `href`, an event handler or `style`, or holds a
//! `javascript:` value (TASK-468); and nothing emitted loads a resource from outside the file
//! (decision-69, TASK-499).
#![no_main]

use libfuzzer_sys::fuzz_target;

#[path = "../../lumiose_svg/tests/support/invariants.rs"]
mod invariants;

fuzz_target!(|data: &[u8]| {
    let Ok(svg) = std::str::from_utf8(data) else {
        return;
    };
    let Ok(source) = lumiose_svg::component_source(svg) else {
        return;
    };
    if let Some(line) = invariants::unsafe_animation(&source) {
        panic!("an unsafe animation was emitted: {line}");
    }
    if let Some(breach) = invariants::external_reference(&source) {
        panic!("a reference outside the file was emitted: {breach}");
    }
});
