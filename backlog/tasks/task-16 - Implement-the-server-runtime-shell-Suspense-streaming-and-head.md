---
id: TASK-16
title: 'Implement the server runtime: shell, Suspense streaming and head'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:11'
labels: []
milestone: m-2
dependencies:
  - TASK-7
  - TASK-6
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-19 requires holding the shell until all non-Suspense content resolves, then streaming boundaries out of order, with correct status, redirects and head handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 renderToStream/renderToString implement the shell-first model; boundaries stream via <template for> with a $swap fallback; SSG renders fully resolved
- [ ] #2 Context frames, request-scoped accessors, Head/Title/Meta collection, ErrorBoundary on the server, LUM5004
- [ ] #3 Data-only serialization (JSON / seroval JSON mode) for island props and await records; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reassigned from Spark to Nova to balance load. Nova owns the server half of the request pipeline, and Spark keeps core/dom/client async. Requirements carried over from TASK-22:
- renderToStream(root, { signal?, resolveAll? }) resolves when the shell is ready and returns { head, body, stream | null }.
- It rejects with the first thrown shell value, unwrapped.
- It reads the request through the app layer's getRequestScope(); do not duplicate the accessors.
- It uses the server core variant (packages/lumen/src/core/server.ts from TASK-7).

Nova: started (session nova-task16-20261008T131130Z). Plan: src/server/{node,escape,frame,ssr,components,island,serialize,render}.ts; index.ts = ServerRuntime + renderToStream/renderToString; public.ts = core server + render APIs + Suspense/ErrorBoundary/Head/Title/Meta. Then TASK-22 integration (createServerRenderer, document through createComponent).
<!-- SECTION:NOTES:END -->
