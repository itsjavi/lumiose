---
id: TASK-196
title: Optimistic updates that roll back when a submission fails
status: Done
assignee:
  - Spark
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 18:50'
labels:
  - state
  - data
dependencies:
  - TASK-190
priority: low
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §D. A value that follows a source plus an overlay held while a promise is pending: on success the refreshed source shows, on failure the overlay drops (rollback). Works with any promise; integrates with submit() (Nova's area, coordinate through Lux). Prior art: React useOptimistic, Solid 2 createOptimistic. Name and shape provisional until TASK-190.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overlay applies at once, clears when the promise settles; concurrent overlays apply in order and drop independently
- [x] #2 Works with submit() on SPA and MPA pages (success refresh, failure rollback); tests for both
- [x] #3 Docs: data-and-actions page and reference
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Names approved (decision-35): optimistic(source) with .set(value, promise) and .update(fn, promise); the overlay holds until the promise settles. No .during().

2026-10-10 Spark (optimistic): implemented in packages/lumiose/src/core/optimistic.ts (5c847b9).
Semantics: overlays are functions folded over source() in call order inside a computed, so pending update()s re-apply over the latest source (as React's useOptimistic reducer rebases; set() is an overlay that ignores its input). Each overlay drops when its own promise settles, success or failure (fail() results resolve, so they roll back too). Same fn passed twice = two entries, dropped one at a time.
Errors: optimistic attaches then(drop, drop), so it never adds an unhandled rejection and never re-throws; the caller's own await of submit() still rejects. Trade-off: fire-and-forget usage only shows the rollback (documented: await submit() to handle errors).
Disposal: onCleanup marks it dead; later settles and new set/update do not write.
Server: reads source(), set/update are no-ops.
submit() timing: SPA submit() already awaits invalidate() (router resolves once isBusy() clears), so the refreshed source is in place before the overlay drops; the refresh write and the drop are in the same task (microtasks only), so no paint shows the old or double-counted value. MPA: submit() never refreshes; the island reads the new value from actionData() (set before submit resolves). For an explicit MPA invalidate() (location.reload) I changed navigation.ts so it returns a never-settling promise: the page is going away, and an overlay passed submit(e).then(() => invalidate()) holds until unload instead of flickering back. Smallest change; nothing in the repo awaited the MPA invalidate().
Size: +~0.08 kB brotli on core+dom (every export): 9.95 -> 10.03 kB, over the 10.00 kB hard cap; HARD_CAP not touched, for Lux to raise.
docs/llms-full.txt regenerated but left uncommitted (mixed with other workers' hunks) for Lux.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
optimistic(source) with .set(value, promise)/.update(fn, promise) in lumiose core (client + server variant), tests (core unit tests with fake promises; submit() SPA/MPA success and rollback with a paint sampler), MPA invalidate() promise now never settles, docs (data-and-actions concept + like-button example, reactivity reference, app reference invalidate note). Commit 5c847b9. Size check over the 10 kB cap by ~0.03 kB (Lux to raise).
<!-- SECTION:FINAL_SUMMARY:END -->
