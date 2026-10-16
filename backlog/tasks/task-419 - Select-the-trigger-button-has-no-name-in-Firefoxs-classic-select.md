---
id: TASK-419
title: 'Select: the trigger button has no name in Firefox''s classic select'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 04:31'
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
- [x] #1 axe passes on /select in Firefox, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.

2026-10-16 (Halo): claimed (M12 batch 9, Firefox and WebKit; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): select.css (lu.core) now hides a select's button where customizable select is missing: @supports not (appearance: base-select) { select > button { display: none !important } } (important, so a theme's display does not bring it back). Firefox keeps the Trigger's button in the classic select's DOM, and axe (and assistive technology) met a nameless button; hidden, it is neither. No script needed. The axe test on /select runs in Firefox again and passes; select.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Select.Trigger's button is hidden by select.css where customizable select is missing, so Firefox's classic select no longer holds a nameless button; axe passes on /select in Firefox.
<!-- SECTION:FINAL_SUMMARY:END -->
