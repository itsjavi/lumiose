---
id: TASK-216
title: Prerender SPA routes at build time with export const prerender = true
status: To Do
assignee:
  - Nova
created_date: '2026-10-10 22:50'
labels:
  - app
  - build
milestone: m-7
dependencies: []
priority: high
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-38 (user 2026-10-11). Today a spa route is either server-rendered per request (needs a server) or an ssr = false shell. Add build-time prerendering: `export const prerender = true` on a spa route (with staticPaths() for params), or `lumiose({ prerender: true })` as the project default, renders it in the build's prerender step and emits HTML that hydrates into the client router. A build whose routes are all static or prerendered needs no dist/server. Typegen, diagnostics (a prerendered route that reads the request, prerender together with ssr = false) and docs follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 export const prerender = true and lumiose({ prerender: true }) prerender spa routes (staticPaths() for params) into HTML that hydrates into the SPA router
- [ ] #2 An all-prerendered build emits no dist/server; prerender combined with ssr = false, or a prerendered route reading the request, is a LUM diagnostic
- [ ] #3 concepts/rendering-modes, the reference pages and llms.txt are updated, with tests covering hydration and client navigation from a prerendered page
<!-- AC:END -->
