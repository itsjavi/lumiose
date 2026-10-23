---
id: TASK-529
title: LUM2001 misses a signal read copied into a local (const n = count())
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-23 09:31'
labels: []
dependencies: []
priority: medium
ordinal: 522000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while implementing TASK-523: `const n = count()` in a component body is not reported by LUM2001, although the agent guidance (AGENTS.md block and the lumiose skill) says LUM2001 warns when a signal's value is copied once at setup. Either make LUM2001 report it (and decide how it interacts with decision-77's split) or correct the guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LUM2001 reports const n = count() at setup, with a golden test, or the guidance no longer claims it
<!-- AC:END -->
