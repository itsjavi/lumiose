---
id: TASK-599
title: >-
  Nightly fuzz: fix the scan timeout and the css_process panic; upgrade
  dependencies and pinned Actions
status: In Progress
assignee:
  - Lux
created_date: '2026-11-10T11:58:00Z'
labels: []
dependencies: []
priority: high
ordinal: 591000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The nightly Fuzz workflow has failed almost every night since 2026-11-04. Two findings: (1) the scan target times out: the LUM3013 ref-order check parses the masked text with OXC, which backtracks exponentially on inputs such as 'a <s <x,(y = a <[[[['; (2) the css_process target panics inside Lightning CSS (values/percentage.rs, unreachable) on a calc() mixing units. Also upgrade npm and Cargo dependencies to their latest versions and re-pin the GitHub Actions to their latest releases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The scan fuzz input from the failing run scans in bounded time, with a regression test
- [ ] #2 The css_process fuzz input no longer panics, with a regression test
- [ ] #3 npm and Cargo dependencies are on their latest compatible versions, with skipped upgrades recorded
- [ ] #4 GitHub Actions are pinned by SHA to their latest releases
- [ ] #5 pnpm check passes
<!-- AC:END -->
