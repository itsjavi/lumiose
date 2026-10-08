---
id: TASK-105
title: Auto-invalidate after a successful submit()
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 22:18'
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
- [ ] #1 After a success result, submit() calls invalidate() (SPA: re-run async components; MPA islands: re-run island async components and refresh server-rendered data per the existing invalidate() semantics); opt-out submit(form, { invalidate: false }); failures and redirects don't invalidate
- [ ] #2 Tests (bookshelf review flow refreshes without manual invalidate) and docs (data-and-actions, reference) in the same commits
<!-- AC:END -->
