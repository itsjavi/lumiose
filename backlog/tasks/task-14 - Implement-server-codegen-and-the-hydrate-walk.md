---
id: TASK-14
title: Implement server codegen and the hydrate walk
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-2
dependencies:
  - TASK-9
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SSR must output strings with fused escaping and no instances. Hydration needs a separate claim walk that is tree-shaken when unused (spec §5.2-5.3, §7.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server output uses sync-first ssr() with hoisted parts, escaping, and markers only inside island subtrees and async instance ranges
- [ ] #2 The hydrate walk is a separate generated path, emitted only for modules reachable from island or SPA entries
- [ ] #3 Golden fixtures for server and hydrate output
<!-- AC:END -->
