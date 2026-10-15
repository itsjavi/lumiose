---
id: TASK-351
title: >-
  Shallow URL state: searchParams() and searchParams.set() in islands of MPA
  pages
status: Done
assignee:
  - Spark
created_date: '2026-10-15 13:27'
updated_date: '2026-10-15 13:27'
labels:
  - router
  - islands
dependencies: []
references:
  - >-
    backlog/decisions/decision-61 -
    Shallow-URL-state-searchParams-and-searchParams.set-in-islands-of-MPA-pages.md
modified_files:
  - packages/lumiose/src/app/router/search.ts
  - packages/lumiose/src/app/router/search.test.ts
  - packages/lumiose/src/app/router/index.ts
  - packages/lumiose/src/app/router/router.ts
  - packages/lumiose/docs/reference/router.md
  - packages/lumiose/docs/concepts/islands.md
  - packages/lumiose/docs/concepts/routing.md
priority: medium
ordinal: 352000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Islands of MPA pages (static and server routes) can keep state in the query string without reloading (decision-61, approved by the user on 2026-10-15). Before, searchParams() threw outside spa routes and searchParams.set() loaded a new document, so a server-rendered page with a search box and a table had to become spa to keep ?q= in the URL. Outside an SPA, searchParams() becomes a reactive URLSearchParams of the document's query shared by every island, and searchParams.set() writes it with history.pushState()/replaceState() without navigating; back/forward update it. Inside an SPA nothing changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In islands of MPA pages, searchParams() returns the document's query, reactive and shared by every island
- [x] #2 searchParams.set() pushes a history entry (replaceState with { replace: true } or when the URL does not change), keeps path, hash, scroll and focus, and loads nothing
- [x] #3 Back/forward between those entries update searchParams()
- [x] #4 Inside an SPA, searchParams() and searchParams.set() keep their router behaviour
- [x] #5 An island that only uses searchParams ships none of the router
- [x] #6 Tests cover the shallow mode and the SPA delegation; docs (router reference, islands concept) are updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
New app/router/search.ts holds searchParams: a routed signal the SPA router registers in spaRoot (read: currentSearchParams, set: setSearchParams), else shallow state from location.search with a popstate listener. index.ts uses it; router.ts imports searchString from it. No navigation hooks run for shallow changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone run: Lux implements this Spark-area task (solo takeover).

Validation: pnpm typecheck and pnpm lint pass; pnpm vitest run --project lumiose: 98 files, 1107 tests pass (new src/app/router/search.test.ts: 8 tests); docs:gen and docs:check pass. Tree-shaking: a rolldown bundle of an entry that imports only searchParams contains none of router.ts (no navigateTo, createRouteMatcher, listenHistory, spaRoot). Chromium check on a throwaway server page of examples/ssr-bookshelf (not committed): the island hydrated with the request's q, set() pushed an entry, { replace: true } kept the entry count and input focus, back restored the previous q through popstate without a reload, and the console had no errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
searchParams() and searchParams.set() from lumiose/router now work in islands of MPA pages as shallow URL state (decision-61). search.ts holds them: inside an SPA the router registers its implementation in spaRoot, so SPA behaviour is unchanged; elsewhere a signal of location.search, shared by every island, is written with pushState/replaceState and updated on popstate. Navigation hooks do not run for these changes, and server-rendered HTML is not re-rendered. Docs: reference/router.md (intro and searchParams), concepts/islands.md (URL state paragraph and a common mistake), concepts/routing.md table. Not covered: params(), route() and url() in islands (still SPA-only by design); no e2e test, since the islands-e2e fixture has no request scope.
<!-- SECTION:FINAL_SUMMARY:END -->
