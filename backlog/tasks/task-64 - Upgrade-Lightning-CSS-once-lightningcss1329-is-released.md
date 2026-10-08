---
id: TASK-64
title: Upgrade Lightning CSS once lightningcss#1329 is released
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 16:05'
labels: []
milestone: m-7
dependencies:
  - TASK-61
priority: low
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upstream fixed negative calc folding in non-negative properties (lightningcss#1000 / PR #1329, merged 2026-09-26). When a release includes it (npm > 1.33.0, crate > 1.0.0-alpha.72), upgrade the exact pins and drop our TASK-61 guard if it becomes redundant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lightningcss pins upgraded (crate and any npm usage), fixtures pass, the TASK-61 guard removed or documented as defence in depth
<!-- AC:END -->
