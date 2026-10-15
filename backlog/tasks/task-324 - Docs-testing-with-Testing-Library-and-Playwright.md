---
id: TASK-324
title: 'Docs: testing with Testing Library and Playwright'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 05:43'
labels:
  - docs
  - testing
milestone: m-11
dependencies: []
priority: medium
ordinal: 326000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: concepts/testing.md shows @testing-library/dom and @testing-library/user-event with lumiose/dom's render() (queries, events, cleanup) and Playwright for end-to-end tests. No adapter package and no component workshop before 1.0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The docs show a component test with Testing Library queries and user-event, type-checked
- [x] #2 They show a Playwright end-to-end setup
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 3): started. Pinned devDependencies of @lumiose/cli for the type-checked docs examples (also used by TASK-330/331): @testing-library/dom 10.4.2, @testing-library/user-event 14.6.7, @playwright/test 1.63.0 (already in the workspace), stripe 23.0.0, @sanity/client 8.9.0, @sanity/webhook 4.0.4; each at least 3 days old, as the Renovate policy.

Done. concepts/testing.md: the three kinds of tests (component with Vitest + happy-dom + @testing-library/dom + user-event on render() from lumiose/dom; server rendering with renderToString; end to end with Playwright against lumiose build + preview), how delegated handlers and flushing interact with user-event, a type-checked TodoForm component and its Testing Library test (queries, user-event, vi.fn, cleanup with the disposer), the existing flush() counter test, and a type-checked playwright.config.ts (webServer: lumiose build && lumiose preview) with an e2e spec. Removed the 'planned @lumiose/testing' status note and the docs index status row (decision-57: no adapter package before 1.0). Verified for real, beyond type-checking: the TodoForm test passes under Vitest + happy-dom in a scratch project (no flush needed after user-event), and the Playwright config and spec pass against the create-lumiose ssr template's build (chromium). The docs examples test links the new pinned devDependencies of @lumiose/cli. Validation: docs:gen, docs:check, docs tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Testing docs: component tests with Testing Library and user-event on render(), server rendering tests, and a Playwright end-to-end setup, all type-checked and verified by running them.
<!-- SECTION:FINAL_SUMMARY:END -->
