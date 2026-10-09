---
id: TASK-176
title: Runtime size headroom under the 10 kB cap
status: In Progress
assignee:
  - Spark
created_date: '2026-10-09 12:33'
updated_date: '2026-10-09 12:37'
labels:
  - size
  - perf
milestone: m-7
dependencies: []
priority: low
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-168 the every-export runtime is 9.97 kB brotli against the 10 kB hard cap (doc-1 §6), so the next runtime feature needs a trim first. Regain headroom without CPU regressions: dead/duplicated helpers, dev-only code reaching production builds, shorter internal names that survive minification, shared paths between list/branch/insert.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every-export ≤ 9.6 kB brotli with no jsfb CPU regressions (01–09 within noise, short run); typical imports and islands no larger
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark RESUME (session limit): every-export brotli 10208 → 10073 B so far (target ≤ 9830 B = 9.6 kB; typical 6268 → 6268, islands 9066). Committed: production renderToString/renderToStream stub message shortened (DEV keeps the full hint; −34 B), Head uses place() for its range (−7 B). UNCOMMITTED in packages/lumen/src/dom/list.ts + insert.ts (exports lastOf/detach): list rows reuse insert.ts ranges (renderRange, place, detach, lastOf; Row.end removed; −94 B); unit tests green, but not committed because jsfb 01–09 has not been re-run (rows now check node.36585end in place()). Next: run 'node benchmarks/js-framework-benchmark/scripts/jsfb.ts --frameworks lumen,vanillajs --benchmarks 01_,02_,05_,06_,07_,08_,09_ --count 10' (restore RESULTS.md after), commit if within noise. Measured marginal costs (brotli B): async 1142, list 1053, store+snapshot 615, head 563, element 239, server stubs ~165, events 189, portal/Dynamic 171. Estimates by renaming in the minified bundle: 27 core internal properties (depsTail, prevSibling, cleanups, nextSub, pendingValue…) ≈ −89 B; dom-level fields (instance, waiting, whenTrue…) ≈ −41 B. Reaching 9.6 kB likely needs those renames plus shorter production error messages (provide()/lifetime()) and a Meta adoption simplification; measuring script: .local/agents/Spark/s152/every.mjs (copy into packages/lumen and run).
<!-- SECTION:NOTES:END -->
