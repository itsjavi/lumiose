---
id: TASK-513
title: >-
  Popover axe test clicks Filters under the open Shipping popup in Firefox and
  WebKit
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 05:20'
updated_date: '2026-10-21 05:48'
labels:
  - test
  - ui
dependencies: []
priority: high
ordinal: 509000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The UI browsers workflow (ui-browsers.yml, Firefox and WebKit on Linux) failed in all four runs since 2026-10-16 (38880800289, 38967778139, 39047144764, 39523378680) on examples/ui-e2e/e2e/popover.e2e.ts 'axe passes closed and open' (light and dark), in both engines: 'locator.click: Test timeout of 30000ms exceeded', with '<p id=…-description>Free shipping on orders over 50 euros.</p> … intercepts pointer events' on the Filters button. Deterministic: with Linux's DejaVu Sans, the Shipping popup (side right, sideOffset 12) covers the Filters trigger in the next grid column; a click there lands in the popup, as it would for a person. Chromium's metrics leave the button clear. The Playwright Docker image lacks DejaVu Sans, which is why runs there passed. The workflow's other failure, the autocomplete reflow check, has the font cause of TASK-505. A one-off Firefox failure of otp-field.e2e.ts 'the input is a plain field…' (38967778139: the recovery input intercepted the Verify click) passed in the two later runs and in 45 local Linux Firefox runs, also under load: not reproducible at HEAD.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test closes the Shipping popup (Escape) before it opens Filters
- [x] #2 It passes in Linux Chromium (dev, build), Firefox and WebKit with DejaVu Sans, 5 repeats
- [x] #3 The ui-e2e suite passes in Linux Firefox and WebKit
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): reproduced in Linux Firefox and WebKit (Playwright 1.63.0 run-server with DejaVu Sans): the 4 popover axe tests failed as in CI. The test now presses Escape and waits for the Shipping popup to hide before it clicks Filters. Checked with CI=1, 5 times in Linux Chromium (dev, build), Firefox and WebKit: 40 passed. The full ui-e2e suite in Linux Chromium, Firefox and WebKit: 2047 passed, 36 skipped, 1 failed (popover-hover-modal in dev, run before TASK-514's fix). Every Firefox and WebKit test passed, the autocomplete reflow included (TASK-505).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The popover axe test closes the Shipping popup before it opens Filters, which the popup covers in Firefox and WebKit with DejaVu Sans. The ui-e2e suite passes in Linux Firefox and WebKit, as the UI browsers workflow runs it.
<!-- SECTION:FINAL_SUMMARY:END -->
