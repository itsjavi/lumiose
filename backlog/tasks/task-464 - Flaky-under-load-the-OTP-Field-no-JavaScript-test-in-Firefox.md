---
id: TASK-464
title: 'Flaky under load: the OTP Field no-JavaScript test in Firefox'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 16:12'
updated_date: '2026-10-16 22:35'
labels:
  - ui
  - test
milestone: m-12
dependencies: []
priority: medium
ordinal: 462000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen at the fix batch 2 merge (2026-10-16). examples/ui-e2e/e2e/otp-field.e2e.ts:44 ('without JavaScript: the input is a plain field that validates its pattern and submits') failed once in a full Firefox/WebKit run. Beacon saw the same thing in batch 2. On its own it passes 8 of 8 in Firefox. The ui-browsers CI job could hit it, so find the timing assumption and make the test robust.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test passes repeatedly inside a full Firefox run (e.g. --repeat-each in a full-suite run)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (final M12 batch; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): cause found, not in the OTP test. Reproduced inside a full Firefox run (both repeats of otp-field.e2e.ts:44 failed with --repeat-each=2): the click on Verify timed out because 'the Recovery code input intercepts pointer events'. Running number-otp-review.e2e.ts then otp-field.e2e.ts reproduced it every time; one test at a time narrowed it to number-otp-review's L17 (Beacon's TASK-447): it holds Control and turns the mouse wheel over a Number Field to check Ctrl+wheel never steps it. In Firefox that zooms the page, and Firefox keeps the zoom for the site in the browser, across Playwright's contexts: a fresh page of the same origin in the next test is 1173 CSS px wide instead of 1280 (probed), so Playwright's clicks land off target (on the field above Verify). Alone, the OTP test never ran after L17, hence 8 of 8. Fix: L17 dispatches the Ctrl+wheel as a wheel event (ctrlKey, cancelable) on the field, which the component's handler sees and the browser never zooms for; L17 still fails without the component's ctrlKey guard in dev, build, Firefox and WebKit. The pair now passes in order.

2026-10-16 (Halo): the full Firefox run with --repeat-each=2 after the fix: the OTP test passed in both repeats; 991 passed, 1 failed: progress.e2e.ts's axe test (light), which had also failed in the run before. Same class of timing assumption, in its hydrated() helper: it clicked Advance (+25) every 250ms until the bar read exactly 50%, so a click that landed but showed late was followed by another, and the bar overshot to 100% for good. The helper now probes with Restart (idempotent), then advances twice to 50%. progress.e2e.ts passes 93 of 93 with --repeat-each=3 in dev, build, Firefox and WebKit. The other specs' toPass probes click idempotent controls or assert monotonic states (checked).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The OTP no-JS flake came from another test: number-otp-review's L17 sent a real Ctrl+wheel, which zooms Firefox and keeps the zoom for the site across Playwright's contexts, so later clicks missed. L17 now dispatches the wheel event. Also fixed Progress's hydration probe, which could overshoot past 50% under load. Both pass inside full Firefox runs.
<!-- SECTION:FINAL_SUMMARY:END -->
