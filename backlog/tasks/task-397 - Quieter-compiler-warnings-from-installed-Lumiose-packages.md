---
id: TASK-397
title: Quieter compiler warnings from installed Lumiose packages
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-16 01:47'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).
<!-- SECTION:NOTES:END -->
