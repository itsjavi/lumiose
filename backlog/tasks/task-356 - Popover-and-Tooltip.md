---
id: TASK-356
title: Popover and Tooltip
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
priority: medium
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Popover and Tooltip parts on the Popover API (popover="auto" and "hint" where supported) and CSS anchor positioning, with placement props on Popup (side, align, sideOffset) and a fallback for browsers without anchor positioning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Popover and Tooltip follow their APG contracts
- [ ] #2 Placement works with and without CSS anchor positioning
- [ ] #3 Keyboard-contract and axe tests pass
<!-- AC:END -->
