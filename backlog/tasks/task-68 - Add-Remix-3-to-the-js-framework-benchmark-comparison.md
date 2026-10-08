---
id: TASK-68
title: Add Remix 3 to the js-framework-benchmark comparison
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 16:53'
labels: []
milestone: m-1
dependencies:
  - TASK-12
priority: medium
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants the benchmark table to include Remix 3 (remix-run), a new framework too. remix@3.0.0 (stable, published after the 3.0.0-rc.5 RC) ships remix/component 1.0, a setup/render virtual-DOM component model. krausest has no Remix 3 implementation yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A keyed js-framework-benchmark implementation for remix/component 1.0 (remix@3.0.0) following krausest's rules and Remix's idioms (handle.update(), on() mixins), passing isKeyed and the HTML checks
- [ ] #2 pnpm bench:jsfb includes it next to lumen, vanilla, solid, svelte, vue-vapor and react; RESULTS.md updated with CPU, memory and size
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read remix@3.0.0 (remix/component 1.0) docs/README and types from the installed package: createRoot, handle.update(), on() mixins, keys.
2. Write a self-contained krausest-layout implementation in benchmarks/js-framework-benchmark/frameworks/keyed/remix-v3 (package.json with build-prod, package-lock, index.html, src/main.jsx), idiomatic per Remix guides; production build with Vite/Rolldown (Remix's recommended bundler setup if it documents one).
3. Wire it into scripts/jsfb.ts: copy the source into .krausest/frameworks/keyed/remix-v3, npm ci + build-prod like the reference frameworks.
4. Verify isKeyed + HTML checks (runner's isKeyed), then run the full suite (10 CPU / 3 memory) for lumen, lumen-hand, vanillajs, solid, svelte, vue-vapor, react-hooks, remix-v3; update RESULTS.md.
5. Record results, implementation notes and evidence in this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: claimed TASK-68 (session spark-task68-20261008T162132Z, benchmark-only; not touching packages/lumen/**).

Spark: implementation in benchmarks/js-framework-benchmark/frameworks/keyed/remix-v3 (krausest layout: package.json with build-prod, package-lock.json, index.html, src/main.jsx), remix@3.0.0 + esbuild 0.28.2 pinned. Modeled on the Remix team's own benchmark app (remix-run/remix packages/component/bench/frameworks/remix/index.tsx, same app incl. per-row on('click') mixins and inline keyed rows in one App render) with krausest's data generation and HTML. Bundled with esbuild --bundle --minify --format=esm --jsx-import-source=remix/component, as that Remix bench does (Remix's own remix/assets serves unbundled modules compiled on demand, so it cannot produce krausest's static dist/). scripts/jsfb.ts: new LOCAL list, installLocal() copies the sources into .krausest/frameworks/keyed/<name>, npm ci when the lockfile changed, build-prod on every run; RESULTS.md notes and bundle sizes for local frameworks. Evidence: krausest isKeyed: 'remix-v3-v3.0.0-keyed is keyed for run, remove row and swap rows', no HTML-structure error; scripted check of every op (run, update every 10th, select, swap 1↔998, remove, append, runlots, clear) correct, row outerHTML identical to vanillajs/react-hooks, no class attribute on unselected rows. Bundle: 88.3 kB min — createRoot always builds a frame runtime (frame.js 20 kB, navigation, import-map manager), not tree-shakable from the app.

Spark — RESUME (checkpoint at 2026-10-08 18:56, run stopped on Lux's request; no processes left running, port 8131 free).
Status: remix-v3 implementation done and verified — krausest isKeyed: keyed for run, remove and swap rows, no HTML-structure error; every op checked in a scripted Chrome run. Harness wiring done (scripts/jsfb.ts LOCAL + installLocal; typecheck, oxlint and oxfmt clean). Remaining: full benchmark run, then RESULTS.md, AC #2 evidence, final summary, Done.
Partial run (CPU 01–05 only, 10 iterations, 1-min load ~6–7 from other sessions; median total ms / script ms):
| op | lumen | lumen-hand | vanillajs | solid | svelte | vue-vapor | react-hooks | remix-v3 |
| create 1k | 32.8/3.2 | 32.7/3.0 | 31.2/2.5 | 33.0/3.8 | 33.5/4.5 | 34.4/4.3 | 40.6/10.1 | 41.7/11.9 |
| replace | 36.4/6.2 | 37.3/5.9 | 34.2/5.1 | 38.5/7.7 | 41.5/9.1 | 41.0/7.7 | 49.5/17.9 | 46.5/15.1 |
| partial update | 30.6/1.8 | 27.1/1.6 | 24.6/1.0 | 27.0/2.3 | 29.2/2.8 | 26.8/1.9 | 35.0/8.6 | 48.6/22.6 |
| select | 9.8/0.7 | 8.9/0.9 | 8.6/0.7 | 9.9/1.6 | 13.4/4.5 | 10.4/0.9 | 14.4/5.2 | 37.4/27.9 |
| swap | 29.9/1.2 | 29.6/1.1 | 25.9/0.6 | 29.9/2.5 | 30.2/3.0 | 29.3/2.2 | 171.1/33.8 | 49.5/21.7 |
RESULTS.md is unchanged (still the TASK-12 table). Note: the interrupted run already deleted the old 06–09, memory and size result JSONs in .krausest/webdriver-ts/results, so do not run --summary alone; rerun everything.
Rerun (wait for a quiet machine, ~35 min): cd benchmarks/js-framework-benchmark && node scripts/jsfb.ts --count 10 --mem-count 3   (equivalently pnpm --filter @lumen/bench-jsfb bench:jsfb -- --count 10 --mem-count 3; default frameworks now include remix-v3; it rebuilds remix-v3 and lumen and starts its own server on 8131).
<!-- SECTION:NOTES:END -->
