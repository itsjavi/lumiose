---
id: TASK-542
title: 'build: an app emits every @lumiose/ui client script, used or not'
status: To Do
assignee:
  - Photon
created_date: '2026-10-23 20:56'
labels:
  - vite
  - ui
dependencies: []
priority: low
ordinal: 535000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). Once @lumiose/ui is a dependency, the build emits all 29 ui client scripts, whether pages use them or not. Pages load only theirs, but the build output grows (the port's precompressed set went from 334 to 439 kB raw).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The build emits only the client scripts some page uses
- [ ] #2 A test covers an app that uses one component
<!-- AC:END -->
