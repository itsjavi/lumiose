---
id: TASK-109
title: 'LUM2001: server pages deriving from their own props should not warn'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 04:03'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-86. A server-mode page deriving a value from its own props (params.slug.toUpperCase()) still warns LUM2001, because the compiler does not know the route mode. Needs the route mode passed by the Vite plugin and lumen check / language server (same answer in all three).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pages whose route mode is server or static do not get LUM2001 for reads of their own props; islands and spa routes still do; Vite, lumen check and the LSP agree
- [ ] #2 Golden or unit tests; LUM2001 docs page updated
<!-- AC:END -->
