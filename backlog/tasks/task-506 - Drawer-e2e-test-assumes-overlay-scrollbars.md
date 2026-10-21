---
id: TASK-506
title: Drawer e2e test assumes overlay scrollbars
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:56'
updated_date: '2026-10-21 05:48'
labels:
  - test
dependencies: []
priority: high
ordinal: 502000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI e2e (ubuntu) failed in every run since 38880800285: examples/ui-e2e/e2e/drawer.e2e.ts 'without JavaScript › the trigger opens a modal drawer against its edge' expects the drawer as wide as the viewport (1280) and gets 1265, in dev and build. Deterministic on Linux: with a modal open, dialog.css locks the root's scroll with 'overflow: hidden; scrollbar-gutter: stable', and Linux's classic scrollbar gutter takes 15 px (macOS's overlay scrollbars none). Measured in Linux Chromium: html 1265 px wide with the dialog open, the drawer 1265 px at x 0. The test should compare with the page's width, not the viewport's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test checks the drawer against the root's width with the dialog open
- [x] #2 It passes in Linux and macOS Chromium, dev and build, 5 repeats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): measured in Linux Chromium with the drawer open (no JS): viewport 1280, root and body 1265 (dialog.css's stable gutter), drawer 1265 at x 0; macOS 1280 throughout. The test now compares the drawer's width with document.documentElement's box width. Checked with CI=1, 5 times each in Linux and macOS Chromium, dev and build; also passes in Linux Firefox and WebKit. The gutter on short pages is TASK-507 (Halo).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The no-JS drawer test compares the drawer with the page's width, which the scroll lock's stable gutter narrows by 15 px on Linux. Passes on Linux and macOS; the gutter itself is TASK-507.
<!-- SECTION:FINAL_SUMMARY:END -->
