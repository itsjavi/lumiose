---
id: TASK-20
title: Build the SSR throughput benchmark
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:26'
labels: []
milestone: m-2
dependencies:
  - TASK-14
  - TASK-16
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SSR performance claims need a reproducible suite; no reputable 2026 cross-framework SSR benchmark exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A reproducible suite renders the same pages with Lumen and at least Solid, Vue, Svelte and React
- [x] #2 Results table and notes recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. benchmarks/ssr (@lumen/bench-ssr, private; framework deps local to it): src/data.ts (1,000 deterministic rows with escaping-heavy text/attributes) and the same page per framework: Lumen .stsx, Solid .jsx, React .jsx, Vue SFCs, Svelte 5 components (Page > Row > Tags/Badge, Summary).
2. scripts/build.ts: each framework's own compiler, server target (Lumen @lumen/compiler server, babel-preset-solid ssr + hydratable variant, oxc automatic JSX for React, vue/compiler-sfc compileTemplate ssr, svelte compile generate server) → dist/<fw>/render.js.
3. scripts/run.ts: verify the HTML (rows, tags, badges, escaping, summary), warm up, count renders in fixed runs with GC between; scripts/bench.ts: fresh NODE_ENV=production processes, interleaved rounds, mean ± stdev, RESULTS.md with environment, method and notes.
4. Profile Lumen and record follow-up work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reassigned to Nova together with TASK-16.

Nova: deps (deps.lock taken/released): @babel/core ^7.29.7 (babel-preset-solid needs 7), babel-preset-solid ^1.9.16, solid-js 1.9.16 (pinned: 1.9.17 is younger than the workspace's minimum release age; pnpm had auto-added it to minimumReleaseAgeExclude, reverted), vue ^3.5.43, svelte ^5.57.2, react/react-dom ^19.3.0, @types/babel__core, vite (transformWithOxc); pnpm-lock additions only (plus oxfmt's optional svelte peer now resolved). Marko 6 not included (optional; noted in RESULTS.md).
Results (M1 Max, Node 26.8.1, load avg 10→6 from other agents, 10 × 1 s runs each): Solid 702 ± 25 r/s, Solid hydratable 575 ± 56, Svelte 521 ± 19, Lumen 338 ± 5, Vue 174 ± 10, React 141 ± 2 (1,000-row page, ~5,000 components, 525–628 kB HTML).
Profile of Lumen (node --cpu-prof scripts/run.ts lumen): ~36% escaping (server/node.ts escapeText/escapeAttr: regex test + replace with a callback), ~7% class serialization (server/attrs.ts classString split + includes dedupe), ~13% GC. Follow-up recorded as TASK-71 (assigned Nova, m-3).
Validation: benchmarks/ssr typecheck (tsc) clean, oxlint clean for benchmarks/ssr; every framework's output passes run.ts verify before measuring. Commands: pnpm --filter @lumen/bench-ssr bench (or node scripts/build.ts && node scripts/bench.ts [--rounds --runs --run-ms --warmup-ms]).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added benchmarks/ssr: the same 1,000-row, escaping-heavy page with nested components implemented in Lumen, Solid (plain and hydratable), Svelte 5, Vue 3.5 and React 19, compiled with each framework's server compiler, verified for identical content and escaping, and measured as renders/s in fresh production-mode processes (warmup, GC between runs, interleaved rounds, mean ± stdev). RESULTS.md holds the table, method and notes: Lumen renders at ~340/s, behind Solid (~700) and Svelte (~520), ahead of Vue (~174) and React (~141). The Lumen profile points at escaping and class serialization; follow-up TASK-71.
<!-- SECTION:FINAL_SUMMARY:END -->
