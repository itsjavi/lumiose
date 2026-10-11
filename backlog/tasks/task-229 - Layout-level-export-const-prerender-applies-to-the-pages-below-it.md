---
id: TASK-229
title: Layout-level export const prerender applies to the pages below it
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 02:05'
labels:
  - app
  - build
milestone: m-7
dependencies: []
priority: medium
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-38 amendment (user 2026-10-11): `export const prerender` on a layout applies to every page below it, inherited the same way as `mode` and `ssr` (nearest layout that sets it, then the project default). A page can still opt out with `prerender = false`. TASK-216 reads it from pages only and warns with LUM5002 on layouts. Update the route manifest and typegen, the diagnostics (LUM5002 no longer fires on spa layouts; LUM5006 applies when the inherited prerender meets ssr = false), concepts/rendering-modes.md and the reference pages, and llms.txt. Add tests for a prerendering layout, a page opting out, and nested layouts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A layout's prerender applies to the pages below it, with the nearest setting winning and a page able to opt out with prerender = false
- [ ] #2 Diagnostics, the manifest, typegen and docs follow the inherited value, with tests for a layout, an opt-out and nested layouts
<!-- AC:END -->
