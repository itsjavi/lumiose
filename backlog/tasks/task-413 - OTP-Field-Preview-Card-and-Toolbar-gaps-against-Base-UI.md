---
id: TASK-413
title: 'OTP Field, Preview Card and Toolbar: gaps against Base UI'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 01:30'
updated_date: '2026-10-16 02:53'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-376
  - TASK-381
  - TASK-383
priority: low
ordinal: 412000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recorded by Halo in batch 7 (2026-10-16):
- OTP Field (TASK-376): no `normalizeValue`.
- Preview Card (TASK-381): no Arrow or Backdrop parts, and no detached triggers.
- Toolbar (TASK-383): a Menu or Popover trigger inside a Toolbar is an extra tab stop until the toolbar's script runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each gap is closed with docs and e2e, or recorded as dropped with its reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo), against Base UI 1.x:
- OTP Field `normalizeValue`: implemented for islands. The element has a `normalizeValue` property (a function cannot reach a server page's script); Root sets it in an effect, and the script normalizes before it keeps the allowed characters (in clean and in the rejection check, so an O-for-0 or capitals pass validation). Unit test (capitals, O to 0, the value setter) and island e2e (Voucher: ab1c becomes AB1C in the input and the slots).
- Preview Card `Arrow`: dropped, as in Popover and Tooltip (none has an Arrow): anchor positioning gives no arrow offset when the card shifts to fit; a ::before on [data-side] draws a decorative pointer. `Backdrop`: dropped, the card is in the top layer, so ::backdrop styles the layer under it. Detached triggers (`handle`, `payload`): dropped, a card's content is markup rendered with it (one Root and card per link, server HTML included); in an island a signal per link does what a payload does. Documented in preview-card.md.
- Toolbar: a Menu.Trigger or Popover.Trigger inside a Toolbar now takes the toolbar's server tab stop (`toolbar.stop()`, as Toggle does), so it is no extra tab stop before the script. Menu.Popup and Popover.Popup end the Toolbar context for their content (OUTSIDE_TOOLBAR in toolbar/context.ts), so toggles and triggers inside a popup keep their own tab stops and do not consume the toolbar's first stop (this also fixes Toggles inside a toolbar's popover, which got tabindex -1). SSR test and no-JS e2e (Insert has tabindex -1; Tab from Bold leaves the toolbar).
Sizes (brotli): otp-field script 1.26 kB (was ~1.2). Proposed names: normalizeValue (OTPField.Root and the element property), OUTSIDE_TOOLBAR (internal).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
OTP Field normalizeValue (islands; the element property), Toolbar: Menu and Popover triggers take the server tab stop and popups end the toolbar context. Preview Card Arrow, Backdrop and detached triggers dropped with reasons (no Arrow in any popup, ::backdrop of the top layer, markup content per link). Docs and e2e updated.
<!-- SECTION:FINAL_SUMMARY:END -->
