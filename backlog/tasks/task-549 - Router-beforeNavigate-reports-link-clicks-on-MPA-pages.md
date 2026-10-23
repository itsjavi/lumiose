---
id: TASK-549
title: 'Router: beforeNavigate reports link clicks on MPA pages'
status: Done
assignee:
  - Spark
created_date: '2026-10-23 22:12'
updated_date: '2026-10-23 23:03'
labels:
  - router
  - dx
dependencies: []
priority: medium
ordinal: 541000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's forms, actions and auth slice (2026-10-24). On MPA pages (static and server routes), beforeNavigate only reports "leave". Repro: on a server page, an island with unsaved state calls `beforeNavigate((n) => n.cancel())`; clicking a plain `<a href="/other">` only shows the browser's generic Leave site? prompt, and no `type: "link"` call comes, so the app cannot show its own dialog. The port's workaround: a capture-phase document click listener that repeats the link checks (modifier keys, target, download, origin, path). Suggestion: on MPA pages, report same-origin link clicks as "link" with `willUnload: true`, and make cancel() prevent the click.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On MPA pages, a same-origin link click calls beforeNavigate with type "link" (willUnload true) and cancel() keeps the page; modified clicks, target and download links are left to the browser
- [x] #2 Tests cover it; the router docs describe beforeNavigate on MPA pages
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-24, worktree run for Lux). Cause: hooks.ts only listened for beforeunload on MPA pages, so every link click there was "leave" and cancel() could only trigger the browser prompt.

Change:
- hooks.ts adds a click listener at window while a beforeNavigate hook is registered. Outside an SPA (no router location), a same-origin link click that loads another document in this tab runs the hooks as "link" (willUnload; route undefined; to null outside Vite's base).
- A cancel prevents the click. Otherwise beforeunload does not run the hooks again as "leave".
- The link checks moved from history.ts to a new click.ts (followedLink), shared with the History fallback. Modifier keys, other buttons, a target other than _self, download, fragments of the current page and clicks a handler prevented are left to the browser. Other origins (mailto:, tel:) stay "leave".
- Being at window, the listener runs after the page's own handlers.
- SPA alignment, so that apps follow one rule: cancel() on a "link" or "navigate" navigation to another document now stops it too. That covers a link out of the SPA and navigate() to such a page. TASK-296 had chosen the beforeunload prompt for them; the browser now asks only for "leave".
  - Navigation API: preventDefault on the navigate event when it is cancelable.
  - History fallback: routeOf returns null, so history.ts prevents the click; navigateTo skips location.assign.
  - leaveTo(navigation, stoppable) returns whether a hook cancelled.
- Recorded as an amendment in decision-50, to be confirmed by the user. The API shape does not change, and the amendment matches decision-50's wording and SvelteKit.

Size (min+brotli, Vite/Rolldown, in-process A/B against HEAD):
- An island that uses beforeNavigate (typical imports + loader + hydrate + beforeNavigate) loads 9827 -> 10130 B brotli (+303 B). When href() is already in the bundle it is +189 B, since normalizeBase and pathBelowBase are shared.
- A typical islands page without the hooks, and the whole runtime: unchanged.
- SPA boot: +76 B (router +86, history chunk +18).
- No router code enters the islands.

Tests:
- hooks.test.ts, MPA:
  - A link click is "link" (unload) with from and to, and the hooks do not run again as "leave".
  - A cancel prevents the click, and closing the tab later still asks. The listener goes on dispose.
  - Modified, middle-button, target, download, cross-origin, mailto, fragment and prevented clicks are not reported. target=_self and same-URL links are.
  - to is null outside the base.
  - The 3 new MPA tests fail on the old hooks.ts.
- hooks.test.ts, SPA: a link out of the SPA is reported once, and a cancel prevents it. navigate() to another document is cancelled without loading (History fallback and Navigation API).
- examples/islands-e2e: a new /draft page (Draft island) with navigation-hooks.e2e.ts (2 tests), run in Chromium. Both tests fail on the old hooks.ts.
  - A cancelled link click shows the island's own dialog and keeps the page.
  - A Ctrl/Cmd click opens a tab.
  - Closing the tab asks via beforeunload.
  - Discard follows the link.
  - A click the hooks allow logs only "link".
- examples/spa-router-e2e: the editor guard now checks type === "leave". The link out of the SPA asks with confirm() and the page stays; page.close asks via beforeunload. 38/38 pass (dev and build, Navigation API and History fallback).

Docs: reference/router.md (the type table, the cancel semantics, On MPA pages, the Example), concepts/routing.md, the nextjs, react-router and solid rows in coming-from, and llms-full.txt (regenerated).

Follow-up idea, not filed: navigate() and searchParams.set() in MPA islands still unload as "leave". They are app-initiated, so the app can check its own state before calling them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
On MPA pages, beforeNavigate now reports a click on a same-origin link as "link" (willUnload) and a cancel prevents the click. The listener is a click listener at window; the link checks are shared with the History fallback (router/click.ts). Inside an SPA, a cancelled link or navigate() to another document now keeps the page too, and the browser asks only for "leave". This is a decision-50 amendment, to be confirmed by the user, with a BREAKING CHANGE footer in commit 8ae15985.

Size: an island that uses beforeNavigate loads +303 B brotli (+189 B with href()); no router code is added. SPA boot: +76 B.

Tests: hooks.test.ts (MPA and SPA), a new islands-e2e spec (navigation-hooks.e2e.ts) and the updated spa-router-e2e guard.

Validation: pnpm check green; islands-e2e 10/10; spa-router-e2e 38/38.
<!-- SECTION:FINAL_SUMMARY:END -->
