---
id: TASK-378
title: Context Menu
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-15 23:23'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-357
priority: medium
ordinal: 379000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Context Menu on the Menu implementation (TASK-357): right click and long press on touch, positioned at the pointer.
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

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 5. New sessions cannot start from an automated turn, so the idle Beacon session takes it. Beacon may edit packages/ui/src/<component>/**, the component's docs page and e2e, and its lines in the shared package files.

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55): implemented.

Design (orchestrator-delegated):
- Menu, reused whole.
  - ContextMenu.Root renders `<lu-context-menu>` (display: contents) around the trigger area and the menu.
  - ContextMenu.Popup renders Menu's `<lu-menu>` and `Menu.Popup`, anchored by CSS anchor positioning (placement.css, with Menu's flips) to a fixed, zero-size `<span aria-hidden>` at `--lu-context-x/-y`. Where anchor positioning is missing, place.ts places it from a virtual rect.
  - The items are Menu's parts: Item, LinkItem, CheckboxItem, RadioGroup, RadioItem, Group, GroupLabel, Separator, SubmenuRoot, SubmenuTrigger.
  - Inside a SubmenuRoot, ContextMenu.Popup is a plain Menu.Popup.
  - Menu's script does keys, typeahead, items, submenus and dismissal (layer.ts).
- context-menu.script.ts (0.6 kB of its own, 3.87 kB brotli with Menu's script):
  - A right-click (`contextmenu`) in the area opens the menu at the pointer; another moves it.
  - A long press on a touch screen opens it too: 500ms, one finger, cancelled by a move over 10px, a second finger or a release. Android's `contextmenu` after it is ignored.
  - Shift+F10 and the ContextMenu key, with focus in the area, open it at the focused element, on the first item.
  - A right-click inside the open menu is prevented and does nothing.
  - `data-disabled` keeps the browser's menu.
- Focus: a pointer opening focuses the popup, a keyboard one the first item (Menu's rules). With no trigger, closing returns focus to where it was before opening (the area for the keys), unless focus already moved to a control (an outside press). The script does this on the menu's `openchange`, because the browser's popover focus restoration did not return focus here.
- The root popup's `sideOffset` defaults to 0 (the pointer is the corner), over the theme's 4px menu gap.
- Shared Menu files, additive:
  - menu.tsx exports `MenuContext` and `MenuContextValue` for ContextMenu;
  - menu.script.ts gains a public `show(keyboard)` on `<lu-menu>`;
  - `showPopover({ source: trigger ?? undefined })`: a null `source` threw.
- No JavaScript: a right-click shows the browser's menu, and the popup stays hidden.

doc-9:
- §5's context-menu item: iOS fires no `contextmenu`, so a long-press timer cancels on a move or a second finger, and the area has `-webkit-touch-callout: none`.
- The rest of §5 (keys, typeahead, disabled items, link items, submenus, checkbox and radio items) comes with Menu, and Menu's e2e covers it. The context-menu e2e also exercises keys, item activation, a submenu, checkbox and radio binding, dismissal and focus return.

Against Base UI and Zag:
- Base UI's anatomy, without Portal, Positioner, Backdrop and Arrow (decision-62).
- Root: open, onOpenChange, bind:open, disabled. The trigger is a `<div>`, not focusable by default: the docs say to give it `tabindex={0}` and a name.
- Zag's long-press timer and touch callout, and its keyboard opening with Shift+F10 and the ContextMenu key.

WCAG 2.2 AA:
- Automated (ui-e2e, dev and build): axe A/AA closed and open, light and dark; focus visible; item targets ≥ 24px.
- 2.5.1: the long press and the keys are alternatives to the right-click. The docs advise offering important commands elsewhere too, because a context menu is hard to discover.

Public names (proposals, TASK-400):
- Export `ContextMenu` with Base UI's parts: Root, Trigger, Popup and Menu's item parts, LinkItem included.
- Entries `@lumiose/ui/context-menu` and `/context-menu.css`.
- Element `lu-context-menu`, with `data-disabled`.
- Variables `--lu-context-x` and `--lu-context-y`.
- Types `ContextMenu{Root,Trigger,Popup}Props`.
- `<lu-menu>`'s new `show(keyboard)` method.
- Theme: the existing `lu-menu` class on its popups.

Validation 2026-10-16: pnpm check green (Vitest 2229 passed, 2 skipped; typecheck, lint, fmt:examples, size, cargo test); pack:check --smoke --skip-npm green (@lumiose/ui packs 86 files, the smoke app builds and passes its browser test); ui-e2e, every component, dev and build: 416 passed, 10 skipped by design; apps/web Playwright: 124 passed plus the UI suite after its fix (run on ports 5294/5296, because another worktree's dev server held 5196). No Rust changes. Screenshots: backlog/assets/task-378-context-menu-{light,dark}.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Context Menu ships in @lumiose/ui, built on Menu: Menu's popup, items, keys, typeahead, submenus and dismissal. A small script opens it at the pointer on a right-click, on a long press on touch screens (iOS fires no contextmenu), and on Shift+F10 or the ContextMenu key with focus in the area, the keyboard alternative (WCAG 2.5.1). It returns focus to where it was before. Docs, the lu-menu theme, a /ui demo and tests are in.
<!-- SECTION:FINAL_SUMMARY:END -->
