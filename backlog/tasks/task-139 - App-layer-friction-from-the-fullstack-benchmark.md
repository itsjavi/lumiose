---
id: TASK-139
title: App-layer friction from the fullstack benchmark
status: Done
assignee:
  - Nova
created_date: '2026-10-09 04:57'
updated_date: '2026-10-09 05:03'
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
- [x] #1 Docs cover both points (with examples)
- [x] #2 One save triggers one reload/HMR update in lumen dev, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: (2) could not reproduce a double reload for a single real write (one full-reload frame per write in repeated traces); the double reload seen during TASK-112 matches one save reaching the watcher as two change events (truncate then write). Fix: lumen dev debounces the full reload (30 ms) per burst of file events (app/dev/plugin.ts scheduleReload). Test: dev-server.test.ts emits three change events for one file and expects one full-reload (fails with 4 before the fix; passed 2/2 runs after). NOTE: dev-server tests are currently skipped/broken in the shared tree by an uncommitted change elsewhere (vite/index.ts imports projectOptionsOf, not yet exported by the WIP vite/options.ts), so re-run them once that lands. (1) Docs: data-and-actions.md explains that a named action's URL may keep the page's query params (?status=open&/close, ctx.url keeps them) with a type-checked example; routing.md says error pages render inside the layouts of their folder (root _404 inside the root _layout), fall back to no layouts if a layout fails, and how to give errors a different frame with a route group. Commit 9fecdb3 (only my hunks; Spark's headers hunk in plugin.ts left in the tree).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Docs for named actions keeping query params and for error pages inside layouts; lumen dev reloads once per burst of file events (30 ms debounce) with a test. 9fecdb3.
<!-- SECTION:FINAL_SUMMARY:END -->
