---
id: TASK-399
title: Pre-bundle CommonJS dependencies of Lumiose packages
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
