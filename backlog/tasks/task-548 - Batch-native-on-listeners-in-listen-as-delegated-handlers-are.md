---
id: TASK-548
title: 'Batch native on: listeners in listen(), as delegated handlers are'
status: Done
assignee:
  - Spark
created_date: '2026-10-23 21:59'
updated_date: '2026-10-23 23:03'
labels:
  - core
  - dom
dependencies: []
priority: low
ordinal: 540000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-540. @lumiose/ui now wraps its native `on:` listeners and callbacks in batch(), so their writes render together and the DOM is current right after the event, like delegated handlers. Lumiose's own `listen()` could do the same for every app's native listeners. It changes when an app's DOM updates after a native event, so it is a behaviour change for a minor release, with a test and the docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 listen() runs native listeners inside batch(), or the docs say why not
- [x] #2 Tests show the DOM is current right after a native event; the docs describe it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-24, worktree run for Lux). Cause: only the delegated dispatch (dom/events.ts) opened a batch. Native listeners wrote outside one, so their writes waited for a microtask flush, and the DOM was stale right after the event. This covered listen(), which the compiler emits for on:x and non-bubbling onX, element.ts bind:value/checked, and Link's prefetch, as well as spread handlers.

Change:
- events.ts has a new internal batched(handler) (startBatch/endBatch around handler.call(this, event)). listen() registers the batched listener and removes the same one on cleanup.
- spread.ts batches spread handlers too: a WeakMap from each handler to its batched listener, so a changed or removed handler is removed. Spread handlers are native listeners, and without this a spread onClick would differ from a written one.
- Recorded as decision-81 (accepted, recorded for Lux). It is a behaviour change for a minor release, marked BREAKING CHANGE in the commit, so the changelog names it.
- The user docs describe the current behaviour only, per docs/stability.md: they carry no "changed in" note.

Size (min+brotli, in-process A/B against the TASK-549 commit, size.ts-style entries):
- Typical imports: +85 B min, +12 B brotli.
- Islands page (loader + hydrate): +31 B brotli.
- Whole runtime (spread included): +163 B min, +9 B brotli.
- SPA boot: -25 B brotli (noise).

Tests: src/dom/events.test.ts.
- listen(): a native listener's two writes render once, the DOM is current right after dispatchEvent with no flush, and `this` is the element.
- Spread handlers (on:ping and onPong): batched, and the listener the spread added is the one it removes when the handler goes.
- Both tests fail on the old events.ts and spread.ts.

Docs: concepts/signals.md (Writes are batched), reference/reactivity.md (batch), concepts/testing.md, concepts/jsx.md (the on: row), reference/jsx.md (Event names), guides/web-components.md (Events), and llms-full.txt (regenerated).

Follow-up for Halo, not filed: @lumiose/ui's batched() wrappers (TASK-540) become redundant for listeners added through on:. Nested batches flush once, so they are harmless, and they can go once ui's peer range requires this Lumiose version.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
listen() and spread handlers now run native listeners inside a batch, as the delegated dispatch does: their writes render together, and the DOM is current right after the event (decision-81). It is a behaviour change for the next minor (BREAKING CHANGE footer). Size: +12 to +31 B brotli on the runtime entries. Tests: dom/events.test.ts, two tests that fail without the change. Docs: signals, reactivity, testing, JSX concept and reference, and web-components. Validation: pnpm check green (2546 tests, cargo test, size hard caps OK) and islands-e2e 10/10.
<!-- SECTION:FINAL_SUMMARY:END -->
