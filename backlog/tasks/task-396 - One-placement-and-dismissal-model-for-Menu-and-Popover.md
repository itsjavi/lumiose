---
id: TASK-396
title: One placement and dismissal model for Menu and Popover
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-15 20:41'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-356
  - TASK-357
priority: medium
ordinal: 395000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found at the M12 second-batch merge (2026-10-15). Menu and Popover solve doc-9's right-click and second-finger outside press two ways: Menu's script switches its popup to popover=manual and dismisses itself, while Popover keeps popover=auto and reopens in a requestAnimationFrame. Menu also re-exports the shared placement types as MenuSide and MenuAlign next to the package's Side and Align. Pick one dismissal approach (or record why both stay), share it, and drop the duplicate type names before @lumiose/ui's first release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Menu and Popover use one recorded dismissal approach, or the split is recorded with its reason
- [x] #2 One pair of placement type names is exported
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Halo): claimed (M12 third batch, branch claude/halo-m12c-4d6b9f).

2026-10-15 (Halo): done on branch claude/halo-m12c-4d6b9f.

## Decision (technical, decision-16; Lux may promote it to a decision record)

One dismissal model for the anchored layers the client scripts open, Menu's: **the script makes the popup a manual popover and dismisses it itself**, through a shared module, `packages/ui/src/layer/layer.ts`, now used by Menu, Popover and Combobox. Popover's "keep `popover=auto` and reopen in a requestAnimationFrame" is gone. Why:
- The reopen hack fires `toggle` twice (closed, then open) on a right-click outside, so `onOpenChange` reports `false` then `true`, and the theme's exit and enter transitions restart.
- Combobox needs a manual popover anyway: focus stays in its input, which an auto popover's light dismiss would fight.
- One place holds doc-9 section 1's outside-press filters: main button and primary pointer only, press and release both outside, no scrollbar presses, no nodes the press removed, presses inside the popup's box count as inside (password-manager overlays). Before, Menu had its own copy and Popover none.

The model: `openLayer({ popup, contains, dismiss })` while a popup is open, released when it closes. It dismisses on an outside press (innermost first), on a close request (a `CloseWatcher` per layer, or an Escape listener that only acts when no handler took the key, so a parent dialog keeps its own close request), and when another layer opens outside it (the auto popover stack's rule: sibling submenus, two popovers). Layers nest through the DOM. Layers whose popup left the page while open are forgotten.

Server HTML keeps `popover="auto"` for Menu and Popover, so they open, light-dismiss and close on Escape with no JavaScript. Popover's script flips a closed popup to manual on its trigger's click (before `popovertarget` acts; a key press clicks too), and `Popover.Root`'s `open` prop does the same before `showPopover`; the layer is registered on `beforetoggle`, so a press right after opening already counts. A popup opened some other way while still `auto` keeps the browser's light dismiss.

Native `<select>` (TASK-358) keeps the platform's picker dismissal. Tooltip (`popover=hint`) and Dialog (`<dialog>`, closedby) are not layers of this model.

## Placement names

`MenuSide` and `MenuAlign` are gone: `Menu.Popup`'s `side` and `align` use the package's `Side` and `Align` (`@lumiose/ui` exports one pair, with `PlacementProps`). Not public yet (@lumiose/ui is unreleased), so no deprecation.

## Evidence

- `layer/layer.dom.test.ts` (6 tests): filters, removed nodes, one close request per layer, nesting, the auto-stack rule, pruning.
- ui-e2e: Menu (right-click/middle click outside keeps it open, outside click closes the tree, submenus, dialogs), Popover (right-click outside keeps it open, nested popovers, Escape one at a time, in a dialog), Combobox, Tooltip, on dev and build. The script-list tests now expect the shared `layer-*.js` chunk.
- Sizes (brotli): Popover script 1.26 → 1.72 kB, Menu 2.94 → 3.28 kB (each row counts the shared module); all client scripts together 7.99 → 7.98 kB.
- Docs: menu.md, popover.md (dismissal and sizes), combobox.md.
<!-- SECTION:NOTES:END -->
