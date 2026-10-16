---
id: TASK-461
title: 'Combobox: arrow keys into the chips'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 13:42'
updated_date: '2026-10-16 15:39'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
priority: low
ordinal: 459000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-454 L32 (Prism). With `multiple`, the chips are not reachable from the keyboard: Base UI moves into them with Arrow Left at the input's start and removes one with Backspace or Delete. Ours only removes the last value with Backspace in an empty input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Arrow Left at the start of the input moves into the chips, arrows move between them, Backspace or Delete removes the focused one, as Base UI's, with tests in every engine
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.
<!-- SECTION:NOTES:END -->
