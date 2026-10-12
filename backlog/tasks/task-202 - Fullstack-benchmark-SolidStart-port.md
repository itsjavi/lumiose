---
id: TASK-202
title: 'Fullstack benchmark: SolidStart port'
status: Done
assignee:
  - Quasar
created_date: '2026-10-10 22:40'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the landing's stack comparison table needs measured cells (JS on a server page, payload, time to interactive, server throughput) for SolidStart. Port the issue tracker of doc-4 to SolidStart in benchmarks/fullstack/apps/solid-start, following the React Router and Next.js apps: same routes, data, CSS and behaviour, idiomatic for the framework, measured by the same harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 benchmarks/fullstack/apps/solid-start implements the doc-4 app idiomatically and passes the conformance checks
- [x] #2 The harness runs it in every group and the results viewer shows it
- [x] #3 A committed results run includes it, and doc-4 lists it with versions and caveats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar (2026-10-11): SolidStart 2.0.6 port in benchmarks/fullstack/apps/solid-start (port 4104), Solid 1.9.17, Nitro 3 beta node-server; details, versions and caveats in doc-4 §8.
- Conformance: 15/15 pass (`pnpm --filter @bench/harness conformance --only solid-start`). Typecheck (tsc 7) and oxlint clean.
- Registered in harness/src/apps.ts (+ versions in bench.ts; resolvedVersion now finds packages whose exports hide package.json) and the viewer (series-4).
- Quick harness pass (`bench --quick --only solid-start`, busy machine): all groups ran, 92 metrics; the results file was deleted, not committed.
- Remaining: AC #3, the full run on a quiet machine (Lux schedules it).

Lux 2026-10-12: included in the quiet-machine fullstack run results/2026-10-12T114559-macbookpro.json (fd2723b); all 8 apps passed conformance. doc-4 §8 lists versions and caveats.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SolidStart port measured in the 2026-10-12 quiet-machine run (TASK-235): home 1,026 req/s, issue page 33 kB JS (brotli), 0 runtime deps.
<!-- SECTION:FINAL_SUMMARY:END -->
