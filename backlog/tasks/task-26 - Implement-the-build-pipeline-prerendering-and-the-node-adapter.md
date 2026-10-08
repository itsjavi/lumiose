---
id: TASK-26
title: 'Implement the build pipeline, prerendering and the node adapter'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:52'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-23 (Nova): the request handler ignores route modes, so pages exporting action/actions serve POST in dev. For static (prerendered) pages with actions, the build must still route POSTs to the server entry (or require mode = "server" with a diagnostic). Decide and implement here. The handler's csrf option (default on, { allowedOrigins } or false) should be exposed through lumen({ … }) config / the adapter.

Lux (from Nova): reuse app/server/node-http.ts for adapter-node; apply Vite base to route matching; the dev server/build should write shadows (or leave that to lumen check), decide in this task.
<!-- SECTION:NOTES:END -->
