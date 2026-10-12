---
id: TASK-244
title: Lumiose SSR throughput regressed to ~560 renders/s
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 13:24'
updated_date: '2026-10-12 14:41'
labels:
  - benchmark
  - performance
milestone: m-8
dependencies: []
priority: high
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 2026-10-12 quiet-machine SSR run (benchmarks/ssr/RESULTS.md, ef81f5b) measured Lumiose at 559.5 ± 23.4 renders/s (0.75x Solid 1.9.17 at 747), down from 663.7 on 2026-10-08 (a5d73ef), which ran on a loaded machine (load 7-9). Bisect the server renderer/codegen changes since a5d73ef (renames, decision-28 server-side props, TASK-151 and others), find the cause and restore at least the previous throughput.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The regression is bisected to its commits, with the cause recorded
- [ ] #2 Lumiose renders the SSR benchmark page at >= 660 renders/s on a quiet machine, or the trade-off is recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: cause found by A/B on the compiled output: decision-28's per-instance memo closure for deep prop reads (TASK-151, ecb44b5) costs ~7%; the renderToString wrapper ~2%. Plain getters were left out of TASK-246 by the user. With TASK-246 and the flattening method, Lumiose leads the SSR benchmark (619 vs Solid 580), so the remaining option is a cheaper memo that keeps decision-28's semantics (e.g. a shared runtime helper instead of a closure per instance).
<!-- SECTION:NOTES:END -->
