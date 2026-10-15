---
id: TASK-356
title: Popover and Tooltip
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 17:12'
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
- [ ] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.
<!-- SECTION:NOTES:END -->
