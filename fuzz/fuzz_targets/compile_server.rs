//! The server compile (SSR codegen, its escaping and island records): any input compiles to code or
//! diagnostics without panicking, as `.stsx` and as `.tsx`.
#![no_main]

use libfuzzer_sys::fuzz_target;
use lumiose_compiler::{CompileOptions, Target, compile};

fuzz_target!(|data: &[u8]| {
    let Ok(source) = std::str::from_utf8(data) else {
        return;
    };
    let options = CompileOptions {
        target: Target::Server,
        ..CompileOptions::default()
    };
    for filename in ["/src/Fuzz.stsx", "/src/Fuzz.tsx"] {
        let _ = compile(source, filename, &options);
    }
});
