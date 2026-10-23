---
id: decision-80
title: Effects queued in one flush run before the render work their writes trigger
date: '2026-10-23 13:53'
status: accepted
---
## Context

Today a flush runs user effects and `attach` callbacks one at a time. When one of them writes a signal that the page renders, the scheduler runs that write's render work before the next effect starts (core/effect.ts drains the render queue between user effects).

The cost shows in a common pattern: each row measures the DOM, then writes a signal. Every measurement after the first then forces a synchronous layout, so N rows cost N layouts.

- A port of a private app (TASK-492) measured 63 ms for 10 virtual-grid rows at full CPU speed. At 4x CPU that is about the whole gap against React when the list's content is replaced (539 vs 284 ms).
- TASK-522's in-process A/B ruled out row insertion as the cause.

React runs every layout effect of a commit before it renders their state updates together. Solid holds the writes that effects make until the running effects are done.

## Decision

Approved by the user on 2026-10-23 (TASK-527).

User effects (including `attach` callbacks) already queued in a flush run before the render work that their signal writes trigger. The writes are applied together afterwards, so N effects that measure the DOM and then write share one layout.

- **What stays the same.** Signal reads stay synchronous, so an effect still sees the current value of a signal that an earlier effect of the same flush wrote.
- **What changes.** Only the DOM lags: it does not yet reflect writes made earlier in the same flush.
- **Unchanged otherwise.** Render bindings still update before user effects within an update, and effects that the batched writes schedule run in the following pass of the same flush, as today.

This is a behaviour change and ships in a minor release (0.6.0), named in its changelog.

## Consequences

- **Measure-then-write code gets faster.** Lists, virtualization and auto-sizing that measure in `attach` or `effect` and then write a signal do one layout per flush instead of one per element.
- **Some code reads a stale DOM.** Code that writes a signal in one effect and measures the DOM that write renders in a later effect of the same flush now reads the previous layout. It must measure in the next frame, in a `ResizeObserver`, or in an effect that depends on the written signal (which runs in the next pass).
- **Docs and tests.** The JSX docs ("When attach runs") and the signals docs (effect scheduling) describe the new order. The effect ordering tests change accordingly.
- **Proof.** TASK-527 holds the in-process browser A/B that shows one forced layout instead of N.
- **Implementation detail** (TASK-527, recorded by Lux on 2026-10-23): when render work is pending, a conditional, list or attach binding that owns the next queued effect runs first. That effect is then disposed, instead of running once more inside content an earlier write removed. Solid uses the same guard.
- **Measured** (`bench:measure:ab`, 4x CPU): 10 measuring rows go from 11 forced layouts to 2 (8.30 to 7.10 ms), and 80 rows from 81 to 2 (60.60 to 46.85 ms). The grid A/B and js-framework-benchmark show no change.
