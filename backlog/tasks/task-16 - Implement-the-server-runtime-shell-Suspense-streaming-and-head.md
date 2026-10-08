---
id: TASK-16
title: 'Implement the server runtime: shell, Suspense streaming and head'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
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
