---
id: TASK-288
title: Profile build time on the itsjavi.com port against Astro
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-16 23:22'
labels:
  - build
  - performance
dependencies: []
priority: low
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 11. Same pages and images: lumiose build takes 5.9 s cold and 3.4 s warm (median of 3) against Astro's 4.2 s and 2.3 s. Find where the time goes (client build, server build, prerender, stylesheet merging, precompression) and fix what is Lumiose's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A profile of the port's build is recorded in the task, with the share of each step
- [ ] #2 Lumiose-side costs found are fixed or recorded as follow-up tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17 (Lux, orchestrator): assigned to Nova for the next unattended batch. Nova measured the port in TASK-285.
<!-- SECTION:NOTES:END -->
