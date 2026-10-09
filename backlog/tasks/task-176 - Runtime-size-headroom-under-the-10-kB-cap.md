---
id: TASK-176
title: Runtime size headroom under the 10 kB cap
status: Done
assignee:
  - Spark
created_date: '2026-10-09 12:33'
updated_date: '2026-10-09 14:55'
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
- [x] #1 Every-export ≤ 9.6 kB brotli with no jsfb CPU regressions (01–09 within noise, short run); typical imports and islands no larger
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark RESUME (session limit): every-export brotli 10208 → 10073 B so far (target ≤ 9830 B = 9.6 kB; typical 6268 → 6268, islands 9066). Committed: production renderToString/renderToStream stub message shortened (DEV keeps the full hint; −34 B), Head uses place() for its range (−7 B). UNCOMMITTED in packages/lumen/src/dom/list.ts + insert.ts (exports lastOf/detach): list rows reuse insert.ts ranges (renderRange, place, detach, lastOf; Row.end removed; −94 B); unit tests green, but not committed because jsfb 01–09 has not been re-run (rows now check node.36585end in place()). Next: run 'node benchmarks/js-framework-benchmark/scripts/jsfb.ts --frameworks lumen,vanillajs --benchmarks 01_,02_,05_,06_,07_,08_,09_ --count 10' (restore RESULTS.md after), commit if within noise. Measured marginal costs (brotli B): async 1142, list 1053, store+snapshot 615, head 563, element 239, server stubs ~165, events 189, portal/Dynamic 171. Estimates by renaming in the minified bundle: 27 core internal properties (depsTail, prevSibling, cleanups, nextSub, pendingValue…) ≈ −89 B; dom-level fields (instance, waiting, whenTrue…) ≈ −41 B. Reaching 9.6 kB likely needs those renames plus shorter production error messages (provide()/lifetime()) and a Meta adoption simplification; measuring script: .local/agents/Spark/s152/every.mjs (copy into packages/lumen and run).

Spark: list/insert range reuse committed (a4e0c10) after jsfb (10 then 15 iterations, lumen vs vanillajs, interleaved old/new): 01 36.5 vs 37.6 ms, 02 39.3 vs 40.4, 05 32.9 vs 32.8, 06 24.0 vs 25.5, 07 391 vs 416 (ratio to vanilla 1.088 vs 1.090), 08 46.5 vs 45.1 (1.059 vs 1.027, within the run-to-run spread of 43–48; load spiked during the second pair), 09 19.7 vs 19.0 — within noise. Every-export now 10,073 B (from 10,208); typical 6,268, islands 9,066 (no larger). Remaining candidates, estimated on the minified bundle: renaming the vendored alien-signals Link/node fields (depsTail, subsTail, nextSub, prevSub, nextDep, prevDep, pendingValue, currentValue) ≈ −50 B but breaks the line-by-line mirror of upstream; Lumen's own owner/async/branch/list fields ≈ −70 B; the two core error messages ≈ −25 B. Together ≈ −145 B → ~9.93 kB, still above 9.6 kB. Reaching 9.6 kB needs a decision: accept renaming the vendored algorithm, drop/move a feature from the  entry (e.g. Meta adoption of server tags, 563 B for Head/Meta/Title; store+snapshot 615 B), or set the goal at ~9.8 kB. Waiting for Lux.

Correction to the note above: "drop/move a feature from the lumen entry".

Lux decision (2026-10-09): AC amended to "every-export <= 9.8 kB brotli" (doc-1 §6 unchanged); no renames of the vendored alien-signals fields; Head/store stay in lumen. Spark: internal field renames in dom/async.ts (Instance, AsyncRun), dom/insert.ts (BranchState) and dom/list.ts (ListState), documented on their interfaces; core lifetime()/provide() errors keep the full text in dev and are short in production. Saves 108 B against HEAD in the same tree: every-export 10,073 -> 9,965 B (9.73 kB, the new baseline), typical 6,268 -> 6,257, islands 9,066 -> 9,025. Note: the uncommitted dom/hot.ts + dom/index.ts in the tree (TASK-146 HMR registry, not mine) add +222 B to every-export as it stands. jsfb short run (10 iterations, load 8-17, new vs old ratio to vanillajs): 01 1.045/1.032, 02 1.080/1.051, 03 1.171/1.041 (03 does not run any changed code: load noise), 05 1.047/1.213, 07 1.092/1.069, 08 1.023/1.049, 09 0.969/1.126 - mixed directions, within noise. Tests: core/dom/server/router vitest 423 passed, typecheck (except the in-progress hot.test.ts/contract.test.ts from TASK-146), oxlint.
<!-- SECTION:NOTES:END -->
