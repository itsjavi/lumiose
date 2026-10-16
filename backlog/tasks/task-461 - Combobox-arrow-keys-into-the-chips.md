---
id: TASK-461
title: 'Combobox: arrow keys into the chips'
status: To Do
assignee: []
created_date: '2026-10-16 13:42'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
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
