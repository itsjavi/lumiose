---
id: TASK-125
title: 'Static/SPA preview without adapter-node; lumen({ headers }) (decision-26 §4)'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:26'
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
- [ ] #3 lumen({ headers }) per decision-26 §4 applies in dev, preview and adapter-node and emits _headers for prerendered output; the chiptune sample uses it in one place; docs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: decision-26 §4 (user-approved B5) folded in.
<!-- SECTION:NOTES:END -->
