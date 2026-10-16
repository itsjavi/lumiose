---
id: TASK-467
title: 'Flaky under load: the popover safe-triangle timing test in Firefox'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 23:21'
labels:
  - ui
  - test
milestone: m-12
dependencies: []
priority: low
ordinal: 465000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen by Beacon in two full Firefox runs (2026-10-16 and 2026-10-17). The popover hover safe-triangle test (TASK-410, popover-hover-modal.e2e.ts) failed once in each run and passed 3 of 3 on rerun. Halo's TASK-464 found that one Firefox test can leak browser state into later tests: a real Ctrl+wheel zoomed the page. Look for a similar cause, or for a timing assumption.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test passes repeatedly inside a full Firefox run
<!-- AC:END -->
