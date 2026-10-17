---
id: TASK-477
title: Settle the LUM2001 warnings spreads surface in @lumiose/ui
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-17 00:00'
updated_date: '2026-10-17 01:23'
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
- [x] #1 Each of the three objects either follows its props or signals (a function called in the spread) or is documented as an initial value
- [x] #2 A test covers any behaviour change
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17: @lumiose/ui's compile-cleanly test (src/compile.test.ts) failed on these three warnings, so TASK-466 wraps each object in `untrack(() => …)` with a comment pointing here: the same values, read once, as before (component setup is untracked anyway). Decide per object whether it should follow its props or signals (a function called in the spread) or stay an initial value (drop the comment).

Halo (2026-10-17): all three follow their props now, as functions called in the spread (the untrack wrappers and their comments are gone). Combobox.List: side, align, the offsets and style (combobox.popup stays structural). Popover.Trigger: openOnHover, delay and closeDelay; the script reads them from the trigger at each hover, so they take effect at once (the Toolbar's disabled state stays read once, as before). NumberField.Input: min, max and step (native) or aria-valuemin/max (formatted); whether it is formatted stays a setup decision, and aria-valuenow/aria-valuetext stay the server HTML's, which <lu-number-field> keeps current from then on. Test: src/live-props.dom.test.tsx renders each part with signals and checks the attributes follow; all three fail on the previous code. compile.test.ts passes with no LUM2001. The docs never said these were read once, so none needed a change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Combobox.List's placement and style, Popover.Trigger's hover settings and NumberField.Input's limits now follow their props (functions called in the spread); the value's ARIA on a formatted Input stays the element's. A DOM test covers all three.
<!-- SECTION:FINAL_SUMMARY:END -->
