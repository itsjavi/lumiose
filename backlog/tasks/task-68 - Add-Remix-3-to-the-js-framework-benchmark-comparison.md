---
id: TASK-68
title: Add Remix 3 to the js-framework-benchmark comparison
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 16:26'
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
<!-- SECTION:NOTES:END -->
