---
id: TASK-174
title: 'Perf: production server bundle size'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 12:12'
labels:
  - perf
  - build
milestone: m-7
dependencies: []
priority: low
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fullstack bench: Lumen's server output is 164 kB vs React Router's 70 kB (RR keeps dependencies external). Find what is in it (visualizer), keep build-time/prerender/dev-only code out of the production server entry, and externalize dependencies for Node targets (edge targets stay bundled).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bundle composition documented in the notes; production server entry smaller with no runtime behaviour change; cold start and req/s unchanged or better
<!-- AC:END -->
