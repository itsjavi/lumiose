---
id: TASK-104
title: Fix the flaky css-manifest test under parallel load
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 22:17'
labels: []
milestone: m-2
dependencies: []
priority: low
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nova saw packages/lumen/src/vite/css-manifest test fail in a full pnpm test run but pass alone (2026-10-09), likely a timing or shared-temp-dir race under parallel load.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause found and fixed (isolated temp dirs, deterministic waits); the test passes repeatedly under full-suite parallelism (e.g. 10 consecutive full runs of the vite project)
<!-- AC:END -->
