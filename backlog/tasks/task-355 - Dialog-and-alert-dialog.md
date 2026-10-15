---
id: TASK-355
title: Dialog and alert dialog
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 16:55'
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
- [ ] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.
<!-- SECTION:NOTES:END -->
