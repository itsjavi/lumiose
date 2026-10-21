---
id: TASK-503
title: >-
  create-lumiose: oxfmt adds a blank line after the AGENTS.md managed-block
  marker
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-21 01:38'
labels: []
dependencies: []
priority: low
ordinal: 499000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while preparing the dotmatrix workspace (TASK-488): formatting the AGENTS.md that create-lumiose writes with oxfmt inserts a blank line after the managed-block marker, so a later create or update sees a changed block. Make the generated block oxfmt-stable (or have the updater tolerate the blank line).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 oxfmt leaves a freshly generated AGENTS.md unchanged, and updating the managed block after oxfmt works (test)
<!-- AC:END -->
