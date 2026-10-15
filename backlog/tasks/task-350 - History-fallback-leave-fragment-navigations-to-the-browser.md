---
id: TASK-350
title: 'History fallback: leave fragment navigations to the browser'
status: In Progress
assignee:
  - Spark
created_date: '2026-10-15 13:19'
updated_date: '2026-10-15 13:25'
labels: []
dependencies: []
priority: medium
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-345. In the SPA router's History API fallback (packages/lumiose/src/app/router/history.ts, router.ts), navigate() to a URL that only moves to a fragment of the current document runs as a client navigation (beforeNavigate/afterNavigate hooks, pushState, scroll, focus reset), while with the Navigation API the router ignores the navigate event (hashChange) and the browser handles it. Also, browsers fire popstate (state null) for fragment navigations before scrolling to the fragment (verified in Chromium for link clicks, location.assign and location.replace), so the fallback's popstate handler treats an in-page anchor click as a traversal to an unknown entry and scrolls back to the top once it commits. Owner area: packages/lumiose/src/app/router/** (Spark).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the History fallback, navigate() to a URL with a fragment whose path and query are the current ones is left to the browser (location.assign, or location.replace with { replace: true }): no beforeNavigate/afterNavigate hooks, no focus reset, no announcement
- [x] #2 The popstate of a browser fragment navigation (navigate(), an in-page link, location.hash) does not scroll (the browser scrolls to the fragment), keeps focus, commits the URL so url() follows, and stamps the new entry with a key so back/forward restores its scroll position
- [x] #3 The stamped entry's index is exact when the browser replaced the entry or added one at the end; otherwise it is left unknown (no guessed index)
- [x] #4 A link or popstate to the current path and query with a fragment (also an empty or unchanged one) is not a navigation for the hooks, as with the Navigation API
- [x] #5 Vitest (happy-dom) tests emulate the browser's fragment navigation (popstate before the scroll) and cover navigate(), replace, in-page links and back/forward to a stamped entry
- [x] #6 Docs (reference/router.md) describe hash-only navigations if the behaviour text changes; docs:check green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. router.ts navigateTo(): in the fallback, a URL with a fragment and the current path and query goes to historyFragment() (location.assign, or location.replace for { replace: true }) before begin(), so no hooks run.
2. history.ts onPopState(): a same-page popstate to an entry without a key is a browser fragment navigation: give it a key and an index (current when replaced, next when history.length grew, else unknown), commit the URL without scrolling (keepScroll) and keep focus.
3. Fragment rule ('#' in the URL, same path and query) shared by onClick, navigateTo and routeOf (routeOf also counts a move away from a fragment of the page).
4. Tests emulating Chromium's event order; docs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone takeover: implemented by a standalone session under the Spark nickname (the user asked to do it in the TASK-345 session).

Verified in Chromium (built-in browser, a scratch page on example.com): a link click to #target, location.assign('#target') and location.replace('#target') each fire popstate synchronously with state null before the browser scrolls to the fragment (scrollY 0 in the listener, about 3000 right after), then hashchange; assign and click grow history.length, replace does not; location.assign(current URL with the same fragment) fires popstate (no hashchange) and scrolls again. So before this change an in-page anchor click in the fallback jumped back to the top once the popstate-started traversal committed (scrollTo(0, 0) for an entry without a stored position). happy-dom fires no popstate for fragment navigations and adds an entry for location.replace, so the tests emulate the Chromium order (pushState/replaceState with null, popstate, then the scroll).

Index choice: no guessing. An entry the browser added after going back (history.length does not grow) or replaced outside navigate() gets an unknown index; a cancelled back/forward involving it then uses the existing pushState path.

Remaining divergence (unchanged, pre-existing): with the Navigation API the router ignores hashChange navigate events entirely, so url() keeps the old hash there, while the fallback commits it.

Integration pending (2026-10-15): implemented, validated and committed on branch claude/reverent-engelbart-0b1530 (commit 5c0a82ab), not yet in main. The main checkout has another session's uncommitted edits to the same files (packages/lumiose/src/app/router/router.ts, router/index.ts, docs/reference/router.md, docs/llms-full.txt; Lux, shallow URL state for islands, decision-61), so merging now would collide with that work. Next action: once those edits are committed, merge the branch into main, resolve any conflicts in router.ts/router.md, regenerate llms-full.txt (pnpm --filter lumiose docs:gen), rerun the router tests, then mark Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The History API fallback now leaves fragment navigations to the browser, as the Navigation API path does.

- router.ts: navigate() to a URL with a fragment and the current path and query calls historyFragment() (location.assign, or location.replace with { replace: true }) instead of a client navigation: no beforeNavigate/afterNavigate hooks, no focus reset, no announcement. routeOf() treats any same-page popstate with a fragment on either side as no navigation for the hooks (also the same fragment again).
- history.ts: the popstate of a browser fragment navigation (navigate(), an in-page link, location.hash; detected as a same-page entry without a key) commits the URL without scrolling, keeps focus, and stamps the entry with a key and an index (exact for a replace or an entry added at the end, else unknown), so back/forward restores its scroll position. Fixes in-page anchor clicks jumping back to the top in the fallback. In-page link detection now also covers href="#" and the current fragment.
- Docs: reference/router.md (navigate, Behaviour: Scroll and focus); llms-full.txt regenerated.

Validation: 5 new tests in accessibility.test.ts (emulating Chromium's fragment navigation order, which was verified in the built-in browser) fail on the previous code and pass; vitest run in packages/lumiose: 96 files, 1100 tests passed; pnpm --filter lumiose typecheck exit 0; pnpm lint exit 0 with no router warnings; oxfmt clean; docs:gen run, docs:check green. Not run in a browser without the Navigation API (the fallback's real target).
<!-- SECTION:FINAL_SUMMARY:END -->
