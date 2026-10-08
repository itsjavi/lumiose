---
id: TASK-17
title: Implement async components and boundaries on the client
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:01'
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
- [x] #1 $await pauses and resumes the run subscriber; a fresh subscriber per run; lifetime() aborts superseded runs; the old owner is disposed at the atomic swap
- [x] #2 Suspense shows the fallback for new pending content only; ErrorBoundary supports retry; pending() works; resource() and fetchJSON client side
- [x] #3 Tests cover re-run races, cancellation and nested boundaries
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

Spark (TASK-17 implementation):
Design
- dom/async.ts: createComponent dispatches native async functions to createAsync, which returns a range (start text node with $$end) and keeps an instance owner. Each run is a fresh core Run (subscriber + owner). $await evaluates the thunk inside the run (tracked), pauses synchronously, resolves to a resume fn (never rejects; rejection resumes then throws). $leave pauses at body end. A tracked change invalidates the run: lifetime() aborts, the next run starts at once; an unshown superseded run is disposed immediately (its continuation throws the lifetime reason, results dropped), so the latest run always wins. Settle = atomic swap: old shown run disposed and the new output rendered into the range in one synchronous step.
- Runs are boundaries until shown: nested first runs/resources created by a run hold its swap (re-runs never flash a Suspense fallback nor show half-loaded UI); once shown, new pending content forwards to the boundary above.
- core/async.ts: pending() (instance context flag; never tracked by a run), busy() + beginBusy() registry (decision-20; runs and shown Suspense fallbacks register), suspend() boundary registration, resource(fetcher). Server variants in core/server.ts.
- dom/insert.ts: ranges (createRange/place/renderRange; parents move/remove a range as a unit, removed ranges move into their own fragment so they stay usable). Fix: a function that returns dynamic content (e.g. a component output via a children getter) now renders it in a nested effect, so its updates never re-call the getter (previously re-created the component; with async content this looped forever). list rows accept range nodes.
- dom/boundaries.ts: Suspense (count signal in context; branch fallback/content; hidden content kept alive), ErrorBoundary (fallback(error, retry); sync throws, effect errors, async rejections; retry re-mounts).
- dom/head.ts: client Title/Meta/Head (deepest wins, ties latest; meta dedupe by key; adopts server tags; Head skips duplicates; restore/remove on dispose). dom/public.ts: browser renderToString/renderToStream throw LUM4003.
- dom/frame.ts: instance paths numbered like the server frames (island root 0, children in creation order, restored after awaits); withIsland(replay, fn) is the TASK-18 plug point; replay only on first runs; re-runs fetch.
Evidence: 596/596 tests (pnpm test), new: dom/async.test.ts 12, dom/boundaries.test.ts 12, dom/head.test.ts 3, dom/parity.test.ts 3, insert.test.ts +2; pnpm typecheck and pnpm lint clean (only the pre-existing router warning).
Size (brotli, pnpm --filter lumen size): typical 5.75 -> 6.65 kB (+0.90), benchmark imports 5.02 -> 5.99 kB (+0.97), every export 7.28 -> 9.36. About 0.7 kB of it is the async path that createComponent always pulls in; the rest is ranges/nesting/frames.
Not done: LUM2007 runtime warning (needs a dev flag; leave to the compiler). fetchJSON client side is Nova's (TASK-23, app/fetch-json.ts, in progress).
Follow-ups for Lux: (1) proposal to make the async path tree-shakable (compiler tags async components so createComponent dispatches by reference instead of instanceof), (2) TASK-18/14: the server must emit markers for async instance, Suspense and ErrorBoundary ranges inside islands for hydration, (3) Nova: fetchJSON could default its signal to lifetime() so superseded runs abort their fetches; submit() can import beginBusy from core/internal.ts.
<!-- SECTION:NOTES:END -->
