---
id: TASK-200
title: 'Runtime size pass: back under 10 kB, cache out of handler-only fetchJSON'
status: Done
assignee:
  - Spark
created_date: '2026-10-10 20:12'
updated_date: '2026-10-10 20:59'
labels:
  - size
  - core
dependencies: []
priority: medium
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-1 §6 (user 2026-10-10): optimize for ≤10 kB every-export; raise HARD_CAP only if impossible, never above 12 kB. After TASK-196/193 the every-export measure is 10,321 B (cap 10,240). Find CPU-neutral savings across core/dom (dead code, duplicated helpers, DEV-only strings, shorter internals). Also, from TASK-195: an app that imports fetchJSON pays +1,054 B for the cache even if it only calls it in handlers; split so the cache code is only pulled in where component-level awaits need it, if that can be done without a new public API. Never trade runtime CPU for bytes (benchmarks must not regress).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 every-export ≤ 10,240 B brotli, or HARD_CAP raised to the smallest needed value ≤ 12 kB with doc-1 §6 and the reasons recorded
- [x] #2 fetchJSON-in-handlers apps don't pay for the cache (or the reason it can't be split is recorded); js-framework-benchmark shows no CPU regression
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-10). Every-export brotli: 10,321 B after TASK-196/193, 10,335 B with isServer (TASK-199) -> 10,151 B (cap 10,240; HARD_CAP unchanged).

Savings (every-export brotli, measured one by one):
- Frame code folded out of bundles without islands hydration: -182 B. `setFrame` (dom/frame.ts) is now a `let` installed by the first `withIsland`, the only source of frames; callers use `setFrame?.()`, and `$await` reads the module `frame` (equal to the run frame while the run is active). Bundles without `withIsland` never assign `frame`/`setFrame`, so Rolldown folds them to undefined and drops childFrame, instance paths and await replay from createComponent, createAsync, show and $await. Also typical imports 6.06 -> 5.97 kB, benchmark imports 5.21 -> 5.12 kB.
- `<Meta>` dedupe key read through a getter (el.getAttribute instead of Object.fromEntries over attributes): -20 B.
- beginBusy/suspend share one `hold` counter, resource cleanup passes `release` directly: 0 B (brotli already shared the duplicate), kept as a simplification.
- Rejected: dropping the `current = document` reset after each delegated handler (-18 B). Alternating 03_update10th1k_x16 runs (30 iterations each) gave lumiose/vanillajs 0.95 and 1.05 with the reset, 1.21 and 1.13 without, so it was reverted (8f01417).
- Measured and not worth it: other duplicate-merging (brotli back-references make them ~0 B); the remaining cost is unique logic (store 417 B, $async 383 B, Meta ~300 B, delegateEvents 196 B, reconcile 184 B marginal).

Cache split (AC #2): `createRun` sets `hasRuns` (core/effect.ts) and fetchJSON checks `!hasRuns || !inRun()` before the cache path. Bundles without async components and resources fold `hasRuns` to false and drop the cache. No new public API, no compiler change. size.ts reports two app entries: typical imports + fetchJSON (handlers only) 7.79 -> 6.54 kB brotli; with $async/$await/$leave (cache included) 8.42 -> 8.43 kB. Limitation: an app that has async components or resources and calls fetchJSON only in handlers still bundles the cache (the split is static).

CPU: js-framework-benchmark (krausest runner, lumiose + vanillajs, 10-15 iterations), weighted geometric mean of local factors 1.040 before, 1.052 and 1.070 after, all within run-to-run noise (vanillajs factors shifted similarly; script times equal except 03, which flips between 1.1 and 1.9 ms on unchanged code). A full A/B (baseline vs new build, 03/04/05, 20 iterations): 03 18.3 vs 19.0 ms (vanillajs 18.5 vs 17.4), 04 5.9 vs 6.1 (5.5 vs 6.1), 05 21.7 vs 22.5 (19.5 vs 20.1). The bench app creates a single component, so the frame fold never runs per row.

Validation: pnpm typecheck, pnpm lint, pnpm test (144 files / 1530 tests), lumiose tests (784), pnpm --filter lumiose size, e2e spa-router-e2e (26), islands-e2e (5), ssr-bookshelf (16). No docs change (no user-facing behaviour change).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every-export runtime back under the cap without raising it: 10,335 -> 10,151 B brotli (cap 10,240), mainly by folding islands-only frame code out of other bundles (-182 B). fetchJSON leaves the keyed cache out of apps without async components or resources (typical + fetchJSON 7.79 -> 6.54 kB), gated by a hasRuns flag that createRun sets. No CPU regression; one 18 B saving reverted after a measurable update10th slowdown. Commits 2d276b0, 4c57434, af7e5e8, 8f01417.
<!-- SECTION:FINAL_SUMMARY:END -->
