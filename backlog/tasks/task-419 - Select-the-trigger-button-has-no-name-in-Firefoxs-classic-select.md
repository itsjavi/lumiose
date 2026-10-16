---
id: TASK-419
title: 'Select: the trigger button has no name in Firefox''s classic select'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 03:39'
labels:
  - ui
  - browsers
milestone: m-12
dependencies: []
ordinal: 417000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), in Linux Firefox (Playwright 1.63). axe on /select reports button-name for #fruit > button (Select.Trigger's <button> inside the <select>): Firefox keeps the button in the DOM of a classic select (no appearance: base-select) and axe checks it. Hide or name the button where customizable select is missing, or confirm it is not exposed. The select.e2e.ts axe test skips Firefox with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 axe passes on /select in Firefox, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.
<!-- SECTION:NOTES:END -->
