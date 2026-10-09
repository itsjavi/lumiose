---
id: TASK-145
title: 'Fullstack bench: label production vs dev metrics clearly'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:19'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: 'req/s and other important things should be done on production builds; differentiate which benchmarks are for production builds and which for dev, because dev servers use Vite or Turbopack, which can differ a lot from prod servers.' The harness already runs load/server metrics against the production start scripts and dev metrics against dev servers, but results and viewer do not make the environment explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every metric carries env: dev | build | prod in the results JSON (schema bumped, old files still load); the viewer groups and badges Development (dev servers: Vite / Turbopack) vs Production (built apps on their production servers), with a one-line description of how each app is served in each mode
- [ ] #2 Results meta records each app's production server command, NODE_ENV and compression state, and the harness verifies NODE_ENV=production for prod runs; doc-4 updated
<!-- AC:END -->
