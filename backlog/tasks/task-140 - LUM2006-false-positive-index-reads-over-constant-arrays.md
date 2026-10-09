---
id: TASK-140
title: 'LUM2006 false positive: index reads over constant arrays'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 05:10'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-133 (Chime): CHANNELS.map((info, i) => { const ch = i … }) over a module-level constant array whose rows never move warns LUM2006. The index of a constant, never-reordered source is stable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No LUM2006 when the list source is a module-level const array literal (or as const) that is never mutated; reactive sources still warn; golden/test; LUM2006 docs mention it
<!-- AC:END -->
