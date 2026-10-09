---
id: TASK-173
title: 'Perf: minimal DOM moves for row swaps; trim the island runtime'
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 12:12'
labels:
  - perf
  - dom
milestone: m-7
dependencies: []
priority: medium
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the TASK-68 run: 05_swap1k is 1.37x vanilla (Solid 1.12x); script time 1.3 ms vs 0.1, so the extra ~8 ms is layout from extra DOM moves. Islands on top of typical imports are 2.77 kB vs the 2.75 kB soft target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Swapping two rows performs the minimal DOM moves (mutation-count test); jsfb 05 measured before/after with no regressions on 01–09
- [ ] #2 Hydration + loader trimmed under the soft target, then doc-1 §6 targets ratcheted (proposal to Lux)
<!-- AC:END -->
