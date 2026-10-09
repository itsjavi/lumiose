---
id: TASK-149
title: Production server defaults NODE_ENV=production
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:28'
labels:
  - adapter
  - server
dependencies: []
priority: low
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-145: the bench's Lumen production server ran with NODE_ENV unset because nothing in Lumen sets it (next start does; React Router's template start script does). Libraries that branch on NODE_ENV then run in dev mode. Lumen's built server entry / adapter-node createServer should default it to production when unset (never override an explicit value), and lumen preview should run with it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A built Lumen server started without NODE_ENV runs with NODE_ENV=production; an explicit value is kept; lumen preview sets it; tests; adapter-node docs mention it
<!-- AC:END -->
