---
id: TASK-139
title: App-layer friction from the fullstack benchmark
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 04:57'
labels:
  - app
  - docs
  - dev
dependencies: []
priority: low
ordinal: 139000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nova's TASK-112 friction notes: (1) docs: named actions keep the page's other query params (?status=open&/close) but data-and-actions.md documents only ?/name; routing.md does not say the root _404 renders inside the root _layout; (2) lumen dev sends two full-reload messages for one file save.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Docs cover both points (with examples)
- [ ] #2 One save triggers one reload/HMR update in lumen dev, with a test
<!-- AC:END -->
