---
id: TASK-418
title: 'Slider: arrow keys in right-to-left and vertical sliders in WebKit'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 04:30'
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
- [x] #1 ArrowLeft raises a right-to-left Slider in WebKit, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.

2026-10-16 (Halo): claimed (M12 batch 9, Firefox and WebKit; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): lu-slider now runs every arrow key itself (not only Shift with one): Up and Right step up (Left in a right-to-left horizontal slider), Down and Left step down, by step or with Shift by large-step, with input and change as the platform fires them. WebKit's native range neither mirrored Left/Right right to left; a vertical thumb, whose writing mode turns its own direction, is not mirrored. Alt, Ctrl and Meta are left to the browser. The vertical/RTL test runs in WebKit again; the slider suite passes in dev, build, Firefox and WebKit. Script 1.80 kB brotli (was 1.76); slider.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slider's arrow keys are lu-slider's own, mirrored right to left for horizontal sliders, so WebKit matches Chromium and Firefox. Test unskipped.
<!-- SECTION:FINAL_SUMMARY:END -->
