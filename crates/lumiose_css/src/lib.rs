//! Lumiose CSS pipeline for the raw-CSS `<style>` blocks of a `.stsx` file (spec doc-1 §4.6).
//!
//! The compiler scans a file, resolves its `$name` constants and hands this crate the
//! blocks with their scopes. [`process`] returns one stylesheet for the file, an optional
//! source map back to the `.stsx` source and the CSS diagnostics. The crate does not depend
//! on `lumiose_compiler`: the compiler maps its scanner output into [`CssInput`] and converts
//! [`CssDiagnostic`]s into its own diagnostics (same shape, same `LUM` ids).
//!
//! # Behaviour
//!
//! - **Scopes.** A [`Scope::File`], [`Scope::Component`] or [`Scope::Subtree`] block is scoped
//!   with [`CssInput::scope_style`]'s [`ScopeStyle::selector`]`(token)`, appended to the last
//!   compound of every selector, before any pseudo-element: `[data-lum-<token>]` by default (a
//!   (0,1,0) specificity bump), `.lum-<token>` with the class strategy, either inside `:where()`
//!   with zero specificity (decision-85). Use [`scope_token`] and [`ScopeStyle::marker`] so
//!   that templates and CSS agree. [`Scope::Global`] blocks are emitted unscoped.
//! - **`:global(sel)`** leaves `sel` unscoped; the token goes on the last compound that still
//!   has a scoped part (a type, class, id, attribute, `*` or `&`), so `.a :global(.b)` is
//!   `.a[t] .b` and a selector made only of `:global()` parts is fully global.
//!   **`:deep(sel)`** scopes only what is to its left: `.a :deep(.b)` is `.a[t] .b`, a leading
//!   `:deep(.b)` is `[t] .b`, and in a nested rule it is relative to the (already scoped)
//!   parent. A compound containing `&` is never given the token again: the parent has it.
//! - **`@keyframes`** names in a scoped block get the suffix `-<token>`. `animation` and
//!   `animation-name` references are rewritten when the name is defined in a visible scope:
//!   the block's own, then (for a [`Scope::Subtree`]) its enclosing subtrees from the
//!   innermost, then the file's. Other names are left alone.
//! - **Custom properties** are never scoped or renamed. Lightning CSS keeps their values as
//!   raw tokens, so lumiose_css folds their math itself: a math function that reduces to a
//!   single number, percentage, length, angle or time is replaced by it (`--x: calc(8 * 2px)`
//!   is `16px`), kept in `calc()` when the bare value could behave differently at the use
//!   site (negative values, fractional numbers). `var()`, `env()` and units that only resolve
//!   at runtime (`calc(100% - 16px)`) leave the function untouched. Typed properties get the
//!   same reduction from Lightning CSS (`tests/fixtures/math.stsx`).
//! - **Negative math in non-negative properties** (`padding-left: calc($a - $b)` with `$b > $a`)
//!   is wrapped in `max(0px, …)`, so it folds to `0px` as the browser would clamp it. The
//!   pinned Lightning CSS folds it to a negative literal, which browsers drop
//!   (lightningcss#1000, fixed by #1329 but unreleased); the guard goes away after upgrading.
//! - **SVG blocks** ([`CssBlock::svg`]) are native SVG CSS that stays verbatim in the
//!   template: they are never extracted, scoped or substituted, so `process` skips them.
//! - **Order.** File-level blocks (file scope and top-level `<style global>`) come first,
//!   then component-level blocks, each group in source order.
//! - **`$name` references** are substituted only in declaration values and in `@media`,
//!   `@container` and `@supports` preludes, never in selectors (where `[attr$=…]` keeps its
//!   CSS meaning), property names, strings, comments or `url()`. See [`find_refs`]. Strings
//!   are inserted as raw CSS text, numbers as-is. A reference without a [`ResolvedRef`] is
//!   left untouched: the compiler reports why (`LUM3008`, `LUM3013`).
//! - **Lightning CSS** parses each block with error recovery, lowers nesting and prefixes for
//!   [`CssOptions::targets`], and minifies when [`CssOptions::minify`] is set.
//! - **Tailwind CSS v4 at-rules** (`@apply`, `@reference`, `@theme`, `@utility`, `@variant`,
//!   `@custom-variant`, `@slot`, `@source`, `@plugin`, `@config`) are kept as written, like any
//!   unknown at-rule, for Tailwind's Vite plugin to process after Lumiose. Unlike other unknown
//!   at-rules they are not reported (`LUM3015`); the rules around them are scoped as usual.
//! - **Value checks.** Lightning CSS keeps a value it cannot parse as written, so browsers
//!   drop the declaration silently. Such values are warned about (`LUM3017`, conservatively:
//!   valid CSS the pinned Lightning CSS does not parse yet is never reported), as are unitless
//!   numbers from `$` constants where a length, angle or time is needed (`LUM3018`) and a unit
//!   separated from a constant (`$gap px`, `LUM3019`). Output is unchanged.
//! - **Declaration checks.** Lightning CSS also keeps unknown property names (`colr`) and empty
//!   values (`color: ;`), and closes an unclosed `{` at the end of the block, all without a
//!   warning. Unknown properties are warned about (`LUM3020`, with a fix for close typos;
//!   custom, vendor-prefixed and descriptor names are not checked), empty values too
//!   (`LUM3017`), and an unclosed `{` is an error (`LUM3014`).
//!
//! # Source maps
//!
//! Maps are composed rather than padded. Each block is rewritten (substitutions, scope
//! attributes) into its own text with a position map back to the original block; Lightning
//! CSS prints a map against those texts, and every mapping is then rewritten through the
//! position map to a line and UTF-16 column of the `.stsx` file. Padding the block with
//! whitespace to its original offset was rejected: `$ref` substitution and scope attributes
//! change lengths, so padded columns drift on every edited line. The map has one source,
//! [`CssInput::filename`], with the full `.stsx` text as its `sourcesContent`.
//!
//! # Diagnostics
//!
//! Spans are UTF-8 byte offsets into [`CssInput::source`]. Codes are listed on [`CssCode`].

