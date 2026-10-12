---
id: TASK-266
title: 'SSR in-process A/B script: compare git refs in one Node process'
status: Done
assignee:
  - Nova
created_date: '2026-10-12 22:45'
updated_date: '2026-10-12 23:09'
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
- [x] #1 One command compares N git refs in one process and prints median ratios with spread and a same-build control
- [x] #2 Documented in benchmarks/ssr/README (and the perf rule in AGENTS.md points to it); worktrees and build output are cleaned up
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-20261012T224545Z-t266):
- benchmarks/ssr/scripts/ab.ts (pnpm --filter @lumiose/bench-ssr ab <ref>…; '.' is the working tree; one ref = that ref vs the working tree). Per ref: temporary worktree, debug napi compiler built into one shared CARGO_TARGET_DIR (copied right after each build, since the next ref overwrites the same file), the ref's Page.stsx compiled in a child process (napi addons of several refs never share a process), a private copy of the ref's packages/*/src; the reference is built twice (same-build control). Measurement as run.ts (await, flatten unless --no-flatten), warmup, rounds rotated, GC before each run.
- Found while verifying: the build that loads first in a process can be a few percent faster or slower (2 refs + control, without flattening: HEAD +4.3/+5.1% vs a5d73ef in one process, but +0.7..+1.6% when 4 builds were loaded, with identical codegen and runtime for 6e9f8892 and HEAD). So rounds now run in passes (default one per build), each a fresh process loading the builds in a rotated order; ratios are pooled and each pass's median is printed (the first pass showed the bias: +4.8% vs +1.1/+0.6%).
- Verification, a5d73ef vs HEAD: without flattening +1.8% (quartiles +0.2..+3.7%; control -0.6%, -1.8..+0.9%), TASK-244 measured -0.5..+1.7%; flattened +7.1% (+5.9..+9.6%; control -0.1%, -1.8..+1.1%) at load 5.5-9.9, TASK-244 +8.0..+9.8%. A flattened run at load 20-33 (+7.2%) was discarded as too loaded.
- Cleanup: worktrees removed and pruned and the temp dir (cargo target included) deleted in finally (also on Ctrl-C), unless --keep; git worktree list shows only the main checkout after every run.
- Docs: new benchmarks/ssr/README.md (benchmark overview + the ab section); one line in AGENTS.md's Lumiose workspace section (Performance), allowed by Lux. AGENTS.md was already not oxfmt-clean at HEAD; left as is.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
benchmarks/ssr/scripts/ab.ts (pnpm --filter @lumiose/bench-ssr ab <ref>…) compares git refs, or the working tree, in one process: per ref a temporary worktree, its debug napi compiler and a private copy of its runtime; the reference twice as a same-build control; rotated rounds with warmup and GC; passes in fresh processes with rotated load orders, because the first-loaded build can shift by a few percent; pooled median ratios with quartiles, extremes and per-pass medians; worktrees and build output removed at the end. It reproduces TASK-244's a5d73ef vs HEAD numbers (+1.8% without flattening, +7.1% flattened). Documented in the new benchmarks/ssr/README.md, with a Performance line in AGENTS.md.
<!-- SECTION:FINAL_SUMMARY:END -->
