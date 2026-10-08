---
id: TASK-27
title: Implement shadow TSX files and lumen check
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-4
dependencies:
  - TASK-8
  - TASK-21
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stock TS 7 must type-check .stsx through masked shadow files with identical UTF-16 offsets (decision-11, spec §9.1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shadow writer and deleter for .lumen/shadow; tsconfig template per spec §4.7; typegen is run first
- [ ] #2 lumen check runs tsc --noEmit (TS 7), maps shadow paths back to .stsx with the same line and column, and merges compiler and lint diagnostics; --format json; meaningful exit codes
- [ ] #3 Tests including $ref type errors and route types
<!-- AC:END -->