mod ast;
mod clamp;
mod diagnostics;
mod edits;
mod fold;
mod known_properties;
mod lines;
mod prepass;
mod process;
mod properties;
mod selector;
mod sourcemap;
mod token;
mod values;

use std::collections::HashSet;

pub use diagnostics::{CssCode, CssDiagnostic, Fix, Label, Severity, TextEdit};
pub use lightningcss::targets::{Browsers, Targets};
pub use prepass::{RefSite, find_refs};
pub use process::process;
pub use token::{
    DEFAULT_NAMESPACE, ScopeSpecificity, ScopeStrategy, ScopeStyle, scope_token, validate_namespace,
};

/// A half-open byte range `start..end` in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, PartialOrd, Ord)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub const fn new(start: u32, end: u32) -> Self {
        Self { start, end }
    }

    pub(crate) fn from_usize(start: usize, end: usize) -> Self {
        Self::new(to_u32(start), to_u32(end))
    }

    pub fn range(self) -> std::ops::Range<usize> {
        self.start as usize..self.end as usize
    }
}

pub(crate) fn to_u32(offset: usize) -> u32 {
    u32::try_from(offset).expect("source files larger than 4 GiB are not supported")
}

/// The scope a block applies to (spec §4.6.1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// `<style global>`: unscoped. `component` names the enclosing component for a
    /// component-level block; it only decides the output order.
    Global { component: Option<String> },
    /// A top-level block: every template in the file carries the token.
    File { token: String },
    /// A block directly under a component's root element: every element of the component's
    /// templates carries the token.
    Component { name: String, token: String },
    /// A block under a nested element of a component's JSX (decision-23): only the elements
    /// lexically inside that element carry the token. They also carry the tokens of the
    /// enclosing subtrees, so the block sees their `@keyframes` (innermost first, then the
    /// file's).
    Subtree {
        /// The component.
        name: String,
        token: String,
        /// The tokens of the enclosing style-bearing subtrees of the same component (its root
        /// included), outermost first.
        outer: Vec<String>,
        /// The enclosing element's tag (`p`, `Card`), for messages.
        element: String,
    },
}

impl Scope {
    /// The scope token, `None` for global blocks.
    pub fn token(&self) -> Option<&str> {
        match self {
            Self::Global { .. } => None,
            Self::File { token } | Self::Component { token, .. } | Self::Subtree { token, .. } => {
                Some(token)
            }
        }
    }

    pub(crate) fn is_component_level(&self) -> bool {
        match self {
            Self::Global { component } => component.is_some(),
            Self::File { .. } => false,
            Self::Component { .. } | Self::Subtree { .. } => true,
        }
    }

