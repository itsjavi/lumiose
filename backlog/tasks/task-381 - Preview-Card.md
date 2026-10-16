---
id: TASK-381
title: Preview Card
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 01:28'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-356
priority: low
ordinal: 382000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Preview Card: link preview on hover and focus with delays, on Popover (TASK-356).
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

2026-10-16 (Halo): implemented (commits 5b4075aa, 87be42f5, ab0fccb3, 7cd49fb4).

Design (decision-16): Popover's open-on-hover timing moves to `popover/hover.ts` (`hoverIntent`), now shared by Popover's hover triggers and Preview Card: delay, hoverable popup with a 100 ms grace across the gap, close delay, a press cancelling a pending open, touch ignored. The trigger is the link itself (`<a href data-preview-card>`, anchor name in its style); the card is a `<div popover="manual" data-side data-align>` placed by Popover's placement CSS. preview-card.script.ts (1.95 kB brotli with the shared modules) opens it on hover (delay 600, closeDelay 300 as Base UI) and on keyboard focus (`:focus-visible`, same delay, focus stays on the link), keeps it while the pointer or focus is on the link or the card, closes on focus leaving both (unless hovered), dismisses through the layer model (Escape, outside press), sets `data-popup-open` on the link, places it where anchor positioning is missing, and follows the `open` prop. The open card follows its link in the focus order (the link is its invoker), so Tab reaches the card's links; Base UI says its card content is not keyboard reachable, ours is. Touch and clicks follow the link; without JavaScript the link is a plain link. A card is a `<div>`, so it goes after the paragraph holding the link (documented).

Base UI 1.9 comparison: Root open/onOpenChange (bind:open), Trigger delay 600 / closeDelay 300, Popup with side/align/offsets (Base UI's Positioner props). Not done: Portal, Positioner, Backdrop, Arrow, Viewport, detached triggers (handle, payload), actionsRef, defaultOpen. Zag hover-card: same open/close delays and focus opening.

doc-9 sections 3 and 4: dismissal (main-button outside press, close requests one layer at a time), hover by mouse/pen only, focus-visible opening, 1.4.13 hoverable/persistent/dismissible (all tested), placement and its fallback. Section 17: 2.1.1 (focus opens it, Escape closes), 1.4.13, 2.4.3, axe light and dark closed and open.

Evidence: unit tests preview-card.test.tsx, preview-card.types.test.tsx; ui-e2e e2e/preview-card.e2e.ts (no-JS plain link, hover delay, no focus move, hoverable, leaving closes, Escape, keyboard focus opens and Tab goes through the card and out, clicks and taps follow the link, island bind:open with no LUM warnings, axe light/dark, per-page scripts); popover suites still pass with the shared module. Docs: preview-card.md, README and theming rows, popover.md size, live demo preview-card-1. Screenshot: backlog/assets/task-381-preview-card-dark.png.

Sizes (min/gzip/brotli kB): script 5.23/2.19/1.95; component JS 7.08/2.94/2.65; CSS (placement) 2.10/0.45/0.38. Popover's script is now 2.27 kB brotli (was 2.13) with hover.ts as its own module.

New public names (TASK-400): `PreviewCard` (`Root`, `Trigger`, `Popup`), `PreviewCardRootProps`, `PreviewCardTriggerProps`, `PreviewCardPopupProps`, trigger attributes `data-preview-card`, `data-delay`, `data-close-delay`, `data-popup-open`, popup marker `data-preview-card-popup`, class `lu-preview-card`, entries `@lumiose/ui/preview-card`, `@lumiose/ui/preview-card.css`.

2026-10-16 (Halo): checks green: pnpm check (2348 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build rerun in full after fixes (676 passed, 22 skipped; the first run's 5 failures were this batch's: the per-page script checks of Popover, Tooltip and the hover/modal page missing the new shared hover chunk, and the Menu submenu hover test under the longer nav, fixed in the next commit), apps/web Playwright 171 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preview Card ships on Popover's hover timing (moved to popover/hover.ts and shared) and placement: the link is the trigger and works without JavaScript; the card opens after its delay on mouse or pen hover or keyboard focus without moving focus, is hoverable, persistent and dismissible (Escape, outside press), and Tab reaches its links. Unit, type and ui-e2e tests (incl. 1.4.13, touch and axe light/dark), docs page, rows and a live demo; all checks green. Gaps: Arrow, Backdrop, detached triggers. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
