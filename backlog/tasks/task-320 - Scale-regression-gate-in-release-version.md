---
id: TASK-320
title: 'Scale regression gate in release:version'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:02'
labels:
  - performance
  - release
milestone: m-11
dependencies:
  - TASK-319
priority: medium
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: pnpm release:version runs the large-app benchmark as an A/B of the previous release and the candidate, locally (not in CI), and stops the release when any metric regresses by more than 20%. The numbers go into the release notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 release:version runs the A/B and stops on a regression above 20% on any metric
- [ ] #2 The release notes include the measured numbers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.
<!-- SECTION:NOTES:END -->
