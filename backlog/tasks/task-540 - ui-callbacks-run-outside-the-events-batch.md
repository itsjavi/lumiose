---
id: TASK-540
title: 'ui: callbacks run outside the event''s batch'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
labels:
  - ui
dependencies: []
priority: low
ordinal: 533000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). ui callbacks (`onCheckedChange`, `onValueChange`, …) run from native `on:` listeners, not inside the delegated handlers' batch, so their signal writes flush in a microtask after the event. Users see no difference, but tests and timings that read the DOM right after the event see stale content, and several writes in one callback render separately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ui callbacks run inside batch(), like delegated event handlers, or the docs say why not
- [x] #2 A test shows the DOM is current right after the event
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (commit dadcf620). Every native on: listener of the components (38 in 26 components) runs through batched() (packages/ui/src/batched.ts: batch() around the listener), and so do Field's invalid, reset and submit listeners and the form-reset reports (form/reset.ts). What a callback writes renders together and the DOM is current when the event returns. Test: packages/ui/src/batched.dom.test.tsx (a Checkbox change, a ToggleGroup valuechange and a Select change: the DOM is current right after the event, with no flush; all three fail with a passthrough helper). Docs: ui README, Signals bullet. Size: islands' component JS +0.01 to 0.04 kB brotli per component. A possible follow-up for Spark, not filed: Lumiose's listen() could batch native on: listeners as the delegated dispatch does, for every app.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The @lumiose/ui callbacks run inside batch(), like delegated handlers; a DOM test shows the DOM is current right after the event.
<!-- SECTION:FINAL_SUMMARY:END -->
