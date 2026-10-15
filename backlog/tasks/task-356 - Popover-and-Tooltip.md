---
id: TASK-356
title: Popover and Tooltip
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 18:35'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
references:
  - backlog/assets/task-356-popover-light.png
  - backlog/assets/task-356-popover-dark.png
  - backlog/assets/task-356-tooltip-light.png
  - backlog/assets/task-356-tooltip-dark.png
priority: medium
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Popover and Tooltip parts on the Popover API (popover="auto" and "hint" where supported) and CSS anchor positioning, with placement props on Popup (side, align, sideOffset) and a fallback for browsers without anchor positioning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Popover and Tooltip follow their APG contracts
- [x] #2 Placement works with and without CSS anchor positioning
- [x] #3 Keyboard-contract and axe tests pass
- [x] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [x] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [x] #6 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 Halo: claimed (branch claude/halo-m12b-eadea2).

## Implementation (2026-10-15, Halo)

- **Popover** (`packages/ui/src/popover/`): `Root` (`open`, `onOpenChange`, `bind:open`), `Trigger` (`<button popovertarget aria-haspopup=dialog>`), `Popup` (`<div popover=auto role=dialog>`), `Title`, `Description`, `Close` (`popovertargetaction=hide`). Works without JavaScript. The `open` prop shows it with `showPopover({ source: trigger })`, so a signal-opened popover keeps the invoker relationship (focus order, nesting).
- **Tooltip** (`packages/ui/src/tooltip/`): `Root` (`open`, `onOpenChange`, `bind:open`, `disabled`, `disableHoverablePopup`), `Trigger` (`delay` 600, `closeDelay` 0, `closeOnClick` true, Base UI's defaults), `Popup` (`<span popover=hint role=tooltip>`; a span so it may sit in a paragraph; Safari reads `hint` as `manual`). Accessibility model: APG, the trigger is `aria-describedby` the tip always, in server HTML too (doc-9 §4 asks to pick one; Base UI's visual-only model would leave screen readers nothing without hover).
- **Placement** (`packages/ui/src/placement/`, shared, Menu can reuse it): `side`, `align`, `sideOffset`, `alignOffset` on `Popup` (decision-62). The trigger gets an inline `anchor-name: --lu-<id>`, the popup `position-anchor` plus `data-side`/`data-align`; `placement.css` (lu.core, inside `@supports (anchor-name: --a)`) maps them to `anchor()` insets, `anchor-center`, `position-try-fallbacks` (flip, then `@position-try --lu-below/--lu-above` for side popups that fit on neither side) and `position-visibility: anchors-visible`. Without anchor positioning, `place.ts` (in the client scripts) computes the same placement in the frame the popup first paints, and on scroll/resize.
- **Client scripts** (decision-63): `popover.script.ts` (focus on open: first focusable, or the popup itself when there is none or on touch; focus return with preventScroll unless an outside press landed on a control; `aria-expanded` on triggers; re-shows a popover closed by a right-click or a second finger before it paints, since a popover's light dismiss cannot be cancelled; fallback placement). `tooltip.script.ts` (hover with delay, never touch, focus-visible at once, one at a time, 400 ms group window, press cancels, closes on Escape (keydown cancelled so a dialog around stays open), press, trigger click (re-shows after the hint's own light dismiss when `closeOnClick={false}`), blur and ancestor scroll; hoverable with a 100 ms grace across the gap).
- Sizes (brotli): popover script 1.25 kB, tooltip script 1.54 kB (both include `place.ts`; a page with both loads a shared `place-*.js` chunk); component JS for islands 2.16 / 2.31 kB; CSS 0.37 kB (shared placement).
- Theme: `.lu-popover` (surface, h2/p/footer, 4px gap), `.lu-tooltip` (foreground on background, 6px gap), fades with `@starting-style` and `overlay`.
- Docs: `ui/popover.md`, `ui/tooltip.md`, README component table and theme classes, docs index.

**New public names (for the user's review):** `Popover.*` and `Tooltip.*` parts and props as above (Base UI's names); the `Side`, `Align`, `PlacementProps` types; `data-side`, `data-align` (Base UI's; they hold the requested placement, not a flipped one); CSS custom properties `--lu-side-offset`, `--lu-align-offset`; the trigger attributes the tooltip script reads: `data-delay`, `data-close-delay`, `data-close-on-click`, `data-trigger-disabled` (Base UI's styling name), and `data-disable-hoverable-popup` on the tip; theme classes `lu-popover`, `lu-tooltip`; exports `@lumiose/ui/popover`, `/popover.css`, `/tooltip`, `/tooltip.css`.

## doc-9 results

