---
id: TASK-410
title: 'Number Field, Autocomplete and Popover: gaps against Base UI'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 00:24'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-375
  - TASK-377
  - TASK-394
priority: low
ordinal: 409000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recorded by Halo in batch 6 (2026-10-16).
- Number Field (TASK-375): `smallStep`, `snapOnStep` and `ScrubAreaCursor` are missing.
- Autocomplete (TASK-377): `autoHighlight`, `keepHighlight`, `submitOnItemClick` and `limit` are missing.
- Popover (TASK-394): `modal="trap-focus"` and a Backdrop part are missing. The hover gap uses a 100 ms grace period, as Tooltip does, not Base UI's safe triangle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each gap is closed with docs and e2e, or recorded as dropped with its reason
<!-- AC:END -->
