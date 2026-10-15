---
id: TASK-296
title: 'Router lifecycle hooks: before and after navigation'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 02:22'
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

Outcome (shape approved in the design task): a hook that runs before an SPA navigation and can cancel it (and covers document navigations through `beforeunload` where the browser allows it), and a hook that runs after the new page is shown, both scoped to the component that registers them. Questions for the design: cancelling back/forward (popstate), View Transitions, `searchParams.set()` navigations, and what MPA pages get.

Code: packages/lumiose/src/app/router.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A before-navigation hook can cancel SPA link, navigate() and back/forward navigations, and the URL stays consistent after a cancel
- [ ] #2 An after-navigation hook runs once per completed navigation with the previous and new locations
- [ ] #3 Hooks are removed when the registering component is disposed
- [ ] #4 Tests cover links, navigate(), popstate, query-only changes and View Transitions
- [ ] #5 reference/router.md, concepts/routing.md and the Coming from guides are updated
<!-- AC:END -->
