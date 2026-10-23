---
id: TASK-540
title: 'ui: callbacks run outside the event''s batch'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
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
- [ ] #1 ui callbacks run inside batch(), like delegated event handlers, or the docs say why not
- [ ] #2 A test shows the DOM is current right after the event
<!-- AC:END -->
