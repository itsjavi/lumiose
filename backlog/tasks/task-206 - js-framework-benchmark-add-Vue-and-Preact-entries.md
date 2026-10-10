---
id: TASK-206
title: 'js-framework-benchmark: add Vue and Preact entries'
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 22:41'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the stack table's Vue + Nuxt and Preact rows need client speed and size. Add krausest's keyed Vue (standard, not Vapor) and Preact entries to pnpm bench:jsfb, at current versions, and rerun.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm bench:jsfb runs Vue (non-Vapor) and Preact keyed entries with pinned versions
- [ ] #2 RESULTS.md includes both, with published factors where krausest has them
<!-- AC:END -->
