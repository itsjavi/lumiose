---
id: TASK-235
title: 'Quiet-machine measurement run (benchmarks), then publish the landing'
status: Done
assignee:
  - Lux
created_date: '2026-10-11 03:07'
updated_date: '2026-10-12 14:42'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: high
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pending (user, 2026-10-11): the machine is busy, so no benchmarks or evals run until the user says so. When they do, with nothing else heavy running (1-minute load under 3), Lux runs: (1) the fullstack comparison, all 7 apps (pnpm --filter @bench/harness bench, 60–90 min), which completes TASK-202, 203, 204 and 205 AC #3 and TASK-210's rerun, and records TASK-230's runtime-deps metric; (2) js-framework-benchmark (pnpm bench:jsfb --count 10 --mem-count 3, 1.5–2.5 h), which completes TASK-206 and 225; (3) the SSR benchmark (pnpm --filter <ssr package> bench), which completes TASK-226. Before running, re-check that every framework is on its latest stable version (decision-41). Then commit the results, update apps/web/src/content/evidence.ts and the landing table (new columns and rows, no 'measuring' cells left), and push, which deploys the landing (TASK-213). Evals (TASK-207, 208, 209) stay on hold separately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User gave the go-ahead and the machine was quiet (load recorded in the results)
- [x] #2 Fullstack, js-framework-benchmark and SSR results committed with versions; TASK-202, 203, 204, 205, 206, 210, 225 and 226 closed
- [x] #3 The landing's evidence and stack table are filled from the new results with no 'measuring' cells, and the site is pushed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-11: the measurement run also covers the Astro fullstack app (TASK-242) and the SSR entries for Preact, Astro and Remix 3 (TASK-241). It closes those tasks and fills TASK-240's Server speed cells.

Lux 2026-10-12: user gave the go-ahead. Versions re-checked on npm: all current (decision-41), no upgrades. Installed Playwright 1.63's Chromium (missing). Runs, sequential, 1-min load logged every minute (1.3-3.0 during runs; brief 3.5-4.0 spikes):
- Fullstack, all 8 apps pass conformance: results/2026-10-12T114559-macbookpro.json (fd2723b), 33 min, no busy server rounds. Consistent with the 10-09 reference (Lumiose /issue 5,464 vs 5,652 req/s).
- js-framework-benchmark --count 10 --mem-count 3 (ef81f5b), ~1 h: Lumiose weighted 1.082, projected 1.132 (hand 1.09), faster in absolute times than 10-09 but vanilla improved more on the quiet machine -> TASK-245.
- SSR (ef81f5b): Lumiose 560 renders/s, Solid 747, Svelte 570 -> regression TASK-244.
- Landing: stack table fully filled from the results; the 'measuring' footnote now shows only while a cell is measuring; content test asserts no measuring cells. Screenshot: backlog/assets/task-235-stack-table.jpg.
Closed TASK-202..206, 210, 225, 226, 241, 242. Remaining: push (deploys the landing), waiting for the user.

Lux 2026-10-12: the user pushed fd2723b..d3db9c9, which deployed the landing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Quiet-machine run of all benchmarks on 2026-10-12 (fullstack 8 apps, js-framework-benchmark, SSR) committed with versions and load; the landing's stack table has no 'measuring' cells. Follow-ups: TASK-244, TASK-245, TASK-246.
<!-- SECTION:FINAL_SUMMARY:END -->
