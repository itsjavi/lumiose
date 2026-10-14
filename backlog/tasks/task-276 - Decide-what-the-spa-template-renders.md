---
id: TASK-276
title: Decide what the spa template renders
status: To Do
assignee:
  - Lux
created_date: '2026-10-14 00:31'
labels: []
dependencies: []
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the pre-0.4.0 docs audit (TASK-275). The spa template (packages/create/templates/spa) sets lumiose({ mode: 'spa' }) with ssr and prerender at their defaults (true, false), so its routes render on the server per request and the build has a dist/server, yet the template ships no server.ts or start script, and its descriptions (scaffold.ts, getting-started.md, create-lumiose README) say 'client-rendered' / 'rendered in the browser'. Needs the user's call: prerender the pages (static deploy, prerendered first paint, client routing; recommended), ssr = false (a shell only), or keep server rendering and add the Node server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user's choice is recorded and the template, its tests and its three descriptions match it
<!-- AC:END -->
