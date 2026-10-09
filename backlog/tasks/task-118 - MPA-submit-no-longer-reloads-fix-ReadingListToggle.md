---
id: TASK-118
title: MPA submit() no longer reloads; fix ReadingListToggle
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 04:20'
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
- [ ] #1 submit() auto-invalidates only on client-routed pages; on MPA pages it resolves with the result and never reloads; explicit invalidate() still reloads on MPA
- [ ] #2 Bookshelf ReadingListToggle updates itself (and removes the row on /reading-list) without a reload; Playwright suite green
- [ ] #3 Docs (data-and-actions.md, islands.md) state the rule with a common-mistakes note; tests
<!-- AC:END -->
