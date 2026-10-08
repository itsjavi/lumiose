---
id: TASK-97
title: Keep SVG component root attributes in the template
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 21:46'
labels: []
milestone: m-3
dependencies:
  - TASK-70
priority: low
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Halo noticed (TASK-70) that every SVG icon component sets its root attributes at runtime because of how props are spread, instead of keeping the file's static attributes in the template.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Static root attributes of compiled SVG components stay in the template HTML; only props that are actually passed are applied at runtime; goldens and size check
<!-- AC:END -->
