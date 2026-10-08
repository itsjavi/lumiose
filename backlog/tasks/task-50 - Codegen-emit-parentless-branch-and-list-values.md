---
id: TASK-50
title: 'Codegen: emit parentless branch and list values'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 14:11'
labels: []
milestone: m-1
dependencies:
  - TASK-49
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the runtime's parentless branch/list values (TASK-49) wherever codegen falls back to tracked functions today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Conditionals and .map() in component children, fragments and nested ternaries compile to branchValue/listValue; golden fixtures updated; execution tests pass
<!-- AC:END -->
