---
id: TASK-539
title: 'ui: ToggleGroup forces a layout on every new value array'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
labels:
  - ui
  - performance
dependencies: []
priority: medium
ordinal: 532000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). `set value` calls `#rove()`, which calls `checkVisibility()` per toggle. A parent that passes `value={[x()]}` and re-reads it on unrelated updates gets a synchronous layout in the middle of each render (the port measured a filter switch at about 381 ms instead of 205 ms at 4x CPU until it passed a stable array).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Setting a value equal to the current one does nothing (no rove, no layout)
- [ ] #2 A test or a forced-layout count shows it
<!-- AC:END -->
