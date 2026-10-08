---
id: TASK-49
title: 'Runtime: parentless branch and list values'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 14:11'
updated_date: '2026-10-08 16:12'
labels: []
milestone: m-1
dependencies:
  - TASK-13
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conditionals and .map() inside component children, fragments and nested ternaries currently fall back to tracked functions that re-render (Photon, TASK-9). The runtime needs parentless variants that return a Renderable, so the compiler can keep memoised branches and keyed lists everywhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 branchValue(cond, whenTrue, whenFalse?) and listValue(source, render, key?) return Renderables that insert() mounts with the same memoisation and keyed reconciliation as branch/list
- [x] #2 Contract doc-2 and client.ts updated by Lux from Spark's proposal; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: claimed (session spark-task12-20261008T140314Z). Plan: branchValue/listValue return a range (RangeStart, like async components) whose own end marker anchors branch()/list(); insert() places it as one node.

Spark: implemented in `lumen/dom` (exported from dom/index.ts): `branchValue` in dom/insert.ts, `listValue` in dom/list.ts. Each creates a range (`createRange()`: two empty text nodes in a fragment, start.$$end = end, the same mechanism as async component instances) and anchors `branch()`/`list()` at the range's end marker. `insert` places the range as one node, and parents move/remove it as a unit. branch/list already resolve their parent as `marker.parentNode`, so they follow the range wherever it is. `list` never takes the `textContent` clear inside a range, because it never owns the parent; rows are removed one by one. Tests: dom/parentless.test.ts (5): siblings kept and memoised on !!cond with disposal; nested ternaries; keyed append/swap/remove/clear between siblings; listValue as component children inside a branch (row disposal); a range moving with an outer list's reorder.

**Contract proposal (for Lux: doc-2 §2 table and contract/client.ts):**

| Name | Contract |
|---|---|
| `branchValue(cond, whenTrue, whenFalse?)` | `branch` without a parent: returns a `Renderable` range that `insert` places as one node. Memoised on `!!cond()`; the active view renders before the range's end marker and its owner is disposed on a flip. For conditionals in component children, fragments and nested ternaries |
| `listValue(source, render, key?)` | `list` without a parent: returns a `Renderable` range with the same keyed reconciliation and `render.length > 1` index rule. Clears remove rows one by one (no `textContent` fast path) |

```ts
  /** Parentless `branch` (component children, fragments, nested ternaries): a range that `insert` places as one node; memoised on `!!cond()`. */
  branchValue(cond: () => unknown, whenTrue: () => Renderable, whenFalse?: () => Renderable): Renderable;
  /** Parentless `list` (component children, fragments, branches): a range that `insert` places as one node; same keyed reconciliation as `list`. */
  listValue<T>(
    source: () => readonly T[] | null | undefined,
    render: (item: T, index: () => number) => Renderable,
    key?: (item: T) => unknown,
  ): Renderable;
```

Codegen guidance (TASK-50): keep `branch`/`list` with parent + marker when the conditional or `.map()` is a child of a template element (cheaper: no range markers, and `list` can clear with `textContent`). Use the value variants elsewhere, e.g. `get children() { return listValue(items, (item) => …) }`, `[a, branchValue(c, () => x), b]` in fragments, and `branchValue(c1, () => x, () => branchValue(c2, () => y, () => z))` for nested ternaries. A `children` getter creates a new branch/list on each read, which matches the existing getter semantics of children.

Open item: hydration. Range markers are created fresh, so under `lumen/dom/hydrate` a parentless value re-renders instead of adopting server nodes. TASK-18 should map the server's `<!--[-->…<!--]-->` region markers onto the range's start and end.

AC#1 done. AC#2 waits on Lux's contract update; the tests are in place. Claim released.

Lux: contract updated (doc-2 §2 and contract/client.ts, plus the dom contract test key list). The hydration adoption for value ranges is carried into TASK-18.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Parentless branchValue/listValue runtime helpers with keyed reconciliation and branch memoisation, covered by 5 tests; contract doc-2 and client.ts updated by Lux; the codegen side is TASK-50.
<!-- SECTION:FINAL_SUMMARY:END -->
