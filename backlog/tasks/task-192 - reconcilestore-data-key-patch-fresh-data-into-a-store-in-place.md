---
id: TASK-192
title: 'reconcile(store, data, { key }): patch fresh data into a store in place'
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 03:33'
labels:
  - state
  - core
dependencies: []
priority: medium
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §C. Solid's reconcile applied to our mutable store(): unchanged items keep identity, only changed fields notify, arrays matched by key (default "id", as Solid). Building block for the async cache (structural sharing), optimistic updates and @lumiose/query. Name is Solid's, so it already follows decision-32.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 reconcile exported from lumiose; arrays matched by key, objects merged deeply, removed keys deleted, only changed properties fire
- [ ] #2 Unit tests (identity kept for unchanged rows, keyed moves, nested objects, primitives) and a list-rendering test proving rows and their local state survive
- [ ] #3 Docs: reference/reactivity and the Sharing state page; runtime size cap still met
<!-- AC:END -->
