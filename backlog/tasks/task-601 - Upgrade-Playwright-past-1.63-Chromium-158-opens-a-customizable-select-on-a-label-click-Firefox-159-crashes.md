---
id: TASK-601
title: >-
  Upgrade Playwright past 1.63: Chromium 158 opens a customizable select on a
  label click, Firefox 159 crashes
status: To Do
assignee:
  - Halo
created_date: '2026-11-10T16:56:00Z'
labels:
  - ui
  - e2e
dependencies: []
priority: medium
ordinal: 593000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Playwright 1.65.0 (Chromium 158.0.8127, Firefox 159.0) broke two things in examples/ui-e2e, so TASK-599's upgrade was rolled back to 1.63.0. Both reproduce locally.

1. Chromium 158: a click on a <label for> of a customizable select (appearance: base-select) now opens the picker and focuses an option, where it used to focus the select only. e2e/select.e2e.ts:136 asserts the old behaviour. Decide whether @lumiose/ui follows the browser or keeps the old behaviour, then update the test and docs.
2. Firefox 159 (Playwright build 1572): the page crashes in drawer.e2e.ts:207 (touch swipe), the tooltip and popover-hover-modal axe tests, select.e2e.ts:173, and most of virtualizer.e2e.ts and virtual-components.e2e.ts. Find what crashes it (a browser bug or something in @lumiose/ui) and whether release Firefox is affected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ui-e2e passes in Chromium, Firefox and WebKit on the newest Playwright
- [ ] #2 The label-click behaviour of a customizable select is decided and documented
- [ ] #3 The cause of the Firefox crashes is recorded, with an upstream report proposed if it is a browser bug
<!-- AC:END -->
