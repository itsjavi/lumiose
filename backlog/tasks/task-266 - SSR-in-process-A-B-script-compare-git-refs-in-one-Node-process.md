---
id: TASK-266
title: 'SSR in-process A/B script: compare git refs in one Node process'
status: To Do
assignee:
  - Nova
created_date: '2026-10-12 22:45'
labels:
  - bench
  - tooling
dependencies: []
priority: medium
ordinal: 268000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-244 (Nova): the perf rule (A/B in one process, old and new alternating) needs a ready tool. Turn the TASK-244 tools (.local/agents/nova/nova-20261012T220911Z-t244/: variant.mjs, point.sh, abn.mjs) into a committed script, e.g. benchmarks/ssr/scripts/ab.ts <ref>…: worktree per ref, that ref's compiler (debug napi is enough, same codegen) and runtime copy, rotated rounds with warmup and GC, a same-build control, median ratios and spread, flattening on/off, cleanup of worktrees and build output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One command compares N git refs in one process and prints median ratios with spread and a same-build control
- [ ] #2 Documented in benchmarks/ssr/README (and the perf rule in AGENTS.md points to it); worktrees and build output are cleaned up
<!-- AC:END -->
