//! Lumen compiler core: `.stsx` scanner and masking, analysis, and client/server/hydrate codegen.
//! Pure crate: no I/O. See spec doc-1 §4.1 and §5.

pub mod analyze;
pub mod codegen;
mod compile;
pub mod css;
pub mod custom_properties;
pub mod diagnostics;
mod module_id;
pub mod prepare;
pub mod scanner;
pub mod span;

pub use codegen::client::{ScopeTokens, SubtreeScope};
pub use compile::{
    CompileMeta, CompileOptions, CompileResult, ComponentMeta, CustomPropertiesMeta, IslandMeta,
    Target, compile,
};
pub use css::CssOptions;
pub use custom_properties::CustomPropertySet;
pub use diagnostics::{Code, Diagnostic, Severity};
pub use lumen_css::Targets as CssTargets;
pub use module_id::PackageRoot;
pub use prepare::{ConstValue, HostModule, ModuleRequest, ResolvedModule};
pub use scanner::{ScanResult, scan};
pub use span::{Span, Utf16Index};

/// Compiler version, exposed to hosts (napi, wasm) for cache keys.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
