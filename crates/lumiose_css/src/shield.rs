//! Keeps declarations that make Lightning CSS panic out of its typed parser.
//!
//! Lightning CSS 1.0.0-alpha.72 panics on valid CSS such as `scale: abs(-50%)`: its
//! `<percentage>` parser has an `unreachable!()` for a math function that does not reduce to a
//! plain value. The panic is caught (`guarded`), but the whole block would then be left out
//! (`LUM3014`). So a declaration whose value panics in the value checks is given a custom
//! property name of the same length before Lightning CSS parses the block: Lightning CSS keeps a
//! custom property's value as written. After printing, the name is put back. The same length
//! keeps every source position and the source map unchanged.
//!
//! This is a stopgap for the panic that parcel-bundler/lightningcss#1329 removed upstream (the
//! parser now returns an error, and the declaration is kept unparsed), which is not in a release
//! yet. Remove this module once Lightning CSS is upgraded to a release with #1329;
//! `a_declaration_that_panics_is_kept_as_written` in `tests/robustness.rs` must still pass
//! without it.

use std::ops::Range;

use crate::edits::Edit;

/// A declaration name replaced by a placeholder custom property.
pub(crate) struct Shield {
    pub placeholder: String,
    pub name: String,
}

/// Replaces the names at `names` (ranges in `content`) with placeholders, recording each in
/// `shields`. `taken` says whether a candidate already appears in text that reaches the output.
/// A name too short for a free placeholder is left alone: the block then fails as before.
pub(crate) fn guard(
    content: &str,
    names: &[Range<usize>],
    taken: impl Fn(&str) -> bool,
    shields: &mut Vec<Shield>,
) -> Vec<Edit> {
    let mut edits = Vec::new();
    for range in names {
        let name = &content[range.clone()];
        let used = |candidate: &str| {
            taken(candidate) || shields.iter().any(|shield| shield.placeholder == candidate)
        };
        if let Some(placeholder) = placeholder(name.len(), used) {
            edits.push(Edit::replace(range.clone(), placeholder.clone()));
            shields.push(Shield {
                placeholder,
                name: name.to_owned(),
            });
        }
    }
    edits
}

/// Puts the original names back in the printed CSS.
pub(crate) fn restore(css: &mut String, shields: &[Shield]) {
    for shield in shields {
        if css.contains(&shield.placeholder) {
            *css = css.replace(&shield.placeholder, &shield.name);
        }
    }
}

/// A custom property name of `len` bytes that is not `used`: `--` and a base-36 counter.
fn placeholder(len: usize, used: impl Fn(&str) -> bool) -> Option<String> {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let width = len.checked_sub(2).filter(|width| *width > 0)?;
    // Enough tries to pass every placeholder a file can plausibly hold, without scanning a
    // huge file thousands of times.
    let tries = 36usize.saturating_pow(width.min(3) as u32).min(4096);
    for mut n in 0..tries {
        let mut suffix = vec![b'z'; width];
        for slot in suffix.iter_mut().rev() {
            *slot = DIGITS[n % 36];
            n /= 36;
            if n == 0 {
                break;
            }
        }
        let candidate = format!("--{}", String::from_utf8_lossy(&suffix));
        if !used(&candidate) {
            return Some(candidate);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholders_keep_the_length_and_avoid_taken_names() {
        assert_eq!(placeholder(5, |_| false).as_deref(), Some("--zz0"));
        assert_eq!(placeholder(5, |c| c == "--zz0").as_deref(), Some("--zz1"));
        assert_eq!(placeholder(3, |_| false).as_deref(), Some("--0"));
        assert_eq!(placeholder(2, |_| false), None);
        assert_eq!(placeholder(3, |_| true), None);
    }

    #[test]
    fn names_are_restored() {
        let content = ".a { scale: abs(-50%) }";
        let mut shields = Vec::new();
        let names = [Range { start: 5, end: 10 }];
        let edits = guard(content, &names, |c| content.contains(c), &mut shields);
        assert_eq!(edits.len(), 1);
        assert_eq!(edits[0].text, "--zz0");
        let mut css = ".a{--zz0:abs(-50%)}".to_owned();
        restore(&mut css, &shields);
        assert_eq!(css, ".a{scale:abs(-50%)}");
    }
}
