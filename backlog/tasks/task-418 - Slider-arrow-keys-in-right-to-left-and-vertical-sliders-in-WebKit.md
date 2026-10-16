---
id: TASK-418
title: 'Slider: arrow keys in right-to-left and vertical sliders in WebKit'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 03:39'
labels:
  - ui
  - browsers
milestone: m-12
dependencies: []
ordinal: 416000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), in Linux WebKit (Playwright 1.63). slider.e2e.ts "vertical: up raises it; right to left: left raises it": in a right-to-left slider ArrowLeft lowers the value (29 instead of 31). WebKit's native range input does not mirror the arrow keys right to left; lu-slider could handle them itself there. Related to the RTL work in packages/ui. The test skips WebKit with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ArrowLeft raises a right-to-left Slider in WebKit, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.
<!-- SECTION:NOTES:END -->
