---
id: TASK-84
title: 'store(): export a way to read a plain snapshot of a store'
status: Done
assignee:
  - Spark
created_date: '2026-10-08 20:54'
updated_date: '2026-10-08 21:42'
labels:
  - runtime
  - api
dependencies: []
priority: low
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building the chiptune app (TASK-35): the app keeps its song in a deep store() and must post it to an AudioWorklet and save it as JSON. structuredClone(storeProxy) throws (proxies are not cloneable), and lumen exports no toRaw/unwrap/snapshot, so the app keeps the raw root object next to the store to clone or post it. Add a small, tree-shakeable API (e.g. snapshot(store) returning a deep plain copy, or unwrap(store) returning the underlying object) and document when to use it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen exports a function that returns plain data for a store (or a nested store value) that structuredClone and postMessage accept
- [x] #2 Unit tests cover nested objects and arrays and show the result is not reactive; reference/reactivity.md documents it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
snapshot(value) in core/store.ts on a pure copyPlain() (core/snapshot.ts) shared with the server variant; tests in store.test.ts/server.test.ts; docs in reference/reactivity.md and concepts/signals.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-08): done in 7066c96. snapshot(value) copies plain objects and arrays deeply, reading through store proxies via the raw objects (untracked, so cheap and never subscribes); Dates/Maps/class instances are kept as is; shared and circular references stay shared (one copy per source object). Works on a store, a nested store value, or plain data holding stores. Server variant (core/server.ts) copies the plain object. Tree-shakeable (separate export). The chiptune keeps its raw root object (it also reads raw for untracked hot paths); it could use snapshot() for engine posts later. Validation: core + index export-parity tests (93), tsc, oxlint, docs tests. llms*.txt in the working tree were regenerated together with other agents' pending doc changes (concepts/svg.md), so they are left for the commit that lands those.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen exports snapshot(value): a deep plain copy of a store (or a nested value, or plain data holding stores) that structuredClone and postMessage accept; untracked, keeps non-plain values and shared/circular references. Tests cover nested objects/arrays, non-reactivity and cycles; reference/reactivity.md and concepts/signals.md document it.
<!-- SECTION:FINAL_SUMMARY:END -->
