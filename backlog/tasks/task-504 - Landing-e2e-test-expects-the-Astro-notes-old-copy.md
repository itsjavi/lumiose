---
id: TASK-504
title: Landing e2e test expects the Astro note's old copy
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:55'
updated_date: '2026-10-21 05:48'
labels:
  - test
dependencies: []
priority: high
ordinal: 500000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI e2e (ubuntu) failed in runs 39523378481 and 39539444578: apps/web/e2e/web.e2e.ts 'the landing page presents Lumiose with benchmark evidence' looks for a #compare .note matching /^Astro's interactive islands need a second UI framework\.$/ and finds none. Deterministic: 9f8a58de (TASK-482) changed ASTRO_NOTE in apps/web/src/content/stacks.ts to 'Astro's interactive islands use a second UI framework: Preact in the fullstack comparison, …' without updating the e2e test, which only runs in the e2e job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The landing test matches the current ASTRO_NOTE copy
- [x] #2 The test passes in Chromium (static project), 5 repeats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): the regex now matches the start of the current ASTRO_NOTE ('Astro's interactive islands use a second UI framework: Preact in the fullstack comparison'). Lux pointed out the same cause meanwhile. Checked with CI=1: the test 5 times in Linux Chromium (Playwright 1.63.0 image, DejaVu Sans) and 5 times in macOS Chromium, and the full apps/web suite in both (179 passed, 4 skipped each).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The landing e2e test asserts the Astro note's current copy (changed by TASK-482). It passes in Linux and macOS Chromium, and so does the full apps/web suite.
<!-- SECTION:FINAL_SUMMARY:END -->
