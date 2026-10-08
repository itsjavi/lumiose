---
id: TASK-24
title: Integrate the dev server with Vite environments
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:30'
labels: []
milestone: m-3
dependencies:
  - TASK-22
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen dev must serve SSR, static and SPA routes from source with HMR, using the Vite 8 Environment API (client + ssr).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen dev serves all route modes with SSR in the ssr environment and islands/SPA in the client environment
- [ ] #2 HMR works for components, styles and routes; error overlay shows LUM diagnostics
- [ ] #3 Verified in a browser on a sample route set
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (decision-21): support lumen({ mode, ssr }) as the project default mode in the manifest and dev server.
<!-- SECTION:NOTES:END -->
