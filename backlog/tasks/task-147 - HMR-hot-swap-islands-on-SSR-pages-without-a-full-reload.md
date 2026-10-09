---
id: TASK-147
title: 'HMR: hot-swap islands on SSR pages without a full reload'
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 05:24'
labels:
  - dev
  - hmr
dependencies:
  - TASK-146
priority: low
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned only (user 2026-10-09: 'plan only') — do not start without the user's go-ahead. When an edit only changes island code (the server graph change is the island module itself), re-render the affected island instances in the browser from their serialized props instead of reloading the page; server-rendered content, other islands and scroll position stay.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Editing an island's code updates its instances in place on server and static pages; other islands keep state; server-only edits still reload
- [ ] #2 Playwright test in islands-e2e for both cases
<!-- AC:END -->
