---
id: TASK-436
title: 'Release review, Medium: Layers and overlays'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: medium
ordinal: 434000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Layers and overlays. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M1. Closing a layer leaves the layers inside it open.** Prism. CONFIRMED in 3 engines (`nest`).
- **Repro:** open Outer popover, then Open dialog, then `hidePopover()` on the popover. That is any programmatic close, such as a bound `open` set to false.
  - **Observed:** the modal dialog stays open and modal with a 0x0 box. Tab and clicks reach nothing; only Escape recovers.
- `dialog.close()` with an open Menu or Popover inside leaves the child `:popover-open`. Chromium keeps the popover visible, floating without its dialog, and the next Escape is spent on the invisible layer. Combobox is fine.
- **Violates:** BU closes floating-tree children with the parent; WCAG 2.1.2 for pointer users.
- **Fix:** on a layer's or dialog's close, close the open dialogs and layers inside it, innermost first (layer.ts plus dialog.script).

**M2. Popover (non-modal) stays open after Tab leaves it and covers the next controls.** CONFIRMED in 3 engines (overlays and theme).
- **Repro:** `/popover`, Enter on Notifications, Tab past the popup. "Share…" is focused while 66–74% of it sits under the popup.
- `/popover/hover-modal`: Grace Hopper and Alan Turing are entirely hidden under Ada's popup.
- **Violates:** BU PopoverRoot.test (closes on tab-out); Zag popover; WCAG 2.4.11.
- **Fix:** close on `focusout` when the related target is outside the popup, its nested layers and the trigger. Update popover.md.

**M3. Popover with openOnHover: hover then leave (or Escape) focuses the trigger.** CONFIRMED in 3 engines.
- **Repro:** `/popover/hover-modal`, with nothing focused. A focus ring appears on "Ada Lovelace".
- **Cause:** the closed-`toggle` handler restores focus whenever the active element is body.
- **Violates:** BU "does not change focus when opened with hover and closed"; popover.md.
- **Fix:** restore focus only if the popup held it (or for a click-opened popover in WebKit).

**M4. Popover `modal="trap-focus"` leaks Tab, and focus-on-open lands on the wrong radio.** CONFIRMED in 3 engines.
- **Observed:** with a radio group (or a roving toolbar or toggle group) at the end of the popup, Tab from the checked radio goes to the page. On open, focus lands on an unchecked radio.
- **Cause:** the loop uses a FOCUSABLE selector, not tab stops.
- **Fix:** focus sentinels, or a real tab-stop filter (skip negative tabindex; one radio per group).

**M5. Drawer: a drag that starts on the backdrop swipes and closes the drawer, even with `closedby="closerequest"`.** CONFIRMED in 3 engines and with Chromium touch.
- **Cause:** a backdrop press targets the dialog.
- **Violates:** BU DrawerViewport `canStart` (inside the popup only); drawer.md.
- **Fix:** `start()` rejects points outside the dialog's box.

**M6. Drawer: mouse text selection in Drawer.Content swipes and closes the drawer.** CONFIRMED in 3 engines.
- **Violates:** BU DrawerViewport.test "does not start non-touch swipes from Drawer.Content".
- **Fix:** mark Content; ignore mouse and pen drags that start in it.

**M7. Toast inside a Drawer: flicking a toast also dismisses the Drawer.** CONFIRMED in Chromium and WebKit.
- The viewport is relocated into the open modal, so Drawer's `start()` sees a press inside `dialog[data-swipe-direction]`. A consequence of the relocation that was not foreseen.
- **Fix:** add `data-swipe-ignore` to `lu-toast-viewport` (Drawer already honours it).

**M8. Toast: the region is lost when the open modal that holds it is removed.** CONFIRMED in Chromium.
- **Repro:** `/toast/island`, open the dialog, add a toast, `dialog.remove()`, add a toast. The viewport is detached and 0 toasts render while the manager holds 2.
- **Violates:** doc-9 §1 and §16; WCAG 4.1.3.
- **Fix:** in `disconnectedCallback`, when not moving, put the viewport back at home; prune disconnected dialogs from `modals`.

**M9. Toast: focus drops to `<body>` when the focused toast is pushed past the limit.** CONFIRMED in 3 engines.
- **Repro:** focus Retry through F6 and Tab, then 3 toasts arrive.
- **Violates:** doc-9 §16; WCAG 2.4.3. BU shares this (inert); Zag queues.
- **Fix:** never limit the toast that holds focus.

**M10. Toast: a persistent toast hides keyboard-focused content.** CONFIRMED in Chromium and Firefox.
- **Repro:** a `timeout: 0` toast plus a tall page of right-aligned buttons. Of 40 Tab stops, 10–12 end up entirely under the toast, at 1280x720 and 320x640.
- **Violates:** WCAG 2.4.11; doc-9 §17.
- **Fix:** the toast script publishes the stack height (`--lu-toast-stack-block-size`), and the theme sets `scroll-padding-block-end` while toasts show.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M1: Layers: closing a popup closes the popups and dialogs inside it
- [ ] #2 M2: Popover: close a non-modal popover when focus leaves it
- [ ] #3 M3: Popover: a hover-opened popover never moves focus on close
- [ ] #4 M4: Popover: trap-focus and focus-on-open use real tab stops
- [ ] #5 M5: Drawer: swipes start only inside the drawer
- [ ] #6 M6: Drawer: no mouse swipe from Drawer.Content
- [ ] #7 M7: Swipes on toasts never reach a Drawer they were moved into
- [ ] #8 M8: Toast viewport returns home when the modal holding it is removed
- [ ] #9 M9: Toast limit never hides the focused toast
- [ ] #10 M10: Keep focused content clear of the toast stack
<!-- AC:END -->
