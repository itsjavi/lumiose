//! Lumiose compiler core: `.stsx` scanner and masking, analysis, and client/server/hydrate codegen.
//! Pure crate: no I/O. See spec doc-1 §4.1 and §5.

pub mod analyze;
pub mod codegen;
mod compile;
pub mod css;
pub mod custom_properties;
pub mod depth;
mod dev_source;
pub mod diagnostics;
mod hot;
pub mod imports;
mod module_id;
pub mod prepare;
pub mod scanner;
pub mod span;
mod tsx;

pub use codegen::client::{ContractEntry, ContractKind, ContractSite, ScopeTokens, SubtreeScope};
pub use compile::{
    CompileMeta, CompileOptions, CompileResult, ComponentMeta, CustomPropertiesMeta, IslandMeta,
    Target, compile,
};
pub use css::{CssOptions, ScopedStyles};
pub use custom_properties::CustomPropertySet;
pub use diagnostics::{Code, Diagnostic, Severity};
pub use imports::ImportMeta;
pub use lumiose_css::Targets as CssTargets;
pub use lumiose_css::{ScopeSpecificity, ScopeStrategy, validate_namespace};
pub use module_id::PackageRoot;
pub use prepare::{ConstValue, HostModule, ModuleRequest, ResolvedModule};
pub use scanner::{ScanResult, scan};
pub use span::{Span, Utf16Index};
pub use tsx::{TsxOptions, TsxResult, compile_tsx};

/// Compiler version, exposed to hosts (napi, wasm) for cache keys.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
