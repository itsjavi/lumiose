//! Text edits on one block and the position map from the edited text back to the original.

use std::ops::Range;

/// Replaces `range` of the original block text with `text` (an insertion when empty).
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Edit {
    pub range: Range<usize>,
    pub text: String,
}

impl Edit {
    pub fn insert(at: usize, text: impl Into<String>) -> Self {
        Self {
            range: at..at,
            text: text.into(),
        }
    }

    pub fn delete(range: Range<usize>) -> Self {
        Self {
            range,
            text: String::new(),
        }
    }

    pub fn replace(range: Range<usize>, text: impl Into<String>) -> Self {
        Self {
            range,
            text: text.into(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct Anchor {
    /// Where the replacement text starts in the edited text, and its length.
    new_start: usize,
    new_len: usize,
    /// The replaced range of the original.
    old_start: usize,
    old_end: usize,
}

/// The edited text of a block and a map from its offsets to original offsets.
#[derive(Debug, Clone)]
pub(crate) struct Rewritten {
    pub text: String,
    anchors: Vec<Anchor>,
}

impl Rewritten {
    /// Applies `edits` to `original`. Edits must not overlap; they are applied in
    /// `(start, end)` order, so an insertion lands before a replacement at the same offset.
    pub fn apply(original: &str, mut edits: Vec<Edit>) -> Self {
        edits.sort_by_key(|edit| (edit.range.start, edit.range.end));
        let mut text = String::with_capacity(original.len());
        let mut anchors = Vec::with_capacity(edits.len());
        let mut last = 0;
        for edit in edits {
            debug_assert!(edit.range.start >= last, "overlapping edits: {edit:?}");
            if edit.range.start < last {
                continue;
            }
            text.push_str(&original[last..edit.range.start]);
            anchors.push(Anchor {
                new_start: text.len(),
                new_len: edit.text.len(),
                old_start: edit.range.start,
                old_end: edit.range.end,
            });
            text.push_str(&edit.text);
            last = edit.range.end;
        }
        text.push_str(&original[last..]);
        Self { text, anchors }
    }

    /// Maps an offset of the edited text to the original text. Offsets inside replacement
    /// text map to the start of the range it replaced.
    pub fn original_offset(&self, offset: usize) -> usize {
        let index = self
            .anchors
            .partition_point(|anchor| anchor.new_start <= offset);
        let Some(anchor) = index.checked_sub(1).map(|i| self.anchors[i]) else {
            return offset;
        };
        let replacement_end = anchor.new_start + anchor.new_len;
        if offset < replacement_end {
            anchor.old_start
        } else {
            anchor.old_end + (offset - replacement_end)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applies_edits_and_maps_offsets_back() {
        let original = ".a { width: $w; } .b {}";
        let rewritten = Rewritten::apply(
            original,
            vec![
                Edit::replace(12..14, "100px"),
                Edit::insert(2, "[t]"),
                Edit::delete(18..19),
            ],
        );
        assert_eq!(rewritten.text, ".a[t] { width: 100px; } b {}");
        assert_eq!(rewritten.original_offset(0), 0);
        assert_eq!(rewritten.original_offset(2), 2); // inside the insertion
        assert_eq!(rewritten.original_offset(5), 2);
        assert_eq!(rewritten.original_offset(6), 3);
        assert_eq!(rewritten.original_offset(15), 12); // inside `100px`
        assert_eq!(rewritten.original_offset(20), 14);
        assert_eq!(rewritten.original_offset(24), 19); // after the deletion
        assert_eq!(
            rewritten.original_offset(rewritten.text.len()),
            original.len()
        );
    }

    #[test]
    fn insertion_precedes_replacement_at_the_same_offset() {
        let rewritten = Rewritten::apply(
            ".a:deep(.b)",
            vec![
                Edit::replace(2..8, " "),
                Edit::insert(2, "[t]"),
                Edit::delete(10..11),
            ],
        );
        assert_eq!(rewritten.text, ".a[t] .b");
    }
}
