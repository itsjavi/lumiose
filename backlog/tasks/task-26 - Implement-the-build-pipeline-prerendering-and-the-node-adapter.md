---
id: TASK-26
title: 'Implement the build pipeline, prerendering and the node adapter'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-3
dependencies:
  - TASK-22
  - TASK-19
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Production needs client and server builds plus prerendering for static routes, producing deployable output (spec §8 Build).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen build runs the client build, the server build, then prerenders static routes (staticPaths) and static GET endpoints; LUM5001 when a request API is used while prerendering
- [ ] #2 Output layout dist/client (path/index.html, trailingSlash option, base, 404.html) and dist/server/entry.js
- [ ] #3 @lumen/adapter-node serves the build; lumen preview works; fully static sites deploy with dist/client only
<!-- AC:END -->
