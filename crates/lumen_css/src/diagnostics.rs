//! CSS diagnostics, shaped like `lumen_compiler`'s `{ code, severity, message, span, labels,
//! help, fix? }` (spec §5.4) so the compiler can convert them one-to-one by code id.

use crate::Span;

/// The diagnostic codes this crate emits. Ids must exist in the compiler's registry
/// (`crates/lumen_compiler/src/diagnostics/registry.rs`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum CssCode {
    /// `LUM3005` (warning): a scoped selector matches no element of its scope.
    UnusedSelector,
    /// `LUM3009` (error): `$brand-primary`; JS identifiers cannot contain `-`.
    HyphenatedStyleRef,
    /// `LUM3012` (warning): a custom property set in a `style` prop is never read.
    CustomPropertyNeverRead,
    /// `LUM3014` (error): Lightning CSS rejected a block, or minifying or printing failed.
    CssSyntaxError,
    /// `LUM3015` (warning): Lightning CSS dropped an invalid rule, declaration or selector.
    InvalidCssIgnored,
    /// `LUM3016` (error): `:global` or `:deep` without an argument, a nested `:deep()`, or a
    /// second `:deep()` in one selector.
    InvalidScopeSelector,
    /// `LUM3017` (warning): a declaration's value does not parse for its property, so
    /// browsers ignore the declaration (`color: notacolor`, an auto-repeat grid track list
    /// with flexible tracks).
    InvalidCssValue,
    /// `LUM3018` (warning): a `$` reference resolves to a unitless number where the property
    /// needs a length, angle or time (`gap: $gap`).
    UnitlessStyleRef,
    /// `LUM3019` (warning): a unit separated from a numeric `$` reference by whitespace
    /// (`$gap px`).
    DetachedUnit,
    /// `LUM3020` (warning): a declaration's property is not a CSS property (`colr: red`).
    UnknownProperty,
    /// `LUM3021` (error): a `$` constant whose text could end its declaration, rule or `<style>`
    /// (`{`, `}`, `;` or `<`), and is not substituted.
    UnsafeStyleRef,
}

impl CssCode {
    /// The stable public id, such as `LUM3009`.
    pub fn id(self) -> &'static str {
        match self {
            Self::UnusedSelector => "LUM3005",
            Self::HyphenatedStyleRef => "LUM3009",
            Self::CustomPropertyNeverRead => "LUM3012",
            Self::CssSyntaxError => "LUM3014",
            Self::InvalidCssIgnored => "LUM3015",
            Self::InvalidScopeSelector => "LUM3016",
            Self::InvalidCssValue => "LUM3017",
            Self::UnitlessStyleRef => "LUM3018",
            Self::DetachedUnit => "LUM3019",
            Self::UnknownProperty => "LUM3020",
            Self::UnsafeStyleRef => "LUM3021",
        }
    }

    pub fn default_severity(self) -> Severity {
        match self {
            Self::UnusedSelector
            | Self::CustomPropertyNeverRead
            | Self::InvalidCssIgnored
            | Self::InvalidCssValue
            | Self::UnitlessStyleRef
            | Self::DetachedUnit
            | Self::UnknownProperty => Severity::Warning,
            Self::HyphenatedStyleRef
            | Self::CssSyntaxError
            | Self::InvalidScopeSelector
            | Self::UnsafeStyleRef => Severity::Error,
        }
    }
}

impl std::fmt::Display for CssCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.id())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
pub struct Label {
    pub span: Span,
    pub message: String,
}

/// A text replacement in the original source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextEdit {
    pub span: Span,
    pub text: String,
}

/// A machine-applicable fix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fix {
    pub message: String,
    pub edits: Vec<TextEdit>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CssDiagnostic {
    pub code: CssCode,
    pub severity: Severity,
    pub message: String,
    pub span: Span,
    pub labels: Vec<Label>,
    pub help: Option<String>,
    pub fix: Option<Fix>,
}

impl CssDiagnostic {
    /// Creates a diagnostic with the code's default severity.
    pub fn new(code: CssCode, span: Span, message: impl Into<String>) -> Self {
        Self {
            code,
            severity: code.default_severity(),
            message: message.into(),
            span,
            labels: Vec::new(),
            help: None,
            fix: None,
        }
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

    /// Moves every span by `delta` bytes (block-relative spans → source spans).
    pub(crate) fn offset(mut self, delta: u32) -> Self {
        let shift = |span: &mut Span| {
            span.start += delta;
            span.end += delta;
        };
        shift(&mut self.span);
        for label in &mut self.labels {
            shift(&mut label.span);
        }
        if let Some(fix) = &mut self.fix {
            for edit in &mut fix.edits {
                shift(&mut edit.span);
            }
        }
        self
    }
}
