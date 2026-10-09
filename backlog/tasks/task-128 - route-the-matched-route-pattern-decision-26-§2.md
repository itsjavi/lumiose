---
id: TASK-128
title: 'route(): the matched route pattern (decision-26 §2)'
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 04:26'
labels:
  - router
  - app
dependencies: []
priority: medium
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §2: route() returns the matched pattern typed as Routes, available wherever url()/params() are (server render, client router, islands). Lux authorises the matching edits in app/server for the server side.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 route() works on the server, in the SPA router and in islands; typed as the Routes union
- [ ] #2 spa-chiptune nav.ts uses route() instead of pathname matching; docs and tests
<!-- AC:END -->
