---
id: TASK-19
title: Emit the CSS manifest and SSR stylesheet links
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:14'
labels: []
milestone: m-2
dependencies:
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server-only components have styles too, and Suspense content must not get its CSS late. CSS must be built in the client environment and mapped per route (spec §4.6.6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All style modules are built in the client environment; a module→CSS manifest is emitted
- [ ] #2 A helper computes the <link> set for a route from its static import graph, for use by the shell
- [ ] #3 Dev mode uses Vite CSS HMR without duplicating CSS
<!-- AC:END -->
