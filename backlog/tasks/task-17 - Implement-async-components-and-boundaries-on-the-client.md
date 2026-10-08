---
id: TASK-17
title: Implement async components and boundaries on the client
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:47'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: pending() (async instance context) and resource(); server variants for parity.
2. dom/component.ts async path: per-instance owner + marker range; one core Run per run (fresh subscriber); $await/$leave per contract (sync pause, resume fn, never rejects); re-run on invalidation with lifetime() abort, stale UI kept, atomic swap that disposes the old run; instance-path frames (island-relative) + replay hook for TASK-18.
3. insert/list: range-aware reconcile (a range start node carries its end), so parents move/remove async ranges as units.
4. dom/boundaries.ts: Suspense (fallback for new pending first runs only), ErrorBoundary (fallback(error, retry), sync + async + effect errors).
5. dom/head.ts: client Head/Title/Meta (dedupe, deepest wins, restore on dispose); browser stubs for renderToString/renderToStream (LUM4003).
6. Tests (happy-dom) for runs, races, cancellation, context after await, nested Suspense, ErrorBoundary retry, pending(), new branches, parity; size delta; typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-16):
- Client $await must match the server: it never rejects, and on rejection it resolves to a resume function that restores the run and then throws.
- The browser lumen entry must export the same public names as the server: Suspense, ErrorBoundary, Head/Title/Meta (on the client Title/Meta update document.head for SPA navigations), renderToString/renderToStream (throw LUM4003-style errors in the browser).

Lux (decision-20, user-approved): add busy(), an app-wide summary signal, to core, backed by an internal in-flight registry (e.g. beginBusy()/endBusy() or trackBusy(promise) in core/internal.ts). Register async component runs and Suspense fallbacks with it. pending() stays the async component's own re-run flag.
<!-- SECTION:NOTES:END -->
