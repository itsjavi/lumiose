---
id: TASK-319
title: 'Large-app benchmark: build time, dev cold start, HMR latency and server memory'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:27'
labels:
  - performance
  - benchmark
milestone: m-11
dependencies: []
priority: medium
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: a generator for a synthetic app of about 1,500 routes across rendering modes and about 5,000 components with islands, and a benchmark that measures production build time, dev server cold start, HMR latency after an edit and server memory under load. It compares two builds of Lumiose alternated in one run on one machine (AGENTS.md, Performance).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The generator creates the synthetic app deterministically
- [x] #2 The benchmark measures the four metrics as an A/B of two Lumiose builds in one run
- [x] #3 Results are recorded with the machine and versions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 4).

Nova (2026-10-15), batch 4, implementation (new package benchmarks/large-app, @lumiose/bench-large-app; lockfile +2 lines under deps.lock):
- scripts/generate.ts: seeded (mulberry32) generator, byte-identical output: 5,000 components in four levels (each imports 2-3 of the next level; 417 islands with client:visible/idle; a style block each) and 1,500 routes: /docs 825 static pages (a fifth with a param and staticPaths, about 1,150 prerendered files), /app 375 server pages, /spa 225 spa pages, /api 74 endpoints (half static), a layout per section. `node --test` test (scripts/generate.test.ts, `pnpm --filter @lumiose/bench-large-app test`) checks determinism.
- scripts/runner.ts: one measurement per process (build, dev, serve), with the build the app copy links.
- scripts/ab.ts: `pnpm --filter @lumiose/bench-large-app ab [options] <a> <b>`; each of a and b is a git ref (temporary worktree + pnpm install + pnpm build:compiler, removed afterwards), `.` (this working tree) or a prepared checkout directory. Rounds rotate the order; metrics buildMs, devColdStartMs (Vite cache and .lumiose removed), hmrMs (server component and island edits, until the page serves the change after the HMR message), serverMemoryMb (peak RSS of adapter-node under 2,000 requests at 16). `--json` prints medians, ratios b/a, samples, machine and builds (for TASK-320; progress on stderr).
- Results: RESULTS.md and results/2026-10-15-v0.4.0-vs-m10.json: v0.4.0 vs main of today on an M1 Max under load (4-17): build 55.1 s vs 55.1 s (0.999), dev cold start 926 vs 935 ms (1.010), HMR 87.5 vs 84.9 ms (0.970), server memory 521 vs 524 MB (1.006). A run takes about 18 minutes with one ref to prepare.
- For Photon (TASK-320): run `ab <last tag> . --json` and gate on `metrics.*.ratio > 1.2`; the first measurement of a run can be slow (cold caches), which the median of 3 rounds absorbs.
- For Lux: benchmarks/large-app is not yet in the AGENTS.md ownership table.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
benchmarks/large-app generates a deterministic 1,500-route, 5,000-component app and measures build time, dev cold start, HMR latency and server memory as an A/B of two Lumiose builds (refs, the working tree or prepared checkouts) in one run, with JSON output for the release gate; the first recorded run (v0.4.0 vs today) shows no regression.
<!-- SECTION:FINAL_SUMMARY:END -->
