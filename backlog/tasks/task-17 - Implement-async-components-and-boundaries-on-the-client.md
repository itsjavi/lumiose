---
id: TASK-17
title: Implement async components and boundaries on the client
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:26'
labels: []
milestone: m-2
dependencies:
  - TASK-13
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Async components re-run on tracked changes while keeping stale UI, with Suspense and ErrorBoundary semantics defined in spec §4.4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 $await pauses and resumes the run subscriber; a fresh subscriber per run; lifetime() aborts superseded runs; the old owner is disposed at the atomic swap
- [ ] #2 Suspense shows the fallback for new pending content only; ErrorBoundary supports retry; pending() works; resource() and fetchJSON client side
- [ ] #3 Tests cover re-run races, cancellation and nested boundaries
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-16):
- Client $await must match the server: it never rejects, and on rejection it resolves to a resume function that restores the run and then throws.
- The browser lumen entry must export the same public names as the server: Suspense, ErrorBoundary, Head/Title/Meta (on the client Title/Meta update document.head for SPA navigations), renderToString/renderToStream (throw LUM4003-style errors in the browser).
<!-- SECTION:NOTES:END -->
