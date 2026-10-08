---
id: TASK-61
title: Guard against negative calc folding in non-negative properties
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 15:59'
updated_date: '2026-10-08 15:59'
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
- [ ] #2 Fixture covering the case; a minimal upstream bug report drafted in the task notes (not filed; filing publicly needs the user's approval)
<!-- AC:END -->
