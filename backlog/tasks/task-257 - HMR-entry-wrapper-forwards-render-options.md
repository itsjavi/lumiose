---
id: TASK-257
title: HMR entry wrapper forwards render() options
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-12 19:57'
labels:
  - vite
  - dx
milestone: m-9
dependencies: []
priority: low
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dev HMR wrapper of app entries (HMR_DOM_CODE in packages/vite/src/index.ts) defines render(code, container) and calls renderRoot(code, container), dropping render()'s third argument. Since TASK-247, render(code, container, { idPrefix }) prefixes useId() ids, so in lumiose dev the prefix is lost for entries that import render from lumiose/dom. Forward the options: render(code, container, options) -> renderRoot(code, container, options).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The HMR wrapper passes render()'s options through; a test covers idPrefix in a dev entry
<!-- AC:END -->
