---
id: TASK-13
title: Implement the DOM runtime
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:49'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-7
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Compiled client code needs the runtime half of the contract: templates, inserts, attributes, events, lists and branches (spec §6.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 template/insert/attribute/class/style/bind/attach/ref helpers implement the contract
- [ ] #2 Document-level event delegation per decision-17, with data slots and island/app boundary walking
- [ ] #3 The keyed list implements prefix/suffix trim, append/remove/clear/swap fast paths and LIS; selector() is O(1); branches are memoised; Portal and Dynamic
- [ ] #4 Unit tests in a DOM environment cover every contract function; the core+dom size budget is checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-42 review):
1. setAttr: for aria-* and enumerated attributes (spellcheck, draggable, contenteditable, translate, autocapitalize?), a boolean false must write "false" rather than remove the attribute. Plain boolean attributes keep the remove-on-false behaviour.
2. bindValue with a number signal (input type=number|range) reads valueAsNumber and writes number values.
3. Event names come from React-style camelCase props lowercased by the compiler (decision-17 amendment).
<!-- SECTION:NOTES:END -->
