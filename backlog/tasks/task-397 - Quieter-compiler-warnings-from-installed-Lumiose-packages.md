---
id: TASK-397
title: Quieter compiler warnings from installed Lumiose packages
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
ordinal: 396000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): now that @lumiose/vite compiles Lumiose packages in node_modules, their compiler warnings (for example LUM2001, TASK-391) reach every app that installs them. Decide whether warnings from installed packages are shown, summarized or hidden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Warnings from installed packages follow a recorded policy, with a test
<!-- AC:END -->
