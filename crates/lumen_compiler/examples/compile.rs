//! `cargo run -p lumen_compiler --example compile -- <file> [--time]`: prints the client output
//! and diagnostics of one file, or with `--time` the average compile time (a debugging aid).

use std::time::Instant;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: compile <file> [--time]");
    let source = std::fs::read_to_string(&path).expect("readable file");
    let options = lumen_compiler::CompileOptions::default();
    if std::env::args().any(|a| a == "--time") {
        let runs = 20;
        let start = Instant::now();
        let mut bytes = 0;
        for _ in 0..runs {
            bytes = lumen_compiler::compile(&source, &path, &options).code.len();
        }
        eprintln!(
            "{} lines, {} bytes in, {bytes} bytes out: {:?} per compile",
            source.lines().count(),
            source.len(),
            start.elapsed() / runs
        );
        return;
    }
    let result = lumen_compiler::compile(&source, &path, &options);
    println!("{}", result.code);
    for diagnostic in &result.diagnostics {
        eprintln!(
            "{} {:?} {}..{} {}",
            diagnostic.code,
            diagnostic.severity,
            diagnostic.span.start,
            diagnostic.span.end,
            diagnostic.message
        );
    }
}
