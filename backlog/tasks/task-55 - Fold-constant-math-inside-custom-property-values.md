---
id: TASK-55
title: Fold constant math inside custom property values
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 15:50'
labels: []
milestone: m-1
dependencies:
  - TASK-10
priority: low
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lightning CSS already reduces calc(), min(), max(), clamp() and similar expressions with concrete compatible values in regular properties (verified: calc(8 * 2px) becomes 16px, min(10px, 20px) becomes 10px, rotate(calc(45deg * 2)) becomes rotate(90deg)). Since $refs are substituted before parsing, $name math is precomputed by default with no attribute needed. Custom property values are kept as unparsed tokens, so --x: calc($gap * 2px) stays as calc(8 * 2px).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css folds math functions in custom property values when every operand is a concrete value with compatible units (e.g. --x: calc(8 * 2px) becomes 16px); values with var(), mixed or relative-to-context units (%, vw, em, rem with px) are left untouched
- [ ] #2 Fixtures cover regular properties (documenting Lightning CSS behaviour) and custom properties; no change to semantics
<!-- AC:END -->
