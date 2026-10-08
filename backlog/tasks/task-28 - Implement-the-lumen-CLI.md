---
id: TASK-28
title: Implement the lumen CLI
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-4
dependencies:
  - TASK-27
  - TASK-26
  - TASK-24
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One CLI gives humans and agents every entry point, with machine-readable output (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Commands: dev, build, preview, check, typegen, routes, explain, docs (delegating to the app layer where applicable)
- [ ] #2 --format json on every command; stable exit codes; help text
- [ ] #3 Smoke tests
<!-- AC:END -->
