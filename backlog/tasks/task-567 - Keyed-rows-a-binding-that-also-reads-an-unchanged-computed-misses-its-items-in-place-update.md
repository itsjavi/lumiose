---
id: TASK-567
title: >-
  Keyed rows: a binding that also reads an unchanged computed misses its item's
  in-place update
status: In Progress
assignee:
  - Spark
created_date: '2026-10-24 17:02'
updated_date: '2026-10-24 18:22'
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
- [x] #1 A keyed row's binding that reads its item and a computed the same write leaves unchanged shows the new item, with a regression test
- [ ] #2 The virtualizer components' workaround (a computed per row) is removed, or kept with a measured reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (session spark-20261024T-t567, sent by Lux) took it on a worktree branch.

Root cause: rerun (core/effect.ts) treated a binding without WATCHING as already queued, so it did nothing, but the same write can queue it only as PENDING through a computed. In the repro, items.set queues the <b> binding as maybe stale through count; the list's reconcile then reruns it, which was a no-op; when the binding's turn came, checkDirty recomputed count to the same value and dropped the run, since its tracked dependencies cannot see the untracked item read. The binding also left the row's list (n = null) without tracking the item, so later in-place changes were missed too.

Fix (commit 9922eddc on Spark's worktree branch): rerun marks the binding DIRTY even when it is already queued, and queues it only when nothing else did. decision-83 Consequences notes it.

Tests (fail without the fix): core/effect.test.ts 'rerun' (queued as maybe stale through an unchanged computed; unqueued; queued and stale, runs once), dom/list.test.ts (a kept row's binding that also reads an unchanged computed, two changes in a row), dom/keyed-rows.test.ts (compiled: Halo's repro with count(), the index and the item, two changes).

Edge case (a binding that stopped reading the item before the first in-place change): still one extra compute and no apply on that change. Before the fix it was skipped when the binding was also queued through an unchanged computed (the same skip that caused the bug); now the extra compute happens in both cases. Not worth a hot-path marker on every binding run.

A/B (in-process): rows bench 30 rounds, script paired median replace -1.00 (IQR -2.78 to 1.27), rederive -0.15 (-0.60 to 0.30), refetch +0.30 (-0.20 to 0.60), refetch again 60 rounds 0.00 (-0.40 to 0.40). jsfb-ab 20 runs 01-09, keyed and unkeyed against builds of the previous commit: every paired total median within noise (IQR across 0), keyed 01 +0.04, 02 -0.02, 03 +1.06 (-0.93 to 2.45), 07 +2.64 (-1.85 to 11.46); unkeyed 01 +0.21, 02 +0.13, 03 +0.48 (-0.04 to 2.04), 07 -1.08. jsfb never reruns (its rows keep their items). Size: minified unchanged (jsfb bundle -1 byte); brotli moves within compression jitter: typical imports 6.38 kB, islands 9.59 kB, whole runtime 13.96 to 14.00 kB (cap 15).

Validation: pnpm check, islands-e2e (10), spa-router-e2e (38) and @lumiose/ui tests (619) green.

AC #2 is open: the virtualizer (TASK-565, rowOf in packages/ui/src/virtualizer/virtual.tsx) is not in the main tree yet; Halo can drop the per-row computed once it builds on this fix.
<!-- SECTION:NOTES:END -->
