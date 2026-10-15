---
id: TASK-296
title: 'Router lifecycle hooks: before and after navigation'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 03:16'
labels:
  - router
  - spa
milestone: m-10
dependencies:
  - TASK-293
priority: medium
ordinal: 298000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`lumiose/router` exposes `navigate`, `isNavigating`, `params`, `route`, `url` and `searchParams`, but nothing runs around a navigation. Apps cannot confirm leaving a form with unsaved changes, cancel a navigation, record page views or move focus after one (React Router's useBlocker and client middleware, SvelteKit's beforeNavigate and afterNavigate).

Approved shape (decision-50): `beforeNavigate(fn)` and `afterNavigate(fn)` from `lumiose/router`, with SvelteKit's names and semantics, registered during component setup and removed on dispose. The navigation object is `{ type, from, to, willUnload, cancel() }`, with `type` one of `"link"`, `"navigate"`, `"popstate"`, `"leave"` or (afterNavigate only) `"enter"`. `cancel()` stops SPA navigations, returns to the previous entry for back/forward the browser cannot cancel (the History fallback starts storing an entry index in `history.state`), and triggers the native `beforeunload` prompt for `"leave"`. `afterNavigate` runs after the swap, scroll restoration and focus reset, and once with `"enter"` on mount. Islands on MPA pages get `"leave"` and `"enter"` only, without router code.

Code: packages/lumiose/src/app/router.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A before-navigation hook can cancel SPA link, navigate() and back/forward navigations, and the URL stays consistent after a cancel
- [ ] #2 An after-navigation hook runs once per completed navigation with the previous and new locations
- [ ] #3 Hooks are removed when the registering component is disposed
- [ ] #4 Tests cover links, navigate(), popstate, query-only changes and View Transitions
- [ ] #5 reference/router.md, concepts/routing.md and the Coming from guides are updated
- [ ] #6 afterNavigate fires once with type enter when its component mounts; islands on MPA pages get leave and enter only
<!-- AC:END -->
