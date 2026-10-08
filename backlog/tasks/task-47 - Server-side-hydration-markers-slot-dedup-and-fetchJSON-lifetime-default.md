---
id: TASK-47
title: 'Server-side hydration markers, slot dedup and fetchJSON lifetime default'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 14:02'
updated_date: '2026-10-08 15:44'
labels: []
milestone: m-2
dependencies:
  - TASK-17
priority: high
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client hydration (TASK-18) needs the server output inside islands to delimit every claimable range, and Spark/Nova agreed protocol refinements during TASK-16/17.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inside islands, the server wraps every async component instance, Suspense range and ErrorBoundary range in block markers matching the client's range model (dom/async.ts), with await records keyed like the client's instance paths (dom/frame.ts)
- [ ] #2 Slots rendered during SSR are emitted inline as <!--l:s:name-->…<!--/l:s--> only; <template data-l-slot> only for slots not rendered during SSR (TASK-18 notes)
- [ ] #3 fetchJSON defaults its abort signal to lifetime() when called inside an async component run, so superseded runs cancel their fetches
- [ ] #4 Server tests updated; the marker format is documented in contract doc-2 §3 (propose the text to Lux)
<!-- AC:END -->
