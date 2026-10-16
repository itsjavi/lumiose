---
id: TASK-388
title: Two-way bindings miss a write-back of the previous value before the flush
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 17:14'
updated_date: '2026-10-16 01:52'
labels:
  - runtime
milestone: m-12
dependencies: []
priority: low
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Photon in TASK-360. With bind:value (and bindChecked, bindProperty), when the element changes the signal (typing "b" over "a") and code sets the signal back to the previous value ("a") before the next flush, the render effect does not re-run: the signal's net value is unchanged since the effect last read it, so the element keeps "b" while the signal says "a". The binding.value = value write-back in dom/element.ts covers the opposite case only. Repro: bindValue(input, text); input.value = "b"; input.dispatchEvent(new Event("input")); text.set("a"); flush(); input.value is "b". Reading text() between the two writes makes it pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A write of the previous value before the flush is applied to the element by bindValue, bindChecked and bindProperty
- [x] #2 Tests cover the case for each helper
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, batch 8): fixed in bc4dc33f.

Cause: after the element's event wrote "b" and code wrote "a" back before the flush, the signal's net value was unchanged since the render effect last read it, so the effect never re-ran. The existing `binding.value = value` only helped when the effect did re-run.

Fix (packages/lumiose/src/dom/element.ts): a shared `twoWay(el, signal, apply)` helper.
- The render effect also tracks a per-binding trigger node (`createTrigger`).
- The event handler records the shown value as applied and fires the trigger before writing the signal.
- The next flush therefore re-reads the signal and compares it with what the element shows. A plain edit is not written back over itself.

Tests: element.test.ts covers bindValue (text and range/number), bindChecked and bindProperty. The tests read nothing between the two writes, because a read hid the bug. All three fail without the fix.

Cost: a closure and a small trigger object per binding, outside the benchmark paths. No performance claim.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Two-way bindings re-run their effect after each element event, so a previous value written back before the flush reaches the element; tests for bindValue, bindChecked and bindProperty (bc4dc33f).
<!-- SECTION:FINAL_SUMMARY:END -->
