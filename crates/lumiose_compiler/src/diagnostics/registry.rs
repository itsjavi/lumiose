//! The diagnostics registry: the single source of truth for Lumiose diagnostic codes (spec §5.4).
//!
//! Codes are stable forever. Add new codes at the end of their range; never renumber or
//! reuse one. The docs pages and `lumiose explain` are generated from this table.

use super::Severity;

/// Static metadata of one diagnostic code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiagnosticInfo {
    pub code: Code,
    /// The stable public identifier, such as `LUM1004`.
    pub id: &'static str,
    pub default_severity: Severity,
    /// A short title, used as the docs page heading.
    pub title: &'static str,
}

impl DiagnosticInfo {
    /// The docs topic for this code, as resolved by `lumiose docs` and `lumiose explain`: its page
    /// `docs/errors/<id>.md` (`https://lumiose.dev/errors/<id>` online).
    pub fn docs(&self) -> String {
        format!("errors/{}", self.id)
    }
}

macro_rules! registry {
    ($($variant:ident = $id:literal, $severity:ident, $title:literal;)*) => {
        /// A Lumiose diagnostic code. See [`REGISTRY`] for the metadata of each one.
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
        #[cfg_attr(feature = "serde", derive(serde::Serialize))]
        pub enum Code {
            $($variant,)*
        }

        /// Every registered diagnostic, in code order.
        pub static REGISTRY: &[DiagnosticInfo] = &[
            $(DiagnosticInfo {
                code: Code::$variant,
                id: $id,
                default_severity: Severity::$severity,
                title: $title,
            },)*
        ];
    };
}

registry! {
    // 1xxx file format
    SyntaxError = "LUM1001", Error, "Syntax error";
    Unsupported = "LUM1002", Error, "Unsupported by this compiler version";
    ScannerAmbiguity = "LUM1003", Warning, "Scanner ambiguity";
    UnclosedStyle = "LUM1004", Error, "Unclosed `<style>` block";
    UnknownStyleAttribute = "LUM1005", Error, "Unknown `<style>` attribute";
    RawCssInTsx = "LUM1006", Error, "Raw CSS in a `.tsx` file";
    AwaitUsingInComponent = "LUM1007", Error, "`await using` in a component";
    ScriptInMarkdown = "LUM1008", Error, "`<script>` in a Markdown file";
    ContentNestedTooDeep = "LUM1009", Error, "Content nested too deeply";
    SourceNestedTooDeep = "LUM1010", Error, "Source nested too deeply";
    // 2xxx reactivity
    StaleDerivedValue = "LUM2001", Warning, "Stale derived value";
    WriteDuringRender = "LUM2002", Error, "Signal write during render";
    ReactiveEarlyReturn = "LUM2003", Error, "Reactive early return";
    ComponentCalledAsFunction = "LUM2004", Error, "Component called as a function";
    ChildrenInsertedTwice = "LUM2005", Warning, "Children inserted twice";
    ReactiveIndexEscapes = "LUM2006", Warning, "Reactive index escapes its callback";
    OwnSignalReadInAsyncBody = "LUM2007", Warning, "Own signal read in an async body";
    // 3xxx styles
    UnusedSelector = "LUM3005", Warning, "Unused scoped selector";
    NonConstantStyleRef = "LUM3008", Error, "Non-constant `$` reference";
    HyphenatedStyleRef = "LUM3009", Error, "Hyphenated `$` reference";
    MisplacedStyle = "LUM3010", Error, "Misplaced `<style>` block";
    StyleAsRootOrExpression = "LUM3011", Error, "`<style>` as the root or in an expression";
    CustomPropertyNeverRead = "LUM3012", Warning, "Custom property set but never read";
    StyleRefBeforeDeclaration = "LUM3013", Error, "`$` reference before its declaration";
    CssSyntaxError = "LUM3014", Error, "CSS syntax error";
    InvalidCssIgnored = "LUM3015", Warning, "Invalid CSS ignored";
    InvalidScopeSelector = "LUM3016", Error, "Invalid `:global()` or `:deep()` selector";
    InvalidCssValue = "LUM3017", Warning, "Invalid CSS value";
    UnitlessStyleRef = "LUM3018", Warning, "Unitless number from a `$` reference";
    DetachedUnit = "LUM3019", Warning, "Unit separated from a `$` reference";
    UnknownCssProperty = "LUM3020", Warning, "Unknown CSS property";
    UnsafeStyleRef = "LUM3021", Error, "Unsafe `$` constant value";
    // 4xxx islands and boundaries
    NonExportedIsland = "LUM4001", Error, "Island component is not exported";
    NonSerializableIslandProp = "LUM4002", Error, "Non-serializable island prop";
    ServerOnlyModuleInClient = "LUM4003", Error, "Server-only module in a client graph";
    BrowserApiAtModuleScope = "LUM4004", Warning, "Browser API at module scope";
    HydrationMismatch = "LUM4006", Error, "Hydration mismatch";
    NonSerializableAwaitedValue = "LUM4007", Error, "Non-serializable awaited value";
    ModuleSignalWrittenDuringSsr = "LUM4008", Warning, "Module-scope signal written during SSR";
    UnsafeUrlBlocked = "LUM4009", Warning, "Unsafe URL blocked in a URL attribute";
    IslandPageContext = "LUM4010", Warning, "Island reads context provided by the page";
    NonSerializableStateValue = "LUM4011", Error, "Non-serializable scoped state value";
    // 5xxx routing and server
    RequestApiDuringPrerender = "LUM5001", Error, "Request API used during prerender";
    InvalidRouteFile = "LUM5002", Error, "Invalid route file";
    DuplicateRoute = "LUM5003", Error, "Duplicate route";
    HeadChangeInStreamedBoundary = "LUM5004", Error, "Head or status change inside a streamed boundary";
    StaticEndpointMethod = "LUM5005", Error, "Non-GET method in a static endpoint";
    PrerenderClientOnlyPage = "LUM5006", Error, "Prerendered page that renders only in the browser";
    LocaleRouteParam = "LUM5007", Error, "Route param named `locale`";
    // 6xxx tooling and config
    TsconfigMissingOptions = "LUM6001", Warning, "tsconfig missing options required by Lumiose";
}

