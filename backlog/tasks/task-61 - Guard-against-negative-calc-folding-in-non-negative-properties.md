---
id: TASK-61
title: Guard against negative calc folding in non-negative properties
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 15:59'
updated_date: '2026-10-08 16:06'
labels: []
milestone: m-1
dependencies:
  - TASK-55
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Halo found a Lightning CSS behaviour (TASK-55): padding-left: calc(2px - 7px) is folded to -5px and merged into a padding shorthand. Browsers drop negative padding as invalid, whereas the calc() form clamps to 0 at computed time. Build output can therefore change semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css detects calc expressions in properties with non-negative ranges (padding*, width/height/min/max-*, border-width, gap, font-size, line-height, …) whose folded value would be negative, and keeps them as calc() (or emits max(0px, …)) so semantics are preserved
- [ ] #2 Fixture covering the case; upstream lightningcss#1000 / fix PR #1329 referenced in a code comment and the task notes, with a note that the guard can be removed after upgrading to a release that includes #1329 (the fixture must still pass then)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the prepass scan to record declarations (name/value ranges) in style, keyframe and other declaration blocks.
2. New src/clamp.rs: for properties whose numeric components are all non-negative (padding*, scroll-padding*, sizes, border*-width/-radius and width-only border shorthands, gap*, font-size, line-height, flex*, grid track properties, durations, …), find top-level math functions (and those inside minmax(), fit-content(), repeat() track lists), evaluate them with the $ref substitutions applied via fold::evaluate, and wrap negative results in max(0<same unit>, …) with two insert edits; Lightning CSS then folds them to 0 (= browser calc clamping, = upstream #1329 semantics).
3. Plain numbers only in properties accepting numbers (width: calc(2 - 7) stays invalid instead of becoming width: 0).
4. Fixture negative_math.stsx (upgrade-stable cases) + unit tests for version-dependent cases; cargo test/clippy/fmt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: already reported upstream as parcel-bundler/lightningcss#1000. Fixed by PR #1329 (merged 2026-09-26: NonNegative wrapper; negative calc results in non-negative properties are clamped to 0), but not yet released (npm 1.33.0 from 2026-07-20; crate alpha.72). No new upstream issue is needed. The guard mirrors the upstream semantics until we upgrade.
<!-- SECTION:NOTES:END -->
