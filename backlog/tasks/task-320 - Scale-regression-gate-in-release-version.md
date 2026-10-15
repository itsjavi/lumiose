---
id: TASK-320
title: 'Scale regression gate in release:version'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 04:03'
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
