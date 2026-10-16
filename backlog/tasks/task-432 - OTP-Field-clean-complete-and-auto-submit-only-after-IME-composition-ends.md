---
id: TASK-432
title: 'OTP Field: clean, complete and auto-submit only after IME composition ends'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:35'
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
- [x] #1 OTP Field: clean, complete and auto-submit only after IME composition ends, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).

2026-10-16 (Beacon): Fixed. otp-field.script.ts: an `input` with isComposing only updates the slots (no cleaning, no completion, no auto-submit); `compositionend` dispatches an `input`, which cleans, completes and submits the committed text (Chromium fires no `input` after compositionend; where the browser does, the second finds the value clean and the completion done, guarded by #completed). The component's on:input skips composing events, so onValueChange reports the commit. Tests: otp-field.script.dom.test.ts (composing input events left alone, the commit cleaned, completing and submitting once even with a trailing input); ui-e2e otp-field.e2e.ts 'IME composition (TASK-432)' with Chromium's CDP IME (Input.imeSetComposition / insertText): the recovery code keeps the committed 中文, the PIN does not submit an uncommitted full-width composition, and submits once committed; skipped in Firefox and WebKit (no CDP; the DOM test covers their event order). Both fail without the fix. otp-field.md: the IME line.
<!-- SECTION:NOTES:END -->
