---
id: TASK-461
title: 'Combobox: arrow keys into the chips'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 13:42'
updated_date: '2026-10-16 21:39'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
priority: low
ordinal: 459000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-454 L32 (Prism). With `multiple`, the chips are not reachable from the keyboard: Base UI moves into them with Arrow Left at the input's start and removes one with Backspace or Delete. Ours only removes the last value with Backspace in an empty input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Arrow Left at the start of the input moves into the chips, arrows move between them, Backspace or Delete removes the focused one, as Base UI's, with tests in every engine
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Halo): claimed (final M12 batch; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): done in combobox.script.ts, additive (merged main first; Beacon's TASK-465 is in the same file). Chips get tabIndex -1. In the input, with multiple, the arrow toward the chips (Left, Right right to left) at caret 0 without selection or Shift focuses the last chip. A chip's keys (#onChipKey, checked first in the keydown handler): the arrows move to the previous or next chip, past the last back to the input; Backspace and Delete remove its value and move focus to the chip before it, else the one in its place, else the input. Theme: a focus ring on chips. e2e 'the arrows reach the chips from the input; Backspace and Delete remove one' fails without the change in dev, build, Firefox and WebKit. combobox.md keyboard table. Note: removing a value clears the search text, as choosing one already did with multiple.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Combobox's chips are reachable with the arrow keys from the input's start, and Backspace or Delete removes the focused one, as in Base UI; tests in every engine.
<!-- SECTION:FINAL_SUMMARY:END -->
