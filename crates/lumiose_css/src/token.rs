//! Scope tokens and how elements carry them (spec §4.6.2, decision-85): a stable hash per scope,
//! marked on elements as an attribute (`data-lum-<hash>`) or a class (`lum-<hash>`), and matched
//! with or without a specificity bump.

/// The token of a scope: a stable 8-character base36 hash of the root-relative `path`
/// (`\` is treated as `/`), plus the component name for a component scope.
///
/// The compiler marks every element of the scope's templates with [`ScopeStyle::marker`] and
/// passes the same token to [`crate::process`] in [`crate::Scope`].
pub fn scope_token(path: &str, component: Option<&str>) -> String {
    const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0100_0000_01b3;
    let mut hash = OFFSET;
    let mut feed = |byte: u8| hash = (hash ^ u64::from(byte)).wrapping_mul(PRIME);
    for byte in path.bytes() {
        feed(if byte == b'\\' { b'/' } else { byte });
    }
    if let Some(name) = component {
        feed(0);
        name.bytes().for_each(&mut feed);
    }
    base36(mix(hash) % 36u64.pow(8), 8)
}

/// The legacy attribute name for a token, `data-l-<token>`: the compiler's markers until it takes
/// a [`ScopeStyle`] (TASK-573), which then replaces this function.
pub fn scope_attribute(token: &str) -> String {
    format!("data-l-{token}")
}

/// The default [`ScopeStyle::namespace`].
pub const DEFAULT_NAMESPACE: &str = "lum";

/// How elements carry a scope (decision-85).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ScopeStrategy {
    /// An empty attribute, `data-<namespace>-<token>`.
    #[default]
    Attribute,
    /// A class, `<namespace>-<token>`.
    Class,
}

/// What the scope adds to a selector's specificity (decision-85).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ScopeSpecificity {
    /// (0,1,0): `.note[data-lum-t]`, `.note.lum-t`.
    #[default]
    Default,
    /// Nothing: `.note:where([data-lum-t])`, `.note:where(.lum-t)`.
    Zero,
}

/// The `scopedStyles` option of the Vite plugins: how elements carry scope tokens and how scoped
/// selectors match them. Templates and CSS agree when both use the same style.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScopeStyle<'a> {
    pub strategy: ScopeStrategy,
    pub specificity: ScopeSpecificity,
    /// The start of the attribute or class name; see [`validate_namespace`].
    pub namespace: &'a str,
}

impl Default for ScopeStyle<'_> {
    fn default() -> Self {
        Self {
            strategy: ScopeStrategy::default(),
            specificity: ScopeSpecificity::default(),
            namespace: DEFAULT_NAMESPACE,
        }
    }
}

impl ScopeStyle<'_> {
    /// What an element of the scope carries: the attribute name `data-<namespace>-<token>` or the
    /// class name `<namespace>-<token>`, depending on [`Self::strategy`].
    pub fn marker(&self, token: &str) -> String {
        match self.strategy {
            ScopeStrategy::Attribute => format!("data-{}-{token}", self.namespace),
            ScopeStrategy::Class => format!("{}-{token}", self.namespace),
        }
    }

    /// The simple selector that scoped selectors get: `[data-lum-t]` or `.lum-t`, inside
    /// `:where()` for [`ScopeSpecificity::Zero`].
    pub fn selector(&self, token: &str) -> String {
        let marker = self.marker(token);
        let simple = match self.strategy {
            ScopeStrategy::Attribute => format!("[{marker}]"),
            ScopeStrategy::Class => format!(".{marker}"),
        };
        match self.specificity {
            ScopeSpecificity::Default => simple,
            ScopeSpecificity::Zero => format!(":where({simple})"),
        }
    }
}

/// Checks a [`ScopeStyle::namespace`]: a lowercase letter, then lowercase letters, digits and
/// hyphens, so that it is a valid attribute name part and CSS identifier without escaping.
pub fn validate_namespace(namespace: &str) -> Result<(), String> {
    let mut chars = namespace.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if valid {
        Ok(())
    } else {
        Err(format!(
            "invalid scopedStyles.namespace `{namespace}`: it must start with a lowercase letter \
             and contain only lowercase letters, digits and hyphens"
        ))
    }
}

/// The `fmix64` finalizer of MurmurHash3: spreads FNV's weak low bits before truncation.
fn mix(mut hash: u64) -> u64 {
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(0xff51_afd7_ed55_8ccd);
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(0xc4ce_b9fe_1a85_ec53);
    hash ^ (hash >> 33)
}

fn base36(mut value: u64, width: usize) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = vec![b'0'; width];
    for slot in out.iter_mut().rev() {
        *slot = DIGITS[(value % 36) as usize];
        value /= 36;
    }
    String::from_utf8(out).expect("base36 digits are ASCII")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_stable_and_distinct() {
        let file = scope_token("src/routes/index.stsx", None);
        assert_eq!(file.len(), 8);
        assert!(file.bytes().all(|b| b.is_ascii_alphanumeric()));
        // Golden values: changing the hash changes every emitted stylesheet.
        assert_eq!(file, scope_token("src\\routes\\index.stsx", None));
        assert_eq!(file, "4acv61js");
        assert_eq!(
            scope_token("src/routes/index.stsx", Some("Card")),
            "j7uaew0t"
        );
        assert_ne!(file, scope_token("src/routes/index.stsx", Some("Card")));
        assert_ne!(
            scope_token("src/a.stsx", Some("Card")),
            scope_token("src/a.stsx", Some("Cards"))
        );
        assert_eq!(scope_attribute("abc"), "data-l-abc");
    }

    #[test]
    fn markers_and_selectors_follow_the_style() {
        let style = |strategy, specificity| ScopeStyle {
            strategy,
            specificity,
            namespace: "lum",
        };
        let cases = [
            (
                ScopeStrategy::Attribute,
                ScopeSpecificity::Default,
                "data-lum-t",
                "[data-lum-t]",
            ),
            (
                ScopeStrategy::Attribute,
                ScopeSpecificity::Zero,
                "data-lum-t",
                ":where([data-lum-t])",
            ),
            (
                ScopeStrategy::Class,
                ScopeSpecificity::Default,
                "lum-t",
                ".lum-t",
            ),
            (
                ScopeStrategy::Class,
                ScopeSpecificity::Zero,
                "lum-t",
                ":where(.lum-t)",
            ),
        ];
        for (strategy, specificity, marker, selector) in cases {
            assert_eq!(style(strategy, specificity).marker("t"), marker);
            assert_eq!(style(strategy, specificity).selector("t"), selector);
        }
        assert_eq!(
            ScopeStyle::default(),
            style(ScopeStrategy::Attribute, ScopeSpecificity::Default)
        );
        let custom = ScopeStyle {
            namespace: "x-1",
            ..ScopeStyle::default()
        };
        assert_eq!(custom.marker("t"), "data-x-1-t");
    }

    #[test]
    fn namespaces_are_validated() {
        for valid in ["lum", "l", "my-app", "a1-b2"] {
            assert_eq!(validate_namespace(valid), Ok(()), "{valid}");
        }
        for invalid in ["", "Lum", "1lum", "-lum", "lum_x", "lum.x", "lüm", "lum x"] {
            assert!(validate_namespace(invalid).is_err(), "{invalid}");
        }
    }
}
