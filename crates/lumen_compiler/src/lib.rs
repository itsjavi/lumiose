//! Lumen compiler core: `.stsx` scanner and masking, analysis, and client/server/hydrate codegen.
//! Pure crate: no I/O. See spec doc-1 §4.1 and §5.

pub mod diagnostics;
pub mod scanner;
pub mod span;

pub use diagnostics::{Code, Diagnostic, Severity};
pub use scanner::{ScanResult, scan};
pub use span::{Span, Utf16Index};

/// Compiler version, exposed to hosts (napi, wasm) for cache keys.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
