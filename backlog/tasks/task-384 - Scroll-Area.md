---
id: TASK-384
title: Scroll Area
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
priority: low
ordinal: 385000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Scroll Area: custom scrollbars over native scrolling, with CSS variables for thumb size and position.
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

2026-10-16 (Halo): implemented (commits 902e923d, ab0fccb3, 7cd49fb4).

What CSS can do without JS (decision recorded): `scrollbar-color`, `scrollbar-width` and `scrollbar-gutter` recolour and thin the native scrollbar in every current browser, but cannot shape it, lay it over the content, show it only on hover or report the scroll position for fades. So scrolling stays native and the custom scrollbars are drawn by the script; without JavaScript the native scrollbars show (a page may style them with those properties).

Design: Viewport `<div tabindex="0" data-viewport>` fills the Root and scrolls natively (wheel, touch, keyboard, find-in-page), focusable while it overflows (the script sets tabindex -1 when nothing overflows), no focus trap; Content at least as wide as what it holds (`min-inline-size: fit-content`, as Base UI). lu-scroll-area (script 1.44 kB brotli) hides the native scrollbar once defined, sizes (min 16px) and moves each `[data-thumb]` (transform) from the scroll position on scroll and resize (ResizeObserver on the viewport and its content), hides a `[data-scrollbar]` whose axis fits (unless keepMounted), shows the `[data-corner]` when both overflow and writes its size, sets data-has-overflow-x/y, data-overflow-{x,y}-{start,end} (overflowEdgeThreshold) on Root and Viewport and --lu-scroll-area-overflow-* distances on the Viewport, data-scrolling (500 ms after the last scroll) and data-hovering; a thumb drag scrolls proportionally (pointer capture), a track press centres the thumb there; RTL horizontal thumbs run from the right (negative scrollLeft). Scrollbars are aria-hidden pointer conveniences: the viewport is the keyboard and AT path. Core CSS (0.33 kB).

Base UI 1.9 comparison: Root overflowEdgeThreshold, Viewport, Content, Scrollbar (orientation, keepMounted), Thumb, Corner; same data attributes; CSS variables renamed to the package's `--lu-scroll-area-*` (Base UI's `--scroll-area-*`). Added: the viewport's tabindex while it overflows. Not done: render. Zag scroll-area: not a Zag machine.

doc-9 section 1 (no scroll lock or focus trap involved; RTL; ResizeObserver for content that grows) and section 17: 2.1.1 (keyboard scrolling of the focused viewport; Tab moves on), 2.1.2 (no trap), 2.4.7 (inward 2px ring on the viewport, checked), 1.4.11 (thumb in --lu-muted-foreground, 3:1), 1.4.10/1.4.12 (reflow test), axe light and dark (scrollable-region-focusable satisfied by the viewport's tabindex).

Evidence: unit tests scroll-area.test.tsx (server HTML), scroll-area.types.test.tsx; ui-e2e e2e/scroll-area.e2e.ts (no-JS native scrollbar and keyboard scrolling, keys with the thumb following and Tab moving on, hover and wheel states, thumb drag and track press, both axes with the corner, RTL, nothing to scroll is no tab stop, island content growth with no LUM warnings, axe light/dark, reflow, per-page script). Docs: scroll-area.md, README and theming rows, live demo scroll-area-1. Screenshot: backlog/assets/task-384-scroll-area.png.

Sizes (min/gzip/brotli kB): script 4.41/1.65/1.44; component JS 5.49/2.03/1.79; CSS 1.41/0.43/0.33.

New public names (TASK-400): `ScrollArea` (`Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`, `Corner`), `ScrollAreaRootProps`, `ScrollAreaViewportProps`, `ScrollAreaContentProps`, `ScrollAreaScrollbarProps`, `ScrollAreaThumbProps`, `ScrollAreaCornerProps`, element `lu-scroll-area` (attribute `overflow-edge-threshold`; data-has-overflow-x/y, data-overflow-{x,y}-{start,end}, data-scrolling), part hooks `data-viewport`, `data-scrollbar`, `data-thumb`, `data-corner`, `data-keep-mounted`, `data-hovering`, custom properties `--lu-scroll-area-thumb-width`/`-height`, `--lu-scroll-area-overflow-{x,y}-{start,end}`, `--lu-scroll-area-corner-width`/`-height`, class `lu-scroll-area`, entries `@lumiose/ui/scroll-area`, `@lumiose/ui/scroll-area.css`.

2026-10-16 (Halo): checks green: pnpm check (2348 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build rerun in full after fixes (676 passed, 22 skipped; the first run's 5 failures were this batch's: the per-page script checks of Popover, Tooltip and the hover/modal page missing the new shared hover chunk, and the Menu submenu hover test under the longer nav, fixed in the next commit), apps/web Playwright 171 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scroll Area ships native scrolling in a focusable viewport (no trap) with custom aria-hidden scrollbars from `<lu-scroll-area>` (1.4 kB brotli): sized and moved thumbs, drag and track press, corner, hover/scrolling states, overflow data attributes and --lu-scroll-area-* variables, RTL; without JavaScript the native scrollbars show (what CSS alone can do is recorded). Unit, type and ui-e2e tests, docs page, rows and a live demo; all checks green. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
