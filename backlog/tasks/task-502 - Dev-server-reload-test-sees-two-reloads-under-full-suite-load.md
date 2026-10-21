---
id: TASK-502
title: Dev server reload test sees two reloads under full-suite load
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 00:35'
updated_date: '2026-10-21 05:48'
labels:
  - test
dependencies: []
priority: low
ordinal: 498000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
packages/vite/src/app/dev/dev-server.test.ts 'reloads the browser after edits to client code (TASK-148)' expected one full-reload and received two identical ones during pnpm check on 2026-10-21 (full workspace run). It passes alone (3/3) and in the @lumiose/vite project run (234/234). Likely a duplicate watcher event under load: either debounce identical reloads in the dev server or let the test accept repeated identical reloads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test no longer depends on the watcher emitting one event per edit; 20 consecutive full runs of the vite project pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Taken over by Beacon in the CI reliability batch for Lux (2026-10-21), at the orchestrator's request; Nova's area.

2026-10-21 (Beacon): the cause was confirmed with a late duplicate watcher event: a change emitted 60 ms after the write, past the dev server's 30 ms burst window, gave exactly the two identical full-reloads of the report. The original assertion fails on that, and the new one (every payload is a full-reload, at least one) passes. Not reproduced by load alone: 10 runs of the file under CPU load and 5 full workspace vitest runs all passed. The burst test above keeps checking the coalescing with emitted events. AC: 20 consecutive runs of the @lumiose/vite project passed (234 tests each, some next to a Linux e2e run), and pnpm check passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The client-code reload test accepts repeated identical full-reloads. One write reported as two changes more than the 30 ms burst window apart (a loaded machine) gave two reloads. The coalescing is still covered by its own test. 20 consecutive runs of the vite project pass.
<!-- SECTION:FINAL_SUMMARY:END -->
