---
id: TASK-198
title: lumiose as a peer dependency of @lumiose/vite
status: To Do
assignee:
  - Photon
created_date: '2026-10-10 19:27'
labels:
  - package
dependencies: []
priority: low
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-193: @lumiose/vite's Vitest setup resets scoped state on the lumiose copy it resolves. If an app ever resolves two lumiose copies, the reset would clear the wrong one (and compiler-emitted imports would bind elsewhere). Make lumiose a peer dependency of @lumiose/vite (workspace:^ peer + workspace:* dev), as @lumiose/query does; check pack:check and the create templates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose is a peer of @lumiose/vite; pack:check and release tests pass; create templates still install
<!-- AC:END -->
