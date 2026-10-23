---
id: decision-81
title: 'Native event listeners run inside a batch, as delegated handlers do'
date: '2026-10-23 22:59'
status: accepted
---
## Context

Delegated `onX` handlers run inside a batch (decision-17): their writes render together when the handler returns, so the DOM is current right after the event. Native listeners did not.

- **Which listeners.** `on:x`, the direct listeners of non-bubbling events (`onFocus`, `onScroll`, `onMouseEnter`) and handlers passed in a spread.
- **What happened.** Each write scheduled a microtask flush. Several writes still rendered once, but code that dispatched an event and read the DOM right after saw the old state.

@lumiose/ui wrapped its own native listeners in `batch()` for this reason (TASK-540).

## Decision

Recorded by Spark for Lux, 2026-10-24 (TASK-548).

- `listen()`, which the compiler emits for `on:x` and for non-bubbling `onX`, runs the listener inside a batch. Spread handlers do too.
- What the listener writes renders when it returns, as with delegated handlers.
- The listener keeps its `this` (the element), and errors propagate as before.

This is a behaviour change and ships in a minor release, named in its changelog.

## Consequences

- **The DOM is current after any handler.** After `el.dispatchEvent(new CustomEvent(…))` or a native `focus`, a test or a web component reads the updated DOM without `flush()`. The rule is the same for every handler kind.
- **Effects run earlier.** The flush now happens synchronously at the end of the listener, not in a microtask. Effects that the writes trigger run before `dispatchEvent()` returns.
- **Mostly unaffected.** Code that read the DOM in a microtask after a native event sees the same result.
- **@lumiose/ui.** Its own `batched()` wrappers (TASK-540) become redundant for listeners it adds through `on:`, as nested batches flush once. They can go once its peer range requires this Lumiose version.
- **Size.** About +85 B minified and +10 to +30 B brotli on the runtime entries (in-process A/B, `scripts/size.ts` entries).
- **Docs and tests.** The signals, JSX, reactivity, testing and web-components docs describe it. `src/dom/events.test.ts` covers `listen()` and spread handlers.
