---
id: TASK-7
title: Implement the reactive core
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:37'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Signals are the foundation of every update path, and the core sets Lumen's performance and memory ceiling (decision-8).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 signal, computed, effect, store, untrack, batch, flushSync, onMount, onCleanup, lifetime, createContext/provide/inject behave per spec §4.3 and §6.1-6.2
- [ ] #2 The algorithm follows alien-signals (intrusive links, depsTail reuse, push-pull flags, no recursion), vendored with MIT attribution; unobserved computeds unlink
- [ ] #3 Property-based tests compare it against a naive reference implementation; unit tests cover owners, cleanup, context and batching
- [ ] #4 A run-scoped subscriber can be paused and resumed (needed for $await)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vendor the alien-signals 3.2.1 reactive system (link/unlink/propagate/checkDirty/shallowPropagate) as core/system.ts with MIT attribution + core/LICENSE.alien-signals.
2. core/reactive.ts: execution context (activeSub, current owner, cycle/runDepth), signal/computed/trigger nodes, untrack. Unobserved computeds hold no links (unwatched -> release deps; untracked reads of unobserved computeds evaluate without subscribing).
3. core/owner.ts: owner tree (intrusive child list, depth), cleanups (children newest-first, then cleanups LIFO), lazy owners (materialized on first registration), context storage, lifetime AbortController, error handlers.
4. core/effect.ts: scheduler (render queue by owner depth, bucketed only when >1 depth; then user effects; microtask flush; batch; flushSync), user effects (deferred first run, cleanup/onCleanup, reset per run), render effect primitive renderEffect(compute, apply, target), run subscribers (createRun/resumeRun/pauseRun/invalidate) for $await, onMount.
5. core/store.ts (deep proxy with per-key trigger nodes, array mutators untracked), core/context.ts, core/signal.ts public wrappers, core/index.ts (public), core/internal.ts (runtime hooks), core/server.ts (plain cells, computed once, no effects) + src/server/public.ts re-export.
6. Tests: property-based vs naive reference (seeded PRNG), unit tests for owners, cleanup order, context, batching, flush order, lazy/unlinked computeds, equality, store, lifetime, runs, server.
7. Validate with pnpm typecheck, pnpm test, pnpm lint; align internal names with the compiler-runtime contract doc if it exists.
<!-- SECTION:PLAN:END -->
