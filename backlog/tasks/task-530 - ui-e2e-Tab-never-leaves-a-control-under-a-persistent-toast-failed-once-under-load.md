---
id: TASK-530
title: >-
  ui-e2e: 'Tab never leaves a control under a persistent toast' failed once
  under load
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-23 09:54'
updated_date: '2026-10-23 19:54'
labels:
  - test
dependencies: []
priority: low
ordinal: 523000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
examples/ui-e2e/e2e/toast.e2e.ts:313 (build project) counted one focused control under the toast viewport (covered 1, expected 0) in a full ui-e2e run right after pnpm check on 2026-10-23 (1023 passed, 1 failed). The toast file passed 5 repeats in a row alone (225/225), and the test 3/3. It reads the focused element's rect right after each Tab, which may land before the page's scroll-into-view settles under load. Per decision-76, find the cause: wait for scroll to settle (or read after a frame), or check scroll-padding against the toast stack, instead of retrying.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test waits on a real condition and passes 20 repeats of the toast file under CPU load
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (session halo-a9eb2b59, 0.6.1 cleanup batch, worktree branch): claimed and started.

Halo: cause. The test reads each focused step's rect right after Tab, and focus scrolls it at once (a log of every Tab shows the scroll already applied). The one asynchronous input is the page's scroll padding: Toast.Viewport publishes its height (--lu-toast-stack-block-size, which toast.css turns into scroll-padding-block-end) from a ResizeObserver, so it is set at the next rendering update, and the toast can be visible before that. The 39 Tabs take about 300 ms in all. With the ResizeObserver delayed by 300 ms (an init script standing in for a renderer that skips frames under load), the old test failed 3 of 3 times: Steps 10 to 13 (and 20 to 22) stayed under the toast. If the padding lands between the Tabs to Step 10 and Step 11, you get exactly one covered step, which matches the failure. Without that delay, 240 runs of the old logic under 14 to 20 busy threads all passed, so the race is rare. Fix (examples/ui-e2e/e2e/toast.e2e.ts M10): before tabbing, poll until the root's computed scroll-padding-block-end covers the stack's height. After each Tab, wait until Step N has focus and read the rects after a frame. A failure now names each covered step with its rects. With the 300 ms delay the new test passed 6 of 6 (dev and build). Evidence: 20 repeats of toast.e2e.ts in Chromium (dev and build projects): 920 tests, 900 passed, 20 skipped (dev-only skips), 0 failed, 16.7 min. A 12-thread CPU load ran for the first ~13 min, until Lux stopped it to free the machine for a performance measurement. So about the first 15 repeats (~690 tests, ~30 of the 40 M10 runs) ran under load, and the rest ran on a quiet machine. pnpm typecheck and pnpm lint pass. Full pnpm check not run, for the same reason. No product change: a person cannot Tab inside the frame before the padding is published.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The M10 toast test (Tab never leaves a control under a persistent toast) now waits for the real precondition: the page's scroll padding covers the toast stack, which the viewport's ResizeObserver publishes at the next rendering update. It also reads each step after a frame, and a failure names the covered steps. A late ResizeObserver reproduced the failure with the old test and passes with the new one. 20 repeats of the toast file passed (900/900, 20 skipped), the first ~15 of them under CPU load.
<!-- SECTION:FINAL_SUMMARY:END -->
