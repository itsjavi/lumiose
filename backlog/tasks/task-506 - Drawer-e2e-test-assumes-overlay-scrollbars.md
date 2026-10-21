---
id: TASK-506
title: Drawer e2e test assumes overlay scrollbars
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:56'
updated_date: '2026-10-21 04:59'
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
- [ ] #1 The test checks the drawer against the root's width with the dialog open
- [ ] #2 It passes in Linux and macOS Chromium, dev and build, 5 repeats
<!-- AC:END -->
