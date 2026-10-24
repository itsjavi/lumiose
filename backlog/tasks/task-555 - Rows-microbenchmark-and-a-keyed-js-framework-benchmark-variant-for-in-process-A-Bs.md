---
id: TASK-555
title: >-
  Rows microbenchmark and a keyed js-framework-benchmark variant for in-process
  A/Bs
status: Done
assignee:
  - Spark
created_date: '2026-10-24 08:02'
updated_date: '2026-10-24 11:01'
labels:
  - benchmark
  - performance
dependencies: []
priority: medium
ordinal: 547000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evidence for TASK-554 (and later list work). The row-shape microbenchmark from the 2026-10-24 investigation (10 rows of 8 cards; replace with new ids, the same items in new row objects, refetched copies with the same ids) becomes a script of benchmarks/js-framework-benchmark with an in-process A/B of two prebuilt page bundles (and React as an optional reference). Lumiose's js-framework-benchmark app is unkeyed, so a keyed variant (key={row.id}) is built next to it for jsfb-ab runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/rows-ab.ts builds the page bundle of the current checkout and runs an alternating in-process A/B of two bundles (optionally with React), documented in a README
- [x] #2 A keyed variant of the jsfb app builds as .krausest/frameworks/keyed/lumiose-keyed for jsfb-ab
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark. benchmarks/js-framework-benchmark:
- scripts/rows-ab.ts (`pnpm bench:rows:ab`), pages src/rows/main.tsx (Lumiose), src/rows/react.ts (React, built only with `--react <node_modules>`) and src/rows/data.ts: 10 keyed rows of 8 keyed cards (image, type icons, conditionals), row entries derived again on every change. Operations replace, rederive, refetch; two builds (and React) alternate in one Chrome page at 4x CPU slowdown with a GC before each sample; prints until-painted, script+layout and script medians, quartiles, paired differences and DOM nodes added/removed. A side is a `build` bundle (`rows-ab.ts build <out.js>`, this checkout's compiler and runtime) or a git ref (runtime only, like grid-ab).
- `lumiose-keyed`: vite --mode keyed adds `key={row.id}` to App.stsx's rows (one source; the transform throws if the row markup changes) → dist-keyed, built by `pnpm bench:jsfb --build --frameworks lumiose-keyed` for jsfb-ab runs (not in RESULTS.md).
- README.md for the package's scripts.

Results for TASK-554 (main before vs after, in-process):
- Rows A/B, 30 rounds, 4x CPU, script median: replace 12.4 → 13.8 ms (paired +1.15, until painted +1.15 ms, about 3%; React 15.1 ms); rederive 11.9 → 0.1 ms, DOM 10 rows replaced → none (React 0.6); refetch 12.4 → 1.7 ms, DOM none (React 0.6).
- jsfb-ab, 20 alternating runs of every CPU benchmark: lumiose (unkeyed) and lumiose-keyed against builds of the previous commit; every paired total median within noise (IQR across 0), e.g. keyed 01 +0.05 (IQR -0.87–1.05), 02 -0.34, 08 +0.02; unkeyed 01 +0.12, 02 -0.18, 08 -0.46.
<!-- SECTION:NOTES:END -->