    /// The tokens whose `@keyframes` a block of this scope sees besides its own and the
    /// file's, from the innermost.
    pub(crate) fn enclosing(&self) -> &[String] {
        match self {
            Self::Subtree { outer, .. } => outer,
            _ => &[],
        }
    }
}

/// One `<style>` block of the file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CssBlock {
    /// The CSS text between `<style …>` and `</style>`.
    pub content: Span,
    pub scope: Scope,
    /// Inside an `<svg>` subtree: native SVG CSS, left verbatim in the template and skipped.
    pub svg: bool,
}

/// A resolved `$name` constant.
#[derive(Debug, Clone, PartialEq)]
pub enum RefValue {
    /// Inserted as raw CSS text.
    String(String),
    /// Inserted as a plain number (`8`, `0.5`); add units with `calc($n * 1px)`.
    Number(f64),
}

/// The value of the `$name` reference at `span` (`$` through the last path segment, as
/// the scanner reports it).
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedRef {
    pub span: Span,
    pub value: RefValue,
}

/// The elements of one scope's templates, for the unused-selector check (`LUM3005`).
///
/// The check is conservative: it only looks at the type, class and id selectors of the
/// compound that receives the scope token, and skips a kind of selector whose values are
/// computed at runtime (`dynamic_*`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ElementInventory {
    /// The scope token these elements carry.
    pub token: String,
    /// Intrinsic tag names, lowercase.
    pub tags: HashSet<String>,
    /// Static classes on intrinsic elements.
    pub classes: HashSet<String>,
    /// Classes passed as `class` to component elements. Their element is rendered by the
    /// child component (class passthrough), so a compound using one is not tag- or id-checked.
    pub component_classes: HashSet<String>,
    pub ids: HashSet<String>,
    pub dynamic_tags: bool,
    pub dynamic_classes: bool,
    pub dynamic_ids: bool,
}

/// A custom property set through a JSX `style` prop, for `LUM3012`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomPropertySet {
    /// The property name, including `--`.
    pub name: String,
    /// Where it is set, for the diagnostic.
    pub span: Span,
}

/// Everything [`process`] needs to know about one file.
#[derive(Debug, Clone, Copy, Default)]
pub struct CssInput<'a> {
    /// The name written to the source map's `sources` (typically the module id).
    pub filename: &'a str,
    /// The full `.stsx` source. Every span is a byte range into it.
    pub source: &'a str,
    pub blocks: &'a [CssBlock],
    pub refs: &'a [ResolvedRef],
    /// Element inventories by scope token. `LUM3005` runs only for scopes listed here.
    pub inventories: &'a [ElementInventory],
    /// Custom properties set in this file's `style` props; those no `var()` in this file's
    /// CSS reads are reported as `LUM3012`. Leave empty to skip the check (for example when
    /// the property is meant for CSS in another file; see [`CssOutput::custom_properties_read`]).
    pub custom_properties_set: &'a [CustomPropertySet],
    /// How scoped selectors match the markers the templates carry (decision-85).
    pub scope_style: ScopeStyle<'a>,
}

/// Build options shared by every file.
#[derive(Debug, Clone, Copy, Default)]
pub struct CssOptions {
    /// Browser targets for nesting lowering and prefixing; the default keeps modern syntax.
    pub targets: Targets,
    pub minify: bool,
    /// Produce [`CssOutput::map`].
    pub source_map: bool,
}

/// The result of [`process`].
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CssOutput {
    /// The file's stylesheet; empty when no block yields CSS.
    pub css: String,
    /// A source map (JSON, version 3) from `css` to the `.stsx` source.
    pub map: Option<String>,
    pub diagnostics: Vec<CssDiagnostic>,
    /// Every custom property read through `var()` in the file's CSS, sorted. Hosts can use it
    /// for a cross-file `LUM3012` check.
    pub custom_properties_read: Vec<String>,
}

/// Lightning CSS targets from browserslist queries, such as `["chrome 100", "safari 16"]`.
#[cfg(feature = "browserslist")]
pub fn browserslist_targets<S: AsRef<str>>(queries: &[S]) -> Result<Targets, String> {
    Browsers::from_browserslist(queries.iter().map(AsRef::as_ref))
        .map(|browsers| Targets {
            browsers,
            ..Targets::default()
        })
        .map_err(|error| error.to_string())
}
