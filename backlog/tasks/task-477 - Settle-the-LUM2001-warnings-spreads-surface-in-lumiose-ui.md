---
id: TASK-477
title: Settle the LUM2001 warnings spreads surface in @lumiose/ui
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-17 00:00'
updated_date: '2026-10-17 00:10'
labels:
  - ui
  - diagnostics
dependencies: []
priority: low
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-466 (Photon, 2026-10-17), LUM2001 also counts values used through a spread. It now reports three setup-time objects in @lumiose/ui that are only spread: Combobox.List's `popover` (combobox.tsx, reads `style` and the placement props once), NumberField.Input's `spin` (number-field.tsx, reads field.min/max/step once) and Popover.Trigger's `hover` (popover.tsx, reads openOnHover/delay/closeDelay once). Each either goes stale when the prop or signal changes, or is meant as an initial value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of the three objects either follows its props or signals (a function called in the spread) or is documented as an initial value
- [ ] #2 A test covers any behaviour change
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17: @lumiose/ui's compile-cleanly test (src/compile.test.ts) failed on these three warnings, so TASK-466 wraps each object in `untrack(() => …)` with a comment pointing here: the same values, read once, as before (component setup is untracked anyway). Decide per object whether it should follow its props or signals (a function called in the spread) or stay an initial value (drop the comment).
<!-- SECTION:NOTES:END -->
