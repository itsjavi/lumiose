---
id: TASK-539
title: 'ui: ToggleGroup forces a layout on every new value array'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
labels:
  - ui
  - performance
dependencies: []
priority: medium
ordinal: 532000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). `set value` calls `#rove()`, which calls `checkVisibility()` per toggle. A parent that passes `value={[x()]}` and re-reads it on unrelated updates gets a synchronous layout in the middle of each render (the port measured a filter switch at about 381 ms instead of 205 ms at 4x CPU until it passed a stable array).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Setting a value equal to the current one does nothing (no rove, no layout)
- [x] #2 A test or a forced-layout count shows it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (commit 884d1791). The element's value setter writes aria-pressed only where it differs and moves the tab stop (checkVisibility per toggle, a layout) only when something changed: an equal value writes nothing and measures nothing. Test: toggle-group.script.dom.test.ts counts aria-pressed mutation records and checkVisibility calls (none for an equal value; fails without the fix). toggle-group script +0.02 kB brotli (0.94 -> 0.96).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Setting ToggleGroup's element value to the toggles already pressed does nothing: no attribute write, no rove, no layout. A unit test counts the writes and the measuring.
<!-- SECTION:FINAL_SUMMARY:END -->
