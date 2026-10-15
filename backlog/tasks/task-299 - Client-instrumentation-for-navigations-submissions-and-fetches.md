---
id: TASK-299
title: 'Client instrumentation for navigations, submissions and fetches'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 03:16'
labels:
  - observability
milestone: m-10
dependencies:
  - TASK-293
  - TASK-295
priority: low
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing reports what happens in the browser: SPA navigations, `submit()` calls, `fetchJSON` and `query` requests, island hydration, and uncaught errors in islands. React Router instruments its client router; Lumiose apps have to patch these by hand.

Approved shape (decision-49): `src/instrumentation.client.ts` exports `onError(error, info)` for island errors (`"hydrate"`, `"render"`, `"effect"`), router errors (`"navigate"`) and `submit()` rejections (`"submit"`), and `instrumentations`: observers wrapping `navigate`, `submit`, `fetch` (`fetchJSON` and `query`) and `hydrate` (each island), with the server's observer rules. Exports that do not exist cost nothing: the build drops the dispatch code. TASK-305 makes island load failures reportable first.

Code: packages/lumiose/src/app/router, packages/lumiose/src/dom, and packages/lumiose/src/app/actions (Nova's area: coordinate with Nova).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Navigations, submissions, fetchJSON and query requests and island hydration can be wrapped, with route and timing
- [ ] #2 Uncaught errors in islands and the router reach the hook
- [ ] #3 Apps that register no hooks ship no extra runtime bytes (size checks)
- [ ] #4 Tests cover each phase
- [ ] #5 The docs and the Coming from guides are updated
<!-- AC:END -->
