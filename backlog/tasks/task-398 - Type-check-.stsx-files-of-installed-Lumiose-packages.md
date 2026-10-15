---
id: TASK-398
title: Type-check .stsx files of installed Lumiose packages
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 19:22'
labels:
  - build
milestone: m-12
dependencies:
  - TASK-390
priority: low
ordinal: 397000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): .stsx files in installed packages have no shadow files, so `lumiose check` cannot type-check apps against them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `lumiose check` type-checks an app that imports .stsx components from an installed package
<!-- AC:END -->
