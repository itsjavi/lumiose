---
id: TASK-294
title: Folder-scoped middleware and ctx.route
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
labels:
  - middleware
  - routing
milestone: m-10
dependencies:
  - TASK-293
priority: high
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the only middleware is `src/middleware.ts` (a function or an array), run for every page, form action and endpoint. Scoping it means testing `ctx.url.pathname`, and `ctx` has no matched route pattern. A layout can guard with `locals()` and `redirect()`, but that guard does not cover the folder's form actions or `route.ts` endpoints, so auth for a section such as `/admin` has no safe per-folder home.

Outcome (shape approved in the design task): a `middleware.ts` in a route folder runs for the pages, actions and endpoints below it, after `src/middleware.ts` and outermost first, and every middleware gets the matched pattern as `ctx.route`, typed by the routes table. Questions for the design: `static` and prerendered routes (in production, static files are served without middleware), i18n locale prefixes, groups and optional segments, and how `lumiose routes` shows middleware.

Code: packages/vite/src/app/project.ts (MIDDLEWARE_FILES), packages/vite/src/app/routes, packages/lumiose/src/app/server/handler.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A folder middleware.ts runs for the pages, form actions and endpoints below its folder, after the root middleware and outermost first, and for nothing else
- [ ] #2 ctx.route is the matched pattern in every middleware, and folder middleware types ctx.params by its folder
- [ ] #3 Behaviour on static and prerendered routes is defined, and misuse gets a diagnostic
- [ ] #4 lumiose routes lists each route's middleware chain
- [ ] #5 Tests cover order, scoping, actions, endpoints, groups and optional segments
- [ ] #6 concepts/server.md, concepts/routing.md, reference/app.md and the Coming from guides are updated
<!-- AC:END -->
