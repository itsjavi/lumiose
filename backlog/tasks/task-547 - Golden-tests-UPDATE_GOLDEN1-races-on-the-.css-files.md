---
id: TASK-547
title: 'Golden tests: UPDATE_GOLDEN=1 races on the .css files'
status: To Do
assignee:
  - Photon
created_date: '2026-10-23 21:34'
labels:
  - compiler
  - tests
dependencies: []
priority: low
ordinal: 539000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found during TASK-536. `UPDATE_GOLDEN=1 cargo test --test codegen_golden` can fail in update mode only: the client and server golden tests run in parallel and race on the same .css files. Running `-- server_goldens` alone works around it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Updating the goldens works in one run (serialize the writers, or write each side's CSS once)
<!-- AC:END -->
