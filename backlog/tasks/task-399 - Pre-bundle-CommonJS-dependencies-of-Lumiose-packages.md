---
id: TASK-399
title: Pre-bundle CommonJS dependencies of Lumiose packages
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
ordinal: 398000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): Lumiose packages are kept out of Vite's dependency optimizer, so a CommonJS dependency of such a package is not pre-bundled. Add those dependencies to optimizeDeps automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Lumiose package with a CommonJS dependency works in dev without user config, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).
<!-- SECTION:NOTES:END -->
