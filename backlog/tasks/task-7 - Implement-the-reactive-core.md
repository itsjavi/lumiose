---
id: TASK-7
title: Implement the reactive core
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:56'
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
- [x] #1 signal, computed, effect, store, untrack, batch, flushSync, onMount, onCleanup, lifetime, createContext/provide/inject behave per spec §4.3 and §6.1-6.2
- [x] #2 The algorithm follows alien-signals (intrusive links, depsTail reuse, push-pull flags, no recursion), vendored with MIT attribution; unobserved computeds unlink
- [x] #3 Property-based tests compare it against a naive reference implementation; unit tests cover owners, cleanup, context and batching
- [x] #4 A run-scoped subscriber can be paused and resumed (needed for $await)
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation (Spark, packages/lumen/src/core):
- system.ts: alien-signals v3.2.1 graph algorithm vendored verbatim (const enum -> constants), MIT header + LICENSE.alien-signals.
- reactive.ts: execution context (activeSub, current owner, cycle, runDepth), signal/computed/trigger nodes, untrack. Signals settle pending writes on read (reads always see the latest write). Default equality Object.is; equal writes/recomputes keep the old value; equals:false = always changed.
- owner.ts: owner tree with intrusive newest-first child list (O(1) detach), cleanups (children newest-first, then own cleanups LIFO; every cleanup runs, first error rethrown), lazy owners (runWithLazyOwner: materialized on first registration; inject resolves via the parent without materializing), lifetime() AbortController per owner (aborted on dispose, on effect re-run, and on run supersession), context storage, onError/handleError (error boundaries via a private context key).
- effect.ts: scheduler (render queue = bindings + runs, bucketed by owner depth only when >1 depth is dirty; then user effects; render passes re-run before the next user effect; microtask flush for writes outside a batch; batch/startBatch/endBatch/flushSync), user effect (first run deferred to the flush, cleanup return + onCleanup reset per run), onMount, renderEffect(target, compute, apply) = contract bind(), runs (createRun/resumeRun/pauseRun; invalidated once in the render phase: stops tracking, aborts lifetime, owner kept until disposed). Effect errors go to onError handlers or are rethrown after the flush; other effects still run.
- store.ts: deep proxy, per-key trigger nodes created on tracked reads, KEYS node for ownKeys/add/delete/length, array mutators untracked, proxies unwrapped on assignment, non-plain/frozen objects returned as is.
- signal.ts/context.ts/index.ts (public), internal.ts (runtime hooks), server.ts (plain cells, computed once, effects/onMount no-ops, owner frames for context/cleanup, lifetime() = request root owner's signal); src/server/public.ts re-exports it.
Decisions: computed getters run with no owner (must be pure); an unobserved computed read untracked is evaluated without subscribing (no links, recomputed per such read) so nothing leaks; render effects are never reset (the DOM runtime disposes per-value child owners itself).
Perf sanity vs raw alien-signals (node, warm): updates 1.15-1.35x, create+dispose ~1.9x (owner-aware nodes); to be tuned in TASK-12.

Contract alignment (doc-2): renderEffect takes (target, compute, apply) and calls apply(target, value), so lumen/dom can export it as bind. ISSUE FOR LUX (TASK-6): the shape `await $await(() => e, N)` cannot restore the run gap-free. $await can only resume inside its own continuation, and the component's continuation runs in a later microtask, so another run's continuation can run in between (demonstrated: two runs awaiting the same promise, A's continuation observes B as the active run). Also, after the last segment the run stays active until the runtime's .then runs. Sound shapes need code in the component's own continuation, e.g. `(await $await(() => e, N))()` (Svelte-style restore thunk) plus a synchronous pause at the end of the body (try/finally emitted by the compiler). The core primitives (resumeRun/pauseRun, idempotent) support either shape.

Validation: pnpm typecheck OK; pnpm test OK (225 tests, 86 in core across 7 files); oxlint clean for core/ and server/public.ts (remaining repo warnings/errors are in other owners' files). Property tests: 400 random graphs x 80 steps vs a naive reference (values, glitch-free reads, effect run iff a read value changed, at-most-once per flush, exact link sets after each flush, cache hits for observed computeds, full unlink after disposal), 300 cascade graphs with effects writing signals during the flush (fixed point vs reference), 200 random store/array mutation sequences vs a plain array. Mutation check: no equality cut-off, unwatched not releasing links, PENDING treated as DIRTY, no purge of stale deps, reads not settling writes, RECURSED ignored in propagate and innerWrite disabled were each caught by the suite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the reactive core in packages/lumen/src/core: the vendored alien-signals 3.2.1 graph (system.ts, MIT attribution), signals/computeds/triggers (reactive.ts), owners with lazy materialization, LIFO cleanup, context, lifetime and error handlers (owner.ts), the scheduler with depth-ordered render effects, user effects, batch/flushSync and pausable async run subscribers (effect.ts), a deep store proxy (store.ts), the public API (index.ts), runtime hooks (internal.ts) and a graph-free server variant (server.ts, re-exported by src/server/public.ts). renderEffect matches the contract's bind(target, compute, apply). Verified with 86 core tests (unit tests for every public API, owners, cleanup order, context, batching, flush order, unlinking, store, lifetime, runs, server parity) including property tests against a naive reference (400 graphs, 300 write-cascade graphs, 200 store sequences) that caught every injected mutation; pnpm typecheck, pnpm test (225) and lint on core pass. Open item for Lux: the contract's `await $await(() => e, N)` shape cannot restore the run without a microtask gap; see notes for a sound alternative.
<!-- SECTION:FINAL_SUMMARY:END -->
