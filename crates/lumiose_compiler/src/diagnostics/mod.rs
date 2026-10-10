//! Compiler diagnostics: `{ code, severity, message, span, labels, help, fix?, docs }` (spec §5.4).

mod registry;

pub use registry::{Code, DiagnosticInfo, REGISTRY};

use crate::span::Span;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum Severity {
    Error,
    Warning,
    Hint,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warning => "warning",
            Self::Hint => "hint",
        }
    }
}

/// A secondary location attached to a diagnostic.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct Label {
    pub span: Span,
    pub message: String,
}

/// A text replacement in the original source.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct TextEdit {
    pub span: Span,
    pub text: String,
}

/// A machine-applicable fix.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct Fix {
    pub message: String,
    pub edits: Vec<TextEdit>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct Diagnostic {
    pub code: Code,
    pub severity: Severity,
    pub message: String,
    pub span: Span,
    pub labels: Vec<Label>,
    pub help: Option<String>,
    pub fix: Option<Fix>,
}

impl Diagnostic {
    /// Creates a diagnostic with the code's default severity.
    pub fn new(code: Code, span: Span, message: impl Into<String>) -> Self {
        Self {
            code,
            severity: code.info().default_severity,
            message: message.into(),
            span,
            labels: Vec::new(),
            help: None,
            fix: None,
        }
    }

    pub fn with_severity(mut self, severity: Severity) -> Self {
        self.severity = severity;
        self
    }

    pub fn with_label(mut self, span: Span, message: impl Into<String>) -> Self {
        self.labels.push(Label {
            span,
            message: message.into(),
        });
        self
    }

    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        self
    }

    pub fn with_fix(mut self, fix: Fix) -> Self {
        self.fix = Some(fix);
        self
    }

    pub fn is_error(&self) -> bool {
        self.severity == Severity::Error
    }

    /// The docs topic for this diagnostic's code.
    pub fn docs(&self) -> String {
        self.code.info().docs()
    }

    /// Applies an offset mapping (for example byte → UTF-16) to every span.
    pub fn map_spans(&mut self, f: &impl Fn(u32) -> u32) {
        self.span = self.span.map(f);
        for label in &mut self.labels {
            label.span = label.span.map(f);
        }
        if let Some(fix) = &mut self.fix {
            for edit in &mut fix.edits {
                edit.span = edit.span.map(f);
            }
        }
    }
}
