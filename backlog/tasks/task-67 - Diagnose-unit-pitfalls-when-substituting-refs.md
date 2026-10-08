---
id: TASK-67
title: Diagnose unit pitfalls when substituting $refs
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:16'
updated_date: '2026-10-08 20:48'
labels: []
milestone: m-1
dependencies:
  - TASK-59
priority: medium
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beacon found two silent pitfalls while documenting styles (TASK-56): a bare number substituted into a length property silently becomes px (gap: $gap ships as gap: 8px), and '$gap px' ships as '8 px' (invalid) with no diagnostic. Both are easy mistakes for agents and humans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css warns when a $ref substitution yields a unitless non-zero number in a property/position that requires a length/angle/time (suggest calc($x * 1px) or a unit-carrying constant), without changing output semantics
- [ ] #2 lumen_css reports '$ref <unit>' (whitespace between a ref and a unit identifier) with a fix to calc($ref * 1<unit>); new codes registered via Photon/registry and documented (Beacon follow-up note)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Folded into TASK-76's src/values.rs (agreed design): LUM3018 for a non-zero numeric $ref where giving it px/deg/ms makes the value valid, leaves Lightning's output unchanged (implicit px), or fixes a number/dimension mix in a math function; fix calc($x * 1px|1deg) (bare $x * 1unit inside math), time gets help only. LUM3019 for a numeric ref + whitespace + unit (or %), anywhere refs are substituted; fix calc($x * 1unit). Codes registered by Photon (TASK-81), documented by Beacon (TASK-82).
<!-- SECTION:PLAN:END -->
