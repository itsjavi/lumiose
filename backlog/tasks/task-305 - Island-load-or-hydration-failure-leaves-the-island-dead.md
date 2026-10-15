---
id: TASK-305
title: Island load or hydration failure leaves the island dead
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 02:39'
labels:
  - bug
  - islands
dependencies: []
priority: medium
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while researching TASK-293. In packages/lumiose/src/dom/islands.ts, the loader's `go()` starts an island with `void load!().then((component) => { … hydrate(…) … })` and no rejection handler. When the island's chunk fails to load (a deploy replaced the hashed file, a network error) or `hydrate()` throws, the result is an unhandled promise rejection: nothing names the island, the island stays dead because its state never leaves "loading" (so it is never retried), and the clicks and input the loader captured for it before hydration are never replayed.

Expected: the failure is reported with the island's module, captured events are not silently lost (let the browser's default happen, or retry the load on the next interaction), and the reporting path is the one TASK-299's client `onError` will use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failed island chunk load or a throwing hydration is reported with the island module, instead of an unhandled promise rejection
- [ ] #2 Events captured for a failed island are not silently lost (default behaviour runs, or the next interaction retries the load)
- [ ] #3 Tests cover a rejected chunk import and a throwing hydration
<!-- AC:END -->
