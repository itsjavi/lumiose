---
id: TASK-230
title: 'Fullstack harness: count runtime dependencies the same way for every app'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-11 02:05'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Quasar's TASK-202/203 finding: 'Production dependency packages' follows each template's package.json. SvelteKit lists everything as devDependencies (as sv create does), so it reads 0, while SolidStart reads 177, and both builds run without node_modules. Redefine the metric as the packages the production server actually loads from node_modules at runtime: trace the bare imports of the server output, transitively through the resolved packages, the same way for every app. Keep the client JS payload metrics as they are. Update doc-4 and the viewer label.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The metric counts the packages the production server loads at runtime, measured the same way for all apps, with the method in doc-4
- [ ] #2 Values for every app are checked by hand against a manual trace on at least two apps
<!-- AC:END -->
