---
id: TASK-357
title: Menu
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 18:02'
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
- [ ] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [ ] #6 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (Lux, orchestrator): reassigned to Spark so Menu runs in parallel with Halo's TASK-392, TASK-356 and TASK-359. Spark may edit packages/ui/src/menu/** and add Menu's lines to the shared package files (index.ts, package.json exports, styles.css, themes/default.css).
<!-- SECTION:NOTES:END -->
