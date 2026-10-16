---
id: TASK-414
title: A compact nav for the ui-e2e fixture
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 01:30'
labels:
  - test
  - ui
milestone: m-12
dependencies: []
priority: low
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From batch 7 (2026-10-16). The ui-e2e layout's nav grows with every component and pushes the fixtures below a 720px viewport. Three tests (Menu, Select, Popover) now set a 1000px viewport to keep anchored popups from flipping. A compact nav would let the tests keep Playwright's default viewport: a disclosure, a select, or the links only on the home page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The ui-e2e fixtures sit within a 720px viewport, and the tests drop their 1000px overrides
<!-- AC:END -->
