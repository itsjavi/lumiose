---
id: TASK-95
title: 'lumen preview and adapter-node: honour configured response headers'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:43'
labels: []
milestone: m-3
dependencies:
  - TASK-26
priority: medium
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spark found (TASK-72) that lumen preview serves the chiptune's static shells without the COOP/COEP headers configured for Vite dev, so audio falls back to postMessage instead of SharedArrayBuffer. Apps need a way to set response headers for static assets and shells in preview and production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen preview applies Vite's preview.headers (falling back to server.headers), and adapter-node accepts a headers option (static + dynamic responses); documented in reference/adapter-node and reference/cli
- [ ] #2 The chiptune runs crossOriginIsolated under lumen preview (Playwright check)
<!-- AC:END -->
