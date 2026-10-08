---
id: TASK-67
title: Diagnose unit pitfalls when substituting $refs
status: Done
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
- [x] #1 lumen_css warns when a $ref substitution yields a unitless non-zero number in a property/position that requires a length/angle/time (suggest calc($x * 1px) or a unit-carrying constant), without changing output semantics
- [x] #2 lumen_css reports '$ref <unit>' (whitespace between a ref and a unit identifier) with a fix to calc($ref * 1<unit>); new codes registered via Photon/registry and documented (Beacon follow-up note)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Folded into TASK-76's src/values.rs (agreed design): LUM3018 for a non-zero numeric $ref where giving it px/deg/ms makes the value valid, leaves Lightning's output unchanged (implicit px), or fixes a number/dimension mix in a math function; fix calc($x * 1px|1deg) (bare $x * 1unit inside math), time gets help only. LUM3019 for a numeric ref + whitespace + unit (or %), anywhere refs are substituted; fix calc($x * 1unit). Codes registered by Photon (TASK-81), documented by Beacon (TASK-82).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo, 2026-10-08: implemented together with TASK-76 (crates/lumen_css/src/values.rs; codes UnitlessStyleRef=LUM3018, DetachedUnit=LUM3019). Evidence (tests/fixtures/values.out): 'gap: $gap' (8) -> LUM3018 'Lightning CSS outputs it as 8px, but CSS itself rejects unitless lengths', fix calc($gap * 1px); 'rotate: $angle' -> angle, fix calc($angle * 1deg); 'transition: opacity $duration' -> time, help ms or s, no fix; 'width: calc($gap + 1px)' and 'max-width: min(100%, $max)' -> fix '$gap * 1px' inside the math function; 'margin: $gap px' -> LUM3019 fix calc($gap * 1px); 'calc($gap px + 1px)' -> fix '$gap * 1px'; string constants that are numbers ('16') count. No warning for line-height/opacity/z-index/flex/columns/aspect-ratio/animation iteration counts, repeat($n, …), calc($x * 1px), SVG user-unit properties (stroke-width, r, cx, …), custom properties (LUM3018) or zero. Output CSS unchanged (warnings only). Unit tests reports_unitless_numbers, reports_detached_units, suggests_units_in_math_without_calc. Follow-ups: TASK-81 (registry, Photon), TASK-82 (docs, Beacon).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unit pitfalls with $refs are now diagnosed by lumen_css: LUM3018 (unitless numeric constant where a length/angle/time is required; fix calc($x * 1px|1deg), or $x * 1px inside math; time help only) and LUM3019 ('$ref <unit>' with whitespace; fix calc($ref * 1<unit>)). Output semantics unchanged. Registry entry: TASK-81 (Photon); docs: TASK-82 (Beacon).
<!-- SECTION:FINAL_SUMMARY:END -->
