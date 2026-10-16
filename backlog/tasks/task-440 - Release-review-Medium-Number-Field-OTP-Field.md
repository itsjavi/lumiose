---
id: TASK-440
title: 'Release review, Medium: Number Field, OTP Field'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 12:34'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: medium
ordinal: 438000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Number Field, OTP Field. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M32. Number Field (native): Alt+Arrow (smallStep 0.1), End and clamping leave the native step grid, and the form then refuses to submit (`stepMismatch`).** CONFIRMED in Chromium and Firefox.
- **Fix:** snap to the input's step grid (based on min), or render `step="any"`.

**M33. OTP Field: `mask` only hides the code visually.** CONFIRMED in 3 engines.
- The AX value is the code, so screen readers speak it. An unforeseen consequence of "one input".
- **Violates:** BU `type=password` when masked.
- **Fix:** `type="password"` when masked, keeping `autocomplete`.

**M34. OTP Field (numeric) accepts any `\p{Nd}`; the formatted Number Field rejects full-width digits.** CONFIRMED in Chromium.
- OTP submits "１２３٤٥٦" as is, and alphanumeric accepts kana.
- **Fix:** normalise to ASCII in OTP `#clean` and in `parseNumber` (BU parse.ts maps them).

**M35. OTP Field: the overlaid input's `font-size: 1px` likely makes iOS Safari zoom on focus.** SUSPECTED (no iOS).
- **Fix:** make the transparent input at least 16px.

**M36. Number Field: `inputmode="decimal"` everywhere means no minus key on iOS.** SUSPECTED.
- BU uses `text` unless `min >= 0`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M32: Number Field: keys and clamping stay on the native step grid
- [ ] #2 M33: OTP Field: a masked code is a password input
- [ ] #3 M34: Normalize non-ASCII digits in OTP Field and Number Field
- [ ] #4 M35: OTP Field: no iOS focus zoom
- [ ] #5 M36: Number Field: a keyboard with a minus sign when negatives are allowed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).
<!-- SECTION:NOTES:END -->
