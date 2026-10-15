---
id: TASK-346
title: >-
  A dynamic import in instrumentation.client.ts pulls the runtime into pages
  without islands
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 12:36'
labels:
  - build
  - performance
dependencies: []
priority: medium
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike. When src/instrumentation.client.ts uses a dynamic import(), Vite's preload helper lands in the runtime chunk, so pages without islands or SPA routes download the 10.8 kB runtime anyway, against decision-49's promise that those pages load only the file and its imports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A page without islands loads only the client entry and its imports, also when the entry uses import()
- [ ] #2 A build test covers it
<!-- AC:END -->
