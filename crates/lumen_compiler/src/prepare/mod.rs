//! Steps between parsing and analysis: masked style artifacts and type stripping.

pub mod constants;
pub mod style;
mod types;

pub use constants::{ConstValue, HostModule, ModuleRequest, ResolvedModule};
pub use style::{
    ResolvedStyleRef, StyleArtifacts, StyleRefBinding, StyleRefBindingKind, resolve_style_refs,
    strip_style_artifacts,
};
pub use types::strip_types;

use oxc_diagnostics::OxcDiagnostic;

use crate::diagnostics::{Code, Diagnostic, Severity};
use crate::span::Span;

/// Converts an OXC diagnostic (parser or transformer) into a Lumen diagnostic.
pub fn from_oxc(code: Code, diagnostic: &OxcDiagnostic) -> Diagnostic {
    let mut labels = diagnostic.labels.iter();
    let span: Span = labels
        .next()
        .map(|label| label.span().into())
        .unwrap_or_default();
    let mut result = Diagnostic::new(code, span, diagnostic.message.to_string());
    for label in labels {
        result = result.with_label(label.span().into(), label.label().unwrap_or_default());
    }
    if let Some(help) = &diagnostic.help {
        result = result.with_help(help.to_string());
    }
    if diagnostic.severity != oxc_diagnostics::Severity::Error {
        result = result.with_severity(Severity::Warning);
    }
    result
}
