---
id: TASK-352
title: >-
  searchParams.set() loads the page by default in islands of MPA pages; {
  shallow: true } opts in to URL-only updates
status: Done
assignee:
  - Spark
created_date: '2026-10-15 16:42'
updated_date: '2026-10-15 16:43'
labels:
  - router
  - islands
dependencies:
  - TASK-351
references:
  - >-
    backlog/decisions/decision-61 -
    Shallow-URL-state-searchParams-and-searchParams.set-in-islands-of-MPA-pages.md
modified_files:
  - packages/lumiose/src/app/router/search.ts
  - packages/lumiose/src/app/router/search.test.ts
  - packages/lumiose/src/app/router/index.ts
  - packages/lumiose/src/app/router/index.server.ts
  - packages/lumiose/src/app/router/router.ts
  - packages/lumiose/docs/reference/router.md
  - packages/lumiose/docs/concepts/islands.md
priority: medium
ordinal: 353000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-351. The user chose on 2026-10-15 that searchParams.set() in islands of MPA pages loads the page by default (as before TASK-351, and like navigate() there), and that { shallow: true } opts in to the URL-only update, like the Next.js Pages Router's shallow option. Inside an SPA the option changes nothing: a query change already keeps every level mounted. decision-61 is amended.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Without options, searchParams.set() in an island of an MPA page loads the page with the new query (location.assign, or location.replace with { replace: true })
- [x] #2 With { shallow: true } it keeps TASK-351's behaviour: pushState/replaceState, reactive searchParams(), popstate
- [x] #3 SearchParamsOptions (NavigateOptions plus shallow) is exported from lumiose/router on both the browser and server entries
- [x] #4 Tests, the router reference, the islands concept page and decision-61 describe the new default
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone run: Lux implements this Spark-area task (solo takeover).

Validation: pnpm typecheck and pnpm lint pass; pnpm vitest run --project lumiose: 98 files, 1113 tests pass (search.test.ts covers the default page load with location.assign/replace spies, the shallow path and SPA delegation with shallow); docs:gen and docs:check pass. Not rechecked in a browser: the default path is location.assign/replace, and the shallow path is unchanged from TASK-351's Chromium check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
searchParams.set() in islands of MPA pages loads the page with the new query by default (location.assign, or location.replace with { replace: true }), as before TASK-351; { shallow: true } opts in to TASK-351's URL-only update. Inside an SPA the option changes nothing. New exported type SearchParamsOptions (NavigateOptions plus shallow) on both lumiose/router entries. decision-61 amended; router reference and islands concept page updated.
<!-- SECTION:FINAL_SUMMARY:END -->
