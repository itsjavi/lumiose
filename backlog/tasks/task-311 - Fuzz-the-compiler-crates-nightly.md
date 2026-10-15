---
id: TASK-311
title: Fuzz the compiler crates nightly
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 06:02'
labels:
  - security
  - fuzzing
milestone: m-11
dependencies: []
priority: medium
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: cargo-fuzz targets for the compiler crates (crates/** except lumiose_css, lumiose_svg and lumiose_content): the .stsx/.tsx parser and masking, the JSX transform and SSR codegen, with corpora seeded from the test fixtures. A scheduled nightly GitHub workflow runs every fuzz target of the workspace (also Halo's) for a bounded time and reports crashes; it does not run on push.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fuzz targets cover the parser, masking, the JSX transform and SSR codegen, with seeded corpora
- [ ] #2 A nightly scheduled workflow runs all workspace fuzz targets and fails visibly on a crash
- [ ] #3 CONTRIBUTING.md explains how to run a target locally and reproduce a crash
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.
<!-- SECTION:NOTES:END -->
