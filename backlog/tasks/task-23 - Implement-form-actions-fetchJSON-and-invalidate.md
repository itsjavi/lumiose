---
id: TASK-23
title: 'Implement form actions, fetchJSON and invalidate'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-3
dependencies:
  - TASK-22
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mutations go through form actions that work without JS and can be enhanced from islands, and reads from SPA/islands use an isomorphic fetchJSON (decision-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 action/actions with ?/name, formData, fail(), actionData(), Origin/CSRF check on by default
- [ ] #2 submit(), pending() and invalidate() client helpers; fetchJSON is served in-process during SSR
- [ ] #3 Tests for no-JS and enhanced flows
<!-- AC:END -->
