---
id: TASK-196
title: Optimistic updates that roll back when a submission fails
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 03:33'
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
- [ ] #1 Overlay applies at once, clears when the promise settles; concurrent overlays apply in order and drop independently
- [ ] #2 Works with submit() on SPA and MPA pages (success refresh, failure rollback); tests for both
- [ ] #3 Docs: data-and-actions page and reference
<!-- AC:END -->
