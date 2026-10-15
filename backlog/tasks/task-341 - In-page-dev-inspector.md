---
id: TASK-341
title: In-page dev inspector
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 07:41'
labels:
  - dx
milestone: m-11
dependencies:
  - TASK-323
priority: low
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-59 (proposal in TASK-323, approved by the user on 2026-10-15). A dev-only inspector that lumiose dev injects in a shadow root: Tree (owners, a props snapshot, source locations), Signals (values, dependents, the last write), Islands (strategy, state, timings, and the load failures of TASK-305), Why did this update, and Alt+click to open the element's .stsx source through Vite's open-in-editor endpoint. Alt+Shift+L or a corner button opens it; lumiose({ inspector: false }) turns it off. The reactive core and the island loader call a dev hook registry only behind DEV, and the compiler passes component names and source locations in dev. The injection lives in Nova's packages/vite/src/app: coordinate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Alt+Shift+L or the corner button opens the inspector in dev, and lumiose({ inspector: false }) removes it
- [ ] #2 Tree, Signals, Islands and Why did this update show the page's live state
- [ ] #3 Alt+click opens the element's .stsx source at its line
- [ ] #4 Builds contain none of it: bundles and size caps are unchanged
- [ ] #5 The docs describe it (a dev tools section and reference/vite.md)
<!-- AC:END -->
