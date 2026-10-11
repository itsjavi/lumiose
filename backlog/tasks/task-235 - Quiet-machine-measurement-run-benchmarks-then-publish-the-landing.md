---
id: TASK-235
title: 'Quiet-machine measurement run (benchmarks), then publish the landing'
status: In Progress
assignee:
  - Lux
created_date: '2026-10-11 03:07'
updated_date: '2026-10-11 03:52'
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
- [ ] #1 User gave the go-ahead and the machine was quiet (load recorded in the results)
- [ ] #2 Fullstack, js-framework-benchmark and SSR results committed with versions; TASK-202, 203, 204, 205, 206, 210, 225 and 226 closed
- [ ] #3 The landing's evidence and stack table are filled from the new results with no 'measuring' cells, and the site is pushed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-11: the measurement run also covers the Astro fullstack app (TASK-242) and the SSR entries for Preact, Astro and Remix 3 (TASK-241). It closes those tasks and fills TASK-240's Server speed cells.
<!-- SECTION:NOTES:END -->
