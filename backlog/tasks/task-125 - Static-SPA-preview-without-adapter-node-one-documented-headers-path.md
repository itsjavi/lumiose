---
id: TASK-125
title: Static/SPA preview without adapter-node; one documented headers path
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 04:20'
labels:
  - app
  - cli
dependencies: []
priority: low
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 findings 14 and 15: lumen preview requires @lumen/adapter-node even when no route needs a server, and lumen build always writes dist/server; the chiptune SPA declares COOP/COEP in three places.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen preview serves dist/client with a built-in static server when no route needs the server, and dist/server is skipped then
- [ ] #2 Docs show one recommended way to set response headers per deployment target
<!-- AC:END -->