impl Code {
    pub fn info(self) -> &'static DiagnosticInfo {
        &REGISTRY[self as usize]
    }

    pub fn id(self) -> &'static str {
        self.info().id
    }

    pub fn from_id(id: &str) -> Option<Self> {
        REGISTRY
            .iter()
            .find(|info| info.id == id)
            .map(|info| info.code)
    }
}

impl std::fmt::Display for Code {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.id())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_is_indexed_by_code_and_ids_are_unique_and_sorted() {
        for (index, info) in REGISTRY.iter().enumerate() {
            assert_eq!(info.code as usize, index);
            assert_eq!(Code::from_id(info.id), Some(info.code));
            assert!(
                info.id.starts_with("LUM") && info.id.len() == 7,
                "{}",
                info.id
            );
        }
        assert!(REGISTRY.windows(2).all(|w| w[0].id < w[1].id));
    }

    /// `lumiose_css` emits these (TASK-76, TASK-67); `css::convert()` drops unregistered ids.
    #[test]
    fn css_value_warnings_are_registered() {
        for (id, code, title) in [
            ("LUM3017", Code::InvalidCssValue, "Invalid CSS value"),
            (
                "LUM3018",
                Code::UnitlessStyleRef,
                "Unitless number from a `$` reference",
            ),
            (
                "LUM3019",
                Code::DetachedUnit,
                "Unit separated from a `$` reference",
            ),
            ("LUM3020", Code::UnknownCssProperty, "Unknown CSS property"),
        ] {
            let info = code.info();
            assert_eq!(Code::from_id(id), Some(code));
            assert_eq!(info.default_severity, Severity::Warning);
            assert_eq!(info.title, title);
        }
    }
}
