---
id: TASK-546
title: >-
  LUM2001/LUM2003: lumiose/router params(), route() and locale() in pages vs
  layouts
status: To Do
assignee: []
created_date: '2026-10-23 21:28'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 536000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-536. Inside an SPA, params(), route() and locale() from lumiose/router are stable for a page's whole life (a page with other params is a new page) but change for a layout's code. The compiler cannot tell a page's module from a layout's, so today it reports the derived forms in pages, where they never go stale (const id = params().id is LUM2001, if (!params().id) return is a LUM2003 error), and leaves the plain copies (const { id } = params()) unreported in layouts, where they do. Telling them apart needs the module's route kind (page, layout, other), passed to the compiler by @lumiose/vite, lumiose check and the language server, as server_route is. Components rendered by a layout outside its outlet would still be unknown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decide whether the route kind is worth passing to the compiler, and record the decision
- [ ] #2 If so, params()/route()/locale() reads in a page's own module are not reactive reads, and their copies in a layout's module are reported, with tests and the LUM2001/LUM2003 pages updated
<!-- AC:END -->
