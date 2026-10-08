---
id: TASK-21
title: 'Implement file routes, route modes and typegen'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-3
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every app mode is driven by the file-route manifest, and typed routes give agents compile errors for broken links (spec §7.1, §8).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Scans src/routes (index, [param], [...rest], (group), _layout, _404, _error, endpoints) into a manifest with inherited modes; LUM5002/5003
- [ ] #2 Typegen writes .lumen/types with typed params, RouteProps<'/path'> and href()
- [ ] #3 Unit tests
<!-- AC:END -->
