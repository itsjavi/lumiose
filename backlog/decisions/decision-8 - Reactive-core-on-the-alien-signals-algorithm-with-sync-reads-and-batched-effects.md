---
id: decision-8
title: >-
  Reactive core on the alien-signals algorithm with sync reads and batched
  effects
date: '2026-10-08 10:28'
status: accepted
---
## Context

The reactive core sets the ceiling for update performance and for memory use.

TASK-1 benchmark data (js-framework-benchmark, Chrome 154):
- alien-signals with manual DOM scores 1.06 CPU and 2.09 MB, the fastest signal core measured. Vue 3.6 reactivity is built on it.
- The TC39 Signals polyfill scores 1.13 CPU but uses 15.4 MB of memory. The proposal is stalled at Stage 1.

Scheduling semantics:
- Solid 2 defers write application to a microtask. Its community found the resulting read-after-write behaviour surprising.

## Decision

**Algorithm**
- Lumen implements its core with the alien-signals algorithm, vendored under MIT with attribution:
  - push-pull flags;
  - intrusive doubly-linked `Link` edges;
  - link reuse via a `depsTail` cursor;
  - no Set or Map per edge;
  - iterative traversal.
- `computed` is lazy and unlinks itself when nothing observes it.
- Owners scope cleanup, context and error boundaries.

**Semantics**
- Reads are synchronous: a read always reflects the latest write.
- Effects are batched:
  - Each delegated event handler runs as a batch.
  - Writes made outside a batch schedule a microtask flush.
  - `flushSync()` forces an immediate flush.
- Flush order: computeds are pulled first, then render bindings in tree order, then user effects.

**DOM bindings.** The compiler emits `effect(compute, apply)` pairs, so equality is checked before any DOM write.

**API shape**
- `signal` / `computed` / `effect` / `store` / `untrack` / `batch`. Reads are callable, e.g. `count()`.
- Names are aligned with TC39 where practical. Lumen takes no dependency on the proposal or its polyfill.

## Consequences

- Lumen gets a best-in-class update path and memory profile.
- Lumen owns this code and must maintain and test it. Property-based tests should compare it against a naive reference implementation.
- Async inside `computed` (Solid 2 style) is deferred to v1.x. Async components are covered by decision-13. A run of an async component gets a fresh subscriber node, which is paused (not ended) at each `$await`, so tracking across awaits is compatible with `depsTail` link reuse.


_Accepted 2026-10-08 by Lux (architect) under the authority delegated in decision-16._
