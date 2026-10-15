---
id: TASK-349
title: LUM2001 flags useId() inside an object literal used in JSX
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 351000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike. LUM2001 (a non-reactive value read in JSX) is reported for a useId() call inside an object literal that is spread or passed in JSX, although useId() returns a constant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useId() inside an object literal used in JSX reports no LUM2001
- [ ] #2 A compiler test covers it
<!-- AC:END -->
