---
id: TASK-459
title: >-
  Field: a sync validate with validationDebounceTime and a submit inside the
  window
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 13:20'
updated_date: '2026-10-16 15:39'
labels:
  - ui
  - forms
milestone: m-12
dependencies: []
priority: low
ordinal: 457000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-446 L16 (Prism, SUSPECTED). Field.Root's run() clears the control's custom validity and waits validationDebounceTime before calling validate, also when validate is synchronous; a submit inside that window then passes the browser's validation without the check. Confirm with a repro, then flush a pending synchronous check on a submit attempt (or run synchronous checks at once and debounce only the display).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A repro confirms or rules it out
- [ ] #2 If confirmed, a submit within the debounce window is blocked by a failing synchronous validate, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.
<!-- SECTION:NOTES:END -->
