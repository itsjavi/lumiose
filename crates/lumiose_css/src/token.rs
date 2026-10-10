//! Scope tokens: `data-l-<hash>` (spec §4.6.2).

/// The token of a scope: a stable 8-character base36 hash of the root-relative `path`
/// (`\` is treated as `/`), plus the component name for a component scope.
///
/// The compiler stamps `data-l-<token>` on every element of the scope's templates and passes
/// the same token to [`crate::process`] in [`crate::Scope`].
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

/// The attribute name for a token: `data-l-<token>`.
pub fn scope_attribute(token: &str) -> String {
    format!("data-l-{token}")
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
}
