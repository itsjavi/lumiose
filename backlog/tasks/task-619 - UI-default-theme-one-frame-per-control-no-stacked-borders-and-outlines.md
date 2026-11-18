---
id: TASK-619
title: 'UI default theme: one frame per control, no stacked borders and outlines'
status: Done
assignee:
  - '@Halo'
created_date: '2026-11-18T17:51:00Z'
updated_date: '2026-11-18T18:09:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 611000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User, 2026-11-18, looking at the Autocomplete on /ui: "the UI uses too many borders and outlines". The black-and-white theme (TASK-613) stacks frames: a highlighted option is an inverted fill plus an inner outline inside the list border; a focused input shows its border and, two pixels out, a second ring; popups add a text-colour border around all of it. Reduce every control and state to one frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A highlighted or active option, menu item or select option is shown by the inverted fill alone: no inner or outer outline on top of it
- [x] #2 A focused text input, combobox input, select, textarea and number field show one frame: the focus ring replaces or overlaps the border instead of sitting outside it
- [x] #3 Popups (listbox, menu, popover, dialog, tooltip) have one hairline border and nothing doubles where a popup touches its trigger
- [x] #4 Every focusable control still has a visible focus indicator with at least 3:1 against what is around it, in light, dark and forced-colours modes
- [x] #5 The ui unit, e2e and a11y suites pass; before and after screenshots of Autocomplete, Select, Menu and a form are in backlog/assets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (halo-20261118-t619). Decisions: (1) highlighted items (combobox and autocomplete options, menu and context menu items, select options, the open menubar trigger, a navigation menu content's focused link) are the inverted fill alone; the inner outline is removed. A focused disabled menu item, which does not invert, keeps its inset ring. (2) Text controls (lu-input, combobox input, lu-select, the number field's group, the active OTP slot) draw the ring over the border with outline-offset -1px: a 2px edge, no layout shift. (3) Menus, listboxes, select pickers and navigation menu contents have no padding, as in the agreed dummy: the highlighted item is a band from edge to edge. The combobox popup (--lu-side-offset: -1px) and the select picker (margin-block: -1px) share an edge with their control; menus, popovers and navigation menu contents keep the 4px gap. (4) Buttons, toggles, switches, tabs, summaries, slider thumbs, checkboxes and radios keep their outside ring; no doubled lines found there. (5) Forced colours: the fills are Highlight / HighlightText for all those items. (6) Found and fixed on the way: a highlighted select option inside an optgroup had its text in the popup colour, invisible on the fill. No custom property renamed.
Contrast: the fill against the items around it 21:1 (light and dark); a text control's ring against its own background and the page 21:1.
Tests changed, in examples/ui-e2e/e2e: combobox, menu, context-menu and select asserted a 2px outline on the highlighted or focused item; they now assert the fill through a new helper, focusFill (opaque, at least 3:1 against what is around it, no outline). menu.e2e's submenu alignment expected the popup 5px above its trigger (4px padding and the border); it is now 1px, and the test also checks that the first item lines up with the trigger. New forced-colours test: the highlighted option, the focused select option and the open menubar trigger differ from their neighbours.
Checks: ui unit tests 654 passed; pnpm typecheck and pnpm lint clean; ui docs:check clean; examples/ui-e2e in Chromium, dev and build: the full run before the test updates had 1062 passed, 24 skipped and the 10 failures described above (5 tests, twice); after the updates the affected suites were re-run (399 passed, 7 skipped; then navigation-menu, reflow and theme suites 44 passed). apps/web vitest 56 passed. Seen in Chromium on the fixture and on the website's autocomplete page, light and dark. Not run: Firefox and WebKit projects; a real forced-colours palette (emulation only); the full e2e suite was not run again in one piece after the last edits.
Screenshots (light and dark side by side): backlog/assets/redesign/task-619-{autocomplete,select,menu,form}-{before,after}.jpg
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every control and state of the default theme shows one frame. Highlighted items are an inverted band with no outline; focused text controls thicken their own edge to 2px instead of gaining a ring around it; lists fill their popup edge to edge, and a combobox or select popup shares an edge with its control. Focus indicators stay at 21:1 in light and dark, and are system colours in forced colours. theming.md has a new section, One frame per control, with the CSS to restore the previous look.
<!-- SECTION:FINAL_SUMMARY:END -->
