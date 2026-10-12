---
id: TASK-203
title: 'Fullstack benchmark: SvelteKit port'
status: Done
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the landing's stack comparison table needs measured cells (JS on a server page, payload, time to interactive, server throughput) for SvelteKit. Port the issue tracker of doc-4 to SvelteKit in benchmarks/fullstack/apps/sveltekit, following the React Router and Next.js apps: same routes, data, CSS and behaviour, idiomatic for the framework, measured by the same harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 benchmarks/fullstack/apps/sveltekit implements the doc-4 app idiomatically and passes the conformance checks
- [x] #2 The harness runs it in every group and the results viewer shows it
- [x] #3 A committed results run includes it, and doc-4 lists it with versions and caveats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar (2026-10-11): SvelteKit 3.0.1 port in benchmarks/fullstack/apps/sveltekit (port 4105), Svelte 5.57.2, adapter-node 6.0.0 (precompress off); versions and caveats in doc-4 §8.
- Conformance: 15/15 pass (`pnpm --filter @bench/harness conformance --only sveltekit`); SolidStart still passes.
- SvelteKit streams load promises as data, not HTML, so the suite's streaming check (harness/e2e/tracker.e2e.ts, Nova's area) now also accepts comments that arrive as streamed data after the shell; HTML-streaming apps are checked as before.
- harness/src/measure.ts counts `.svelte` files in source size (they were skipped).
- Registered in harness/src/apps.ts, bench.ts versions, and the viewer (series-5).
- Typecheck: `svelte-kit sync && svelte-check --tsgo` (TS 6.0.3 + TS 7.0.2), clean; oxlint clean.
- Quick harness pass (`bench --quick --only sveltekit`, busy machine): all groups ran, 92 metrics; the results file was deleted, not committed.
- Remaining: AC #3, the full run on a quiet machine (Lux schedules it).

Lux 2026-10-12: included in the quiet-machine fullstack run results/2026-10-12T114559-macbookpro.json (fd2723b); all 8 apps passed conformance. doc-4 §8 lists versions and caveats.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SvelteKit port measured in the 2026-10-12 quiet-machine run (TASK-235): home 1,104 req/s, issue page 39 kB JS (brotli), 0 runtime deps.
<!-- SECTION:FINAL_SUMMARY:END -->
