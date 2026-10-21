---
id: TASK-502
title: Dev server reload test sees two reloads under full-suite load
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-21 00:35'
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
- [ ] #1 The test no longer depends on the watcher emitting one event per edit; 20 consecutive full runs of the vite project pass
<!-- AC:END -->
