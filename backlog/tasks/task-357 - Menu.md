---
id: TASK-357
title: Menu
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
priority: high
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Menu.Root (lu-menu), Trigger (popovertarget, aria-haspopup), Popup (role="menu" popover), Item, CheckboxItem, Separator, then groups and group labels, radio items, submenus and placement. Running an item closes the menu and returns focus (APG).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The menu opens without JavaScript and follows the APG Menu Button contract (arrows, Home/End, typeahead, Escape, close on run)
- [ ] #2 open/onOpenChange, onCheckedChange and bind: work with signals
- [ ] #3 Keyboard-contract and axe tests pass
<!-- AC:END -->
