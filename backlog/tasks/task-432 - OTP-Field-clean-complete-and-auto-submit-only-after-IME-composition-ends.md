---
id: TASK-432
title: 'OTP Field: clean, complete and auto-submit only after IME composition ends'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:08'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 430000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H6.

**H6. OTP Field: IME composition breaks, and autoSubmit fires mid-composition.** CONFIRMED in Chromium (CDP IME).
- **Commit lost:** on Recovery code (alphanumeric, 4), compose and commit "中文". The input sticks at "zhon" and the commit is lost; a plain `<input maxlength=4>` ends with "中文".
- **Early submit:** on the PIN field (autoSubmit), compose "１２３４" without committing. The page navigates to `?pin=１２３４`.
- **Cause:** `#onInput` rewrites the value, and completes and submits, while `isComposing`.
- **Violates:** doc-9 §1 IME; BU OTPFieldInput.test "commits an IME composition once on compositionend"; WCAG 3.2.2.
- **Fix:** skip cleaning, completion and submit while composing; run them on `compositionend`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OTP Field: clean, complete and auto-submit only after IME composition ends, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).
<!-- SECTION:NOTES:END -->
