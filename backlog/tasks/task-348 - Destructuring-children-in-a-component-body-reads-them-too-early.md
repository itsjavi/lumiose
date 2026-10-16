---
id: TASK-348
title: Destructuring children in a component body reads them too early
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-16 00:41'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike (removed in TASK-363; it remains in the git history). `const { children, ...rest } = props` in a component body reads children at setup, before the slot is ready; in an island it causes a hydration mismatch (LUM4006).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Destructuring children and rest props in a component body hydrates without LUM4006
- [ ] #2 Compiler and hydration tests cover it
- [ ] #3 The JSX docs describe the pattern
<!-- AC:END -->
