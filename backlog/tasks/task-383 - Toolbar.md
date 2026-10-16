---
id: TASK-383
title: Toolbar
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 01:28'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-369
priority: low
ordinal: 384000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Toolbar with roving focus over buttons, toggles, separators and inputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [x] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [x] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [x] #4 A docs page with a type-checked example
- [x] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-16 (Halo): claimed (M12 seventh batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits 3d3cb200, ab0fccb3, 7cd49fb4).

Design (decision-16): `lu-toolbar` (role=toolbar, aria-orientation, data-orientation, data-loop-focus) roves one tab stop across its items: buttons, links, inputs, selects, textareas and `[data-toolbar-item]`, not those of a nested toolbar or of a popup inside it, natively disabled ones skipped. Arrow keys along the orientation (Left/Right swapped in RTL; Up/Down when vertical), Home/End, looping unless loopFocus false; focusin moves the tab stop. A control keeps the keys it needs: a text field its caret's Left/Right until the edge and its Home/End, number and range inputs their arrows, a select Up/Down (APG; Base UI advises one input, last). The server HTML has the single tab stop: Toolbar parts and Toggles inside it take `tabindex` from the toolbar context in render order (toolbar/context.ts); other triggers (Menu.Trigger) get theirs from the script. A ToggleGroup inside a toolbar still presses its toggles but leaves the arrow keys and roving to the toolbar (toggle-group.script.ts checks for lu-toolbar). Toolbar.Button is a Button with focusableWhenDisabled default true (aria-disabled, clicks cancelled by Button's script); Toolbar.Input disabled is aria-disabled + readonly; Group (role=group) disables its items together; Separator is Beacon's Separator (hr) across the toolbar. Core CSS: lu-toolbar is a block.

Base UI 1.9 comparison: Root orientation/loopFocus/disabled, Button and Input disabled + focusableWhenDisabled (default true), Link, Group disabled, Separator orientation perpendicular; data-orientation on parts. Not done: render/nativeButton composition (triggers go in directly), data-disabled/data-focusable (aria-disabled instead). Zag toolbar: not a Zag machine; APG toolbar keys followed.

doc-9 sections 1, 5 and 13: RTL arrows, isComposing ignored, roving tab stop, disabled handled, a Menu trigger as an item (Enter opens, Escape returns). Section 17: 2.1.1/2.1.2 (Tab leaves the toolbar, Shift+Tab returns to the last item), 2.4.3, 4.1.2 (role toolbar, aria-orientation, aria-pressed, aria-disabled), 2.4.7 (2px ring on every item, checked), 2.5.8 (links as tall as buttons in the theme), 1.4.10/1.4.12 (wraps; reflow test), axe light and dark.

Evidence: unit tests toolbar.test.tsx (server HTML, tab stop incl. toggles, disabled focusable, vertical), toolbar.script.dom.test.ts (roving, keys, loop, text field caret, vertical, RTL, toggle group inside), toolbar.types.test.tsx; ui-e2e e2e/toolbar.e2e.ts (no-JS server HTML, keyboard contract through every item, text field keys, Tab out and back, toggles, soft-disabled, menu, vertical RTL no loop, island with no LUM warnings, axe light/dark, focus ring per item, targets, reflow, per-page scripts); toggle suites still pass. Docs: toolbar.md, toggle-group.md (inside a Toolbar), README and theming rows, live demo toolbar-1. Screenshot: backlog/assets/task-383-toolbar.png.

Sizes (min/gzip/brotli kB): toolbar + button scripts 2.13/1.04/0.88; component JS 5.04/1.89/1.65; CSS 0.06/0.07/0.06. Toggle Group's script 0.86 kB brotli (was 0.83).

New public names (TASK-400): `Toolbar` (`Root`, `Button`, `Link`, `Input`, `Group`, `Separator`), `ToolbarRootProps`, `ToolbarButtonProps`, `ToolbarLinkProps`, `ToolbarInputProps`, `ToolbarGroupProps`, `ToolbarSeparatorProps`, element `lu-toolbar` (`data-orientation`, `data-loop-focus`, `data-disabled`), item marker `data-toolbar-item`, class `lu-toolbar`, entries `@lumiose/ui/toolbar`, `@lumiose/ui/toolbar.css`.

2026-10-16 (Halo): checks green: pnpm check (2348 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build rerun in full after fixes (676 passed, 22 skipped; the first run's 5 failures were this batch's: the per-page script checks of Popover, Tooltip and the hover/modal page missing the new shared hover chunk, and the Menu submenu hover test under the longer nav, fixed in the next commit), apps/web Playwright 171 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Toolbar ships as `<lu-toolbar role="toolbar">` with one tab stop across buttons, links, inputs, selects and a ToggleGroup's toggles (which defer their keys to it): arrows along the orientation, swapped in RTL, Home/End, loopFocus, text fields keeping their caret's keys, disabled items focusable via aria-disabled. The server HTML has the tab stop already. Unit, script, type and ui-e2e tests, docs page, rows and a live demo; all checks green. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
