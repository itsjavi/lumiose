---
id: TASK-567
title: >-
  Keyed rows: a binding that also reads an unchanged computed misses its item's
  in-place update
status: To Do
assignee:
  - Spark
created_date: '2026-10-24 17:02'
labels:
  - runtime
  - bug
dependencies: []
priority: high
ordinal: 559000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo while building the virtualizer components (TASK-565), on Lumiose 0.7.0's keyed rows (decision-83). In a keyed row, a binding that reads the item and also a computed that the same write marks stale but that recomputes to the same value keeps showing the old item after the item changes in place under its key.

Repro (happy-dom, browser build):

```tsx
const items = signal([{ id: "a", name: "A" }]);
const count = computed(() => items().length);
<ul>
  {items().map((item) => (
    <li key={item.id}>
      <b>{`${count()}-${item.name}`}</b>
      <u>{item.name}</u>
      <em>{`${items().length}-${item.name}`}</em>
    </li>
  ))}
</ul>;
items.set([{ id: "a", name: "A2" }]);
// <b>1-A</b> stays (expected 1-A2); <u>A2</u> and <em>1-A2</em> update.
```

The same binding updates with an unchanged plain signal, or with a computed whose value changes. Likely cause: the binding reads the item lazily (it joined the row's list while the row was created), so the reconciliation reruns it, but it is also pending through the stale computed, and that pending check, finding the computed unchanged, drops the rerun's result. Any row that shows its index or a derived count next to the item can hit it.

The virtualizer components route each row's item through a computed as a workaround (packages/ui/src/virtualizer/virtual.tsx, rowOf), to be removed once this is fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A keyed row's binding that reads its item and a computed the same write leaves unchanged shows the new item, with a regression test
- [ ] #2 The virtualizer components' workaround (a computed per row) is removed, or kept with a measured reason
<!-- AC:END -->
