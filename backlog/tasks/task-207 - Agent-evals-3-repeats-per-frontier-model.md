---
id: TASK-207
title: 'Agent evals: 3 repeats per frontier model'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
labels:
  - evals
  - positioning
milestone: m-5
dependencies: []
priority: medium
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the agent numbers go on the landing only after 3 repeats per model, published with method and caveats. Same matrix as the 2026-10-09 run (20 tasks x 6 configurations, medium effort, baseline ablation, Lumiose pinned to one revision). About $25 of subscription quota.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A committed results file with 3 runs per configuration
- [ ] #2 doc-5 and the eval viewer summarise pass rate, first-check pass rate, turns and cost per task, with variance across runs
<!-- AC:END -->
