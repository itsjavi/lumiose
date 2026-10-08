---
id: TASK-84
title: 'store(): export a way to read a plain snapshot of a store'
status: To Do
assignee:
  - Spark
created_date: '2026-10-08 20:54'
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
- [ ] #1 lumen exports a function that returns plain data for a store (or a nested store value) that structuredClone and postMessage accept
- [ ] #2 Unit tests cover nested objects and arrays and show the result is not reactive; reference/reactivity.md documents it
<!-- AC:END -->