**§1 Cross-cutting.** Escape and outside presses act on the topmost layer only (native popover stack; e2e: nested popovers, popover in a dialog, tooltip in a dialog and in a popover) ✓. A press inside a child layer keeps the parent (DOM nesting and `source`) ✓; a drag that starts inside is native light dismiss (pointerdown and pointerup on the same target) ✓. Outside-press filters: right-click and second finger ✓ (script, e2e), removed targets, scrollbars and password managers are native. Dismissal on click, not mousedown: native ✓. WebKit not focusing a pressed button: focus return handles a `<body>` focus ✓. Modality: popovers and tooltips render where their Root is, so inside a dialog they are inside its Popup (docs say so); tests use real input ✓. Android back is a close request for popovers ✓ (native). Scroll lock: N/A (non-modal; Base UI's non-modal popover does not lock). Focus return with preventScroll, skipped when the outside press landed on a control (e2e), falling back to another trigger when the opener is gone ✓. Keyboard-scroll pointermove and IME: N/A (no list navigation). Animations: theme fades with `@starting-style`; exit keeps the top layer in Chromium only (documented); no enter animation for content rendered open: N/A (popovers cannot render open). Ids: deterministic `useId`, Title/Description referenced only when rendered ✓; an open popover cannot be server-rendered (documented); no inline scripts, so no CSP nonce. RTL: `inline-start`/`inline-end` sides and start/end alignment follow the direction ✓ (e2e). Toast as a persistent element: N/A until TASK-371 (native `popover=auto` light dismiss would close a popover on a toast click: revisit there).

**§3 Popover.** Non-modal Tab order (Tab out goes to the element after the trigger, Shift+Tab returns to it, a last trigger does not loop back) ✓ e2e, also for signal-opened popovers through `source`. Click opens on the first focusable element ✓. Hover opening and the modal variant: **not implemented** (Base UI's `openOnHover`/`delay`/`closeDelay` and `modal`): proposed follow-up. Anchoring: explicit anchor names make the trigger the anchor in every browser, signal-opened included ✓; transformed anchors in Safari/Firefox documented; hidden when the anchor is clipped (`position-visibility`, CSS only) ✓; RTL ✓.

**§4 Tooltip.** Hover or keyboard focus only, never touch ✓; a press before the delay cancels ✓; closes on Escape, trigger click (configurable), blur, pointerdown and ancestor scroll ✓; hoverable with opt-out ✓; one at a time with a group window ✓; nested triggers: triggers are `<button>`s, which cannot nest, and the script picks the innermost described element anyway ✓; accessibility model APG, asserted with `toHaveAccessibleDescription` ✓; native `hint` falls back to `manual` (Safari) and the script does the work; `interestfor` is not used ✓.

**§17 WCAG 2.2 AA.** axe with the WCAG A/AA tags, closed and open, light and dark, dev and build: popover (closed, open, text-only, nested) and tooltip (closed, two open) ✓, no needs-review results. 2.1.1/2.1.2 ✓ (keyboard paths e2e; Tab leaves both). 2.4.3 ✓. 2.4.11: popups sit beside their trigger and never cover it ✓. 1.4.13 (tooltip): dismissible with Escape without moving the pointer, hoverable, persistent until blur/leave/Escape ✓ e2e. 2.5.3 ✓. 4.1.2: popover `dialog` named by its Title, trigger `aria-haspopup=dialog` + `aria-expanded` (native for `popovertarget`, then the script) ✓; tooltip `role=tooltip` describing its trigger ✓. 3.2.1/3.2.2 ✓. Theme: contrast popover text 19.90 / 16.97, muted 5.61 / 6.91, tooltip 19.90 / 19.06 (light / dark); 2.4.7 ring 2px ✓ e2e; 2.5.8 ✓ e2e; 1.4.10 and 1.4.12 at 320px with text spacing, popups inside the viewport, nothing clipped ✓ e2e. 2.5.1/2.5.7/4.1.3/3.3.x: N/A.

**Proposed follow-ups (not created: task ids would clash between branches; for Lux):**
1. Popover `openOnHover` (`delay` 300, `closeDelay`, safe polygon, a click keeps it open) and `modal` (focus trap, scroll lock, inert page: a `<dialog>` with anchoring), Base UI parity.
2. `Popover.Arrow` and `Tooltip.Arrow`, and `data-side` that follows a flip (anchored container queries, or the script).
3. `Tooltip.Provider` (per-group `delay`, `closeDelay`, `timeout`) and `trackCursorAxis`.

Screenshots: backlog/assets/task-356-popover-light.png, -popover-dark.png (nested popovers), -tooltip-light.png, -tooltip-dark.png (opened by keyboard focus).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Popover (native popover=auto + popovertarget, role=dialog) and Tooltip (popover=hint, role=tooltip, describes its trigger in server HTML) with Base UI's parts and props, placed by CSS anchor positioning from shared placement props (side, align, sideOffset, alignOffset; flips, hide when clipped) and by a script fallback without it. Client scripts close the native gaps (focus on open/return, right-click light dismiss, aria-expanded, tooltip hover/focus rules). e2e: keyboard contracts, Zag's Tab-order cases, layers, placement with and without anchor positioning, RTL, islands with bind:open, axe WCAG A/AA closed/open light/dark, 1.4.10/1.4.12/1.4.13/2.4.7/2.5.8. Docs: ui/popover.md, ui/tooltip.md. Not in this task (proposed follow-ups): Popover openOnHover and modal, Arrow parts, Tooltip.Provider.
<!-- SECTION:FINAL_SUMMARY:END -->
