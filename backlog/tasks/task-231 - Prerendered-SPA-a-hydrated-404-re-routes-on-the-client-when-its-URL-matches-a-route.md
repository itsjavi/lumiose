---
id: TASK-231
title: >-
  Prerendered SPA: a hydrated 404 re-routes on the client when its URL matches a
  route
status: Done
assignee:
  - Spark
created_date: '2026-10-11 02:32'
updated_date: '2026-10-11 02:44'
labels:
  - router
  - app
milestone: m-7
dependencies: []
priority: high
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Spark in TASK-217. In a prerendered SPA (decision-38), a static host serves 404.html, the prerendered root _404, for every URL that was not prerendered. That includes valid routes with params that staticPaths() could not list, such as songs saved in the browser. The page hydrates as an error page, and the root _404's own ssr = false / prerender = false exports are ignored. lumiose dev renders the _404 for such URLs too. Fix, with no new API (Lux, decision-16): when an SPA 404 hydrates and its URL matches an SPA route, the router renders that route on the client instead, so deep links work on static hosts. A URL that matches no route keeps the prerendered _404, which still works without JavaScript. lumiose dev behaves the same way. Then remove the chiptune tracker's workaround (its _404 onMount re-navigation, see TASK-217 notes) and check Dotmatrix. Docs: concepts/rendering-modes 'Prerendered SPA routes' explains deep links to params that were not prerendered.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a static host, a URL that matches an SPA route but was not prerendered renders that route after hydration, with no visible 404 flash; a URL that matches no route renders the _404 with and without JavaScript
- [x] #2 lumiose dev behaves the same way, and e2e tests cover both cases on the built site and under dev
- [x] #3 The chiptune tracker's _404 workaround is removed, and docs describe deep links to params that were not prerendered
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): Design, no new API. (1) Client table: SPA pages that reroute (`reroutes()` in app/router/table.ts) get `reroute: true`: pages with params that are not rendered per request (`prerender`, or an `ssr = false` shell). Their 404s are not authoritative: a static host answers unlisted params with 404.html, and dev/server renders have no browser data. Pages rendered per request (`ssr` without `prerender`) keep their server 404. (2) Router: `prepareRoot()` for a hydrating `_404` leaf whose URL matches a page with `reroute` returns a root marked `$$fresh`, which renders the page view; the island loader (dom/islands.ts) clears the server range and renders such a component fresh (no claim, no replayed awaits), so the _404 never runs on the client. The page then decides with browser data (`notFound()` brings the _404 back). (3) No flash: the server render of an SPA `_404` (handler renderError -> `rerouteScript()` in app/router/server.ts) adds a nonce/hash-allowed inline `<head>` script with one RegExp of the SPA's rerouting pages (below `base`); on a match it hides `<html>` (CSSOM `visibility`, `data-l-reroute`) before first paint; the router reveals it once the first view and its follow-ups (error page, redirect) settle, with an 8 s timeout as a safety net. URLs that match no page, and every URL without JS, keep the _404 (status 404). Only a `_404` leaf reroutes (an `_error` page rendering a 404 does not); documented that deep links need a root `_404`.
Edits outside Spark's area (authorized by Lux): packages/lumiose/src/app/server/handler.ts (renderPage takes an extra head string; renderError passes the reroute script for ssr SPA `_404`s, memoized per SPA), examples/ssg-spa-e2e (tracks/[id]: hidden track 4 not in staticPaths, browser-saved tracks via localStorage, notFound() for unknown ids; e2e tests).
Tracker: removed the `_404` onMount re-navigation workaround; README and comments updated. Dotmatrix: no routes with params, so its 404.html gets no script and nothing reroutes: unaffected, no change needed.
Checks: vitest lumiose project 795/795 (router, app, dom, docs), vite app 59/59; pnpm typecheck clean; oxlint/oxfmt on changed files; docs:gen + docs:check green. Playwright: ssg-spa-e2e 15/15 (dev + build; new: unlisted param renders its page with no 404 flash, a browser-data page after a server 404 with no flash, unknown URLs 404 with JS, and without JS); negative control (script disabled) made the flash test fail on the build. Chiptune tracker dev + preview 28/28 (new: no-flash check on the saved-song reload, no-JS /songs/nope 404).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A `_404` that hydrates at the URL of an SPA page with params that is not rendered per request (prerendered, or an `ssr = false` shell) now renders that page on the client, so deep links to params `staticPaths()` did not list work on static hosts and in `lumiose dev`. An inline head script in the 404 hides the page until the router has rendered, so the 404 never flashes; unknown URLs keep the _404 with and without JavaScript. The chiptune tracker workaround is gone; docs (rendering-modes, router reference) describe it; e2e tests cover dev and the built site.
<!-- SECTION:FINAL_SUMMARY:END -->
