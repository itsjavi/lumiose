---
id: TASK-105
title: Auto-invalidate after a successful submit()
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 22:18'
updated_date: '2026-10-08 22:38'
labels: []
milestone: m-3
dependencies:
  - TASK-23
priority: medium
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-20 amendment) that a successful enhanced submit() refreshes the current page's data automatically, as Remix and SvelteKit do.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a success result, submit() calls invalidate() (SPA: re-run async components; MPA islands: re-run island async components and refresh server-rendered data per the existing invalidate() semantics); opt-out submit(form, { invalidate: false }); failures and redirects don't invalidate
- [x] #2 Tests (bookshelf review flow refreshes without manual invalidate) and docs (data-and-actions, reference) in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. app/actions/client.ts: SubmitOptions.invalidate (default true). After a success result, once the submission is no longer in flight (submitting()/busy() released, else the SPA invalidate() would wait on submit itself), submit() awaits invalidate() before resolving. Failures, redirects and errors do not invalidate.
2. Semantics follow the existing invalidate(): SPA = router revision bump (async components re-run, stale UI kept); MPA = location.reload() (no island-only re-run exists today; noted for Lux).
3. Tests: client.test.ts (success invalidates and resolves after it; failure/redirect/error/opt-out do not; busy released first), router-level SPA check if cheap; bookshelf e2e: removing from /reading-list refreshes the list without the manual reload.
4. Docs: concepts/data-and-actions, reference (submit options), same commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (nova-20261008T221802Z): claimed.

Nova: done.
- app/actions/client.ts: SubmitOptions.invalidate (default true). After a success result, once the submission left submitting()/busy() (the SPA's invalidate() resolves only when nothing is in flight, so holding busy() would deadlock), submit() awaits invalidate() and then resolves. failure/redirect/error (reject) do not invalidate.
- Semantics are the existing invalidate(): SPA = router revision bump (async components re-run, stale UI kept); MPA = location.reload(). MPA consequence for Lux: an enhanced submit() on an MPA page now reloads after success, so actionData() of a success is reset (documented; opt out with { invalidate: false }). There is no island-only re-run without a reload today; if wanted, it needs a page-level revision for islands in dom/async.ts (Spark) — not done, not in this AC's 'existing semantics'.
- Bookshelf: the reading-list toggle keeps the default; on /reading-list removing an entry now refreshes the list without the e2e's manual page.reload() (the review form itself is a plain no-JS form, unchanged). Island comment updated.
Evidence: client.test.ts 'submit() refreshes the page after a success' (invalidate runs with submitting()=false, busy()=false, actionData set; submit resolves only after invalidate resolves; failure/redirect/error/opt-out don't call it) — both fail without the change. Bookshelf Playwright suite 14/14 (reading-list test asserts the entry disappears with no manual reload). Docs: concepts/data-and-actions (Refreshing, API table, common mistake), reference/app (SubmitOptions, submit, invalidate), reference/router (invalidate bullet); llms-full regenerated. pnpm typecheck, pnpm test (1072 passed), pnpm lint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A successful submit() now runs invalidate() and resolves once the page's data is fresh (SPA: async components re-run; MPA: reload); submit(form, { invalidate: false }) opts out; failures, redirects and errors don't invalidate. Unit tests, bookshelf e2e (reading list refreshes without a manual reload) and docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
