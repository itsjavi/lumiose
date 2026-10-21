---
id: TASK-513
title: >-
  Popover axe test clicks Filters under the open Shipping popup in Firefox and
  WebKit
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 05:20'
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
- [ ] #1 The test closes the Shipping popup (Escape) before it opens Filters
- [ ] #2 It passes in Linux Chromium (dev, build), Firefox and WebKit with DejaVu Sans, 5 repeats
- [ ] #3 The ui-e2e suite passes in Linux Firefox and WebKit
<!-- AC:END -->
