---
id: TASK-31
title: Implement lumen lint and lumen fmt
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:25'
labels: []
milestone: m-4
dependencies:
  - TASK-27
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare oxlint and oxfmt cannot read .stsx, so Lumen wraps them around the masking invariant (spec §9.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen lint runs oxlint on shadow TSX and filters diagnostics inside style blocks; optional stylelint on CSS parts
- [ ] #2 lumen fmt formats TSX with oxfmt and CSS blocks separately, then re-indents and stitches; idempotent; $refs preserved
- [ ] #3 Tests
<!-- AC:END -->
