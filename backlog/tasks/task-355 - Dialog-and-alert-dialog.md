---
id: TASK-355
title: Dialog and alert dialog
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: high
ordinal: 356000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Dialog.Root (no element; open, onOpenChange, role "dialog" or "alertdialog"), Trigger (button command="show-modal"), Popup (dialog with closedby and labels), Title, Description, Close (command="close", value becomes returnValue). No JavaScript: native dialog and invoker commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dialog and alert dialog work without JavaScript, with the APG keyboard contract and focus return
- [ ] #2 open/onOpenChange and bind:open keep a signal in sync
- [ ] #3 Keyboard-contract and axe tests pass
<!-- AC:END -->
