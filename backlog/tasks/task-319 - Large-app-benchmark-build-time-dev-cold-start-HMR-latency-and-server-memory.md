---
id: TASK-319
title: 'Large-app benchmark: build time, dev cold start, HMR latency and server memory'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 04:03'
labels:
  - performance
  - benchmark
milestone: m-11
dependencies: []
priority: medium
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: a generator for a synthetic app of about 1,500 routes across rendering modes and about 5,000 components with islands, and a benchmark that measures production build time, dev server cold start, HMR latency after an edit and server memory under load. It compares two builds of Lumiose alternated in one run on one machine (AGENTS.md, Performance).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The generator creates the synthetic app deterministically
- [ ] #2 The benchmark measures the four metrics as an A/B of two Lumiose builds in one run
- [ ] #3 Results are recorded with the machine and versions
<!-- AC:END -->
