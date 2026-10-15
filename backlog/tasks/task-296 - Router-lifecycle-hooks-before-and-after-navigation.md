---
id: TASK-296
title: 'Router lifecycle hooks: before and after navigation'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 04:46'
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
- [x] #1 A before-navigation hook can cancel SPA link, navigate() and back/forward navigations, and the URL stays consistent after a cancel
- [x] #2 An after-navigation hook runs once per completed navigation with the previous and new locations
- [x] #3 Hooks are removed when the registering component is disposed
- [x] #4 Tests cover links, navigate(), popstate, query-only changes and View Transitions
- [x] #5 reference/router.md, concepts/routing.md and the Coming from guides are updated
- [x] #6 afterNavigate fires once with type enter when its component mounts; islands on MPA pages get leave and enter only
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (worker, branch claude/spark-m10-22e4a4) started 2026-10-15.

Implementation (Spark):
- New packages/lumiose/src/app/router/hooks.ts (no router imports, so MPA islands that use the hooks ship none of the router): beforeNavigate/afterNavigate registries, the beforeunload listener (added while a beforeNavigate hook is registered, removed with the last one), the enter-on-mount logic, and the dispatch the router calls (runBefore, leaveTo, startNavigation, endNavigation, setRouterLocation). Exported from lumiose/router; the node variant (index.server.ts) has no-op versions.
- router.ts: every client navigation builds { type, from, to, willUnload } (from = committed view; to = locate(): route pattern and params from the matcher for any app route, SPA or not; null outside the app: another origin or outside the base). Types: link (link clicks, GET forms, script navigations without info), navigate (navigate(), searchParams.set(); passed as navigation.navigate() info), popstate, leave. A thrown redirect() runs no beforeNavigate (it continues a confirmed navigation; SvelteKit does the same) and its afterNavigate has type navigate. Hash-only changes are not navigations for the hooks.
- Navigation API: hooks run in the navigate event; cancel = preventDefault, or for a traversal the browser does not let us cancel: intercept with a no-op and traverseTo(the left entry, info RESTORE), whose event is intercepted without hooks. afterNavigate runs on navigation.transition.finished (after scroll restoration and focus reset).
- History fallback (history.ts): entries store lumiose:index next to lumiose:key; a cancelled popstate goes back with history.go(left - arrived) and ignores the popstate that follows; if an index is unknown (an entry the router did not create), it pushes the left URL back. historyGo reports through done(shown) after scroll and focus.
- Document navigations from the SPA (links out, navigate() to another document, back to another document) run the hooks with willUnload: true and the destination; a cancel makes beforeunload call preventDefault (the browser prompt), and beforeunload does not run them again as leave. Closing the tab, typing a URL, reload and POST forms are leave (to: null).
- afterNavigate fires once with enter on mount (from: null), except for components that a navigation in progress created: they get that navigation's call instead (no double page view). On MPA pages route is undefined.
- Also fixed in passing: a page module that fails to load during a navigation now reloads the (already committed) URL with location.reload() instead of location.assign(url), which the Navigation API listener would intercept again; its hooks already ran, so no leave.
- Public names (decision-50, SvelteKit vocabulary): beforeNavigate, afterNavigate, and the types BeforeNavigate, AfterNavigate, NavigationTarget, NavigationType (SvelteKit's names). The base type is internal (RouterNavigation), so the DOM's global Navigation type is not shadowed. NavigationTarget.route is Routes | undefined (Lumiose's route() type) rather than SvelteKit's { id }.
- Size (vite build, minify, brotli 11, same bundling as scripts/size.ts; main vs branch): SPA bundle (router exports + startSpa) 12560 -> 13126 B (+566 B, of which about 70 B is TASK-305's loader change); History fallback chunk 727 -> 884 B; an island bundle that uses the hooks on an MPA page +275 B. doc-8 estimated 0.3 kB.
- Tests: src/app/router/hooks.test.ts (14): History fallback (enter, link, navigate, query-only, cancel, popstate restore, disposal, view transitions, willUnload + beforeunload), a stand-in Navigation API (link/navigate cancel, cancelable and non-cancelable traversal, supersede, document navigation), and an MPA component (leave only, enter once, listener removed). examples/spa-router-e2e: a new editor page and a spec run in Chromium with the Navigation API and with the History fallback, under dev and the build (34/34 pass).
- Docs: reference/router.md (Navigation hooks section, example), concepts/routing.md, coming-from-react.md (useBlocker row), docs README/llms regenerated. The Coming from React Router, Next.js and Solid guides do not exist yet (TASK-302 to TASK-304, Beacon): notes added there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
beforeNavigate and afterNavigate ship in lumiose/router with SvelteKit semantics (decision-50): cancel for SPA links, navigate() and back/forward on both the Navigation API and the History fallback (which now stores an entry index), the browser prompt for navigations that unload the document, afterNavigate after swap/scroll/focus and once with enter on mount, leave/enter only in MPA islands without router code. Unit tests, a Chromium e2e spec in both router modes, and docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
