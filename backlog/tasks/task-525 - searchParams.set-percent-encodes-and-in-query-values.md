---
id: TASK-525
title: 'searchParams.set() percent-encodes : and , in query values'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-23 08:17'
updated_date: '2026-10-23 09:05'
labels:
  - router
  - dx
milestone: m-13
dependencies: []
priority: low
ordinal: 519000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). The list page keeps a multi-column sort in its query, sorts=price:desc,name:asc, as the original's URL-state library writes it. searchParams.set() writes sorts=price%3Adesc%2Cname%3Aasc (URLSearchParams.toString()). Both decode to the same value and old links keep working, but the shareable URL is harder to read and differs from the original's. Option: serialize with the minimal encoding a query needs, keeping characters such as : , / @ that are valid in a query value, as that library does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 searchParams.set() leaves : and , readable in query values, with a test
- [x] #2 Values with &, =, + and # still round-trip, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (0.5.1 batch, worktree branch): claimed and started.

2026-10-23 (Spark): searchString() in packages/lumiose/src/app/router/search.ts (used by both the SPA router's set() and the MPA/shallow path) still serializes with URLSearchParams, then unescapes %21 %24 %28 %29 %2C %2F %3A %3B %3F %40 %7E: ! $ ( ) , / : ; ? @ ~, the characters RFC 3986 allows in a query that the form parser reads as themselves and the WHATWG URL parser leaves as they are. Everything the parser would read otherwise stays escaped: % & = + # (and ' , which the URL parser escapes in http(s) queries anyway, so the written query equals the final href's), spaces as +, non-ASCII, quotes, <>, brackets, braces, controls. Since every input % is written %25, a match is always an escape URLSearchParams wrote. Server agreement: the server's searchParams() and ctx.url.searchParams parse with WHATWG URLSearchParams, as the client's searchParams() and the shallow path do; search.test.ts asserts both client and server read every value back (&, =, +, #, %, space, newline, non-ASCII, keys with = and &). Checked in Chromium: setting url.search to such a query keeps it byte for byte and parses back the same values. Rule documented in reference/router.md (searchParams) and the set() JSDoc. Not a syntax or API change: the values set() writes and reads are unchanged; old links (escaped) keep working.

Validation (Spark): pnpm check green (as TASK-508); spa-router-e2e 38 passed; islands-e2e 8 passed. Commit 2684835e on the worktree branch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
searchParams.set() writes readable queries: sorts=price:desc,name:asc instead of sorts=price%3Adesc%2Cname%3Aasc. It still serializes with URLSearchParams, then unescapes ! $ ( ) , / : ; ? @ ~, which a query may hold and its parser reads as themselves. % & = + # and characters a URL cannot hold stay escaped, so the browser's and the server's searchParams() read every value back unchanged (tests on the MPA, shallow and SPA paths and on the server). The rule is in reference/router.md.
<!-- SECTION:FINAL_SUMMARY:END -->
