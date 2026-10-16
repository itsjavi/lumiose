---
id: TASK-422
title: 'Production CSS rewrites :dir() so it misses a dir attribute'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:39'
updated_date: '2026-10-16 04:06'
labels:
  - build
  - css
milestone: m-12
dependencies: []
priority: medium
ordinal: 420000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-385 (2026-10-16). The production minifier, Lightning CSS, rewrites `:dir(rtl)` for the configured CSS targets, and the rewrite misses an element whose direction comes from a `dir` attribute. Those rules work in dev only. @lumiose/ui now avoids `:dir()`, but users' own CSS hits the same bug. Raise the targets so `:dir()` passes through (every supported browser has it), or stop that one transform, and add a build test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `:dir(rtl)` in a component's CSS matches under a `dir` attribute in a production build, with a test
- [ ] #2 The supported-browsers docs and the CSS targets agree
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 9 (no Spark or Photon session is running; it may edit the files the fix needs).
<!-- SECTION:NOTES:END -->
