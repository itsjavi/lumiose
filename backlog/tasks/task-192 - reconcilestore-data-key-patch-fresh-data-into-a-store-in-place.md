---
id: TASK-192
title: 'reconcile(store, data, { key }): patch fresh data into a store in place'
status: Done
assignee:
  - Spark
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 03:47'
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
- [x] #1 reconcile exported from lumiose; arrays matched by key, objects merged deeply, removed keys deleted, only changed properties fire
- [x] #2 Unit tests (identity kept for unchanged rows, keyed moves, nested objects, primitives) and a list-rendering test proving rows and their local state survive
- [x] #3 Docs: reference/reactivity and the Sharing state page; runtime size cap still met
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: signature `reconcile<T extends object>(target: T, data: T, options?: { key?: string }): void` (type `ReconcileOptions`). Diff in core/reconcile.ts (pure, writes through the target); browser wrapper in store.ts runs it in batch + untrack so only changed props fire and it is safe inside effects; server variant (core/server.ts) patches plain objects. Arrays: match by raw reference, then key (default "id"); unkeyed items merge into the same-index old item when it has no key either; leftovers removed via length. Objects with differing keys are replaced (as Solid). Size: reconcile is part of 'core + dom (every export)': HEAD 9.73 kB -> 9.96 kB brotli (cap 10.00; Nova's in-flight TASK-194 adds ~0.04). To fit, the kind check (TypeError) is dev-only, there is no 'used' set (duplicate keys share one item, documented) and the last old item with a duplicate key wins. The budget is now nearly exhausted for new core exports.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
reconcile(target, data, { key }) exported from lumiose (browser and server), commit 7e956d2. Unit tests (core/reconcile.test.ts: identity, keyed moves/inserts/removals, custom key, deep merge + deletes, primitives/non-plain/different-key replacement, unkeyed index merge, nested store path, batch/untracked, server) and a happy-dom list test proving keyed rows' DOM nodes and row-local signals survive a reconcile with fresh-but-equal objects while a changed field updates, with zero DOM mutations. Docs: reference/reactivity (reconcile section) and concepts/state (table rows, recipe, common mistake); llms regenerated. Validation: typecheck, lumiose tests 715/715, lint clean on changed files, docs:check, size OK (every export 9.96/10.00 kB brotli).
<!-- SECTION:FINAL_SUMMARY:END -->
