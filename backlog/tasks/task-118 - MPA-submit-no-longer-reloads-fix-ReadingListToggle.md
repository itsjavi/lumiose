---
id: TASK-118
title: MPA submit() no longer reloads; fix ReadingListToggle
status: Done
assignee:
  - Spark
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:23'
labels:
  - app
  - actions
dependencies: []
priority: medium
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 3 and the revised decision-20 amendment: on MPA pages a successful submit() must not call invalidate()/reload; SPA (client-routed) pages keep auto-invalidate. Lux authorises edits in packages/lumen/src/app/actions/**, examples/ssr-bookshelf and the docs for this task (Nova's areas; Nova is on the benchmark).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 submit() auto-invalidates only on client-routed pages; on MPA pages it resolves with the result and never reloads; explicit invalidate() still reloads on MPA
- [x] #2 Bookshelf ReadingListToggle updates itself (and removes the row on /reading-list) without a reload; Playwright suite green
- [x] #3 Docs (data-and-actions.md, islands.md) state the rule with a common-mistakes note; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: ClientNavigation gained clientRouted (MPA default false, SPA router true); submit() auto-invalidates only when clientRouted. ReadingListToggle updates itself from the result and, with removeClosest=".entry" on /reading-list, removes its own entry. Tests: client.test.ts (MPA never invalidates, explicit invalidate() still does); bookshelf Playwright 14/14 with a no-reload marker on /books and /reading-list. Docs: data-and-actions.md, islands.md, reference/app.md, reference/router.md.
<!-- SECTION:NOTES:END -->
