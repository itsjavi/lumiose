---
id: TASK-388
title: Two-way bindings miss a write-back of the previous value before the flush
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 17:14'
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
- [ ] #1 A write of the previous value before the flush is applied to the element by bindValue, bindChecked and bindProperty
- [ ] #2 Tests cover the case for each helper
<!-- AC:END -->
