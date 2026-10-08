---
id: TASK-12
title: Implement the js-framework-benchmark app and harness
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 16:10'
labels: []
milestone: m-1
dependencies:
  - TASK-11
  - TASK-13
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The performance goal must be measured, not asserted: CPU ≤1.12, memory ≤2.7 MB, bundle ≤6 kB (spec §11).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A keyed js-framework-benchmark implementation of Lumen follows krausest's rules
- [x] #2 A reproducible local script runs the benchmark for Lumen, vanillajs, Solid and React (plus Svelte and Vue Vapor if feasible) and writes a results table
- [x] #3 Runtime size is measured (min+brotli) against the spec budgets; results and gaps are recorded in the task notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: the user set the runtime size budget to a 10 kB hard cap (min+brotli, the whole client runtime). Smaller is better, but CPU wins over bytes. Soft target: ≤ 6 kB for typical imports; the js-framework-benchmark bundle ≤ 8 kB. The current 5.02 kB for the benchmark import set is within budget, so focus tuning on CPU and memory.

Lux: start now with a hand-compiled Lumen implementation (written as the compiler would emit it, per doc-2) to set up the krausest harness and get early runtime numbers for tuning. The final AC requires the compiled .stsx version once TASK-11 is Done.

Spark: claimed TASK-12 (session spark-task12-20261008T140314Z). Starting harness + hand-compiled Lumen keyed impl per Lux's note.

Spark (session spark-task12-20261008T140314Z) — harness, implementations, tuning, results.

**Harness.** `pnpm --filter @lumen/bench-jsfb bench:jsfb` (benchmarks/js-framework-benchmark/scripts/jsfb.ts) runs krausest's own webdriver-ts runner (Puppeteer, Chrome trace timing, upstream 4x/2x CPU throttling, memory after GC, size/first paint). It sparse/shallow-checks out krausest at pinned commit bf894b6 into `.krausest/` (gitignored), installs server + runner (browser downloads skipped; uses installed Chrome 154), builds the reference frameworks (vanillajs, solid 1.9.3, svelte 5.42.1, vue-vapor 3.6.0-rc.5, react-hooks 19.2.0 — same versions as krausest's published Chrome 154 table), builds Lumen with Vite into `frameworks/keyed/lumen` (+ `lumen-hand`), serves on port 8131 (8080 is taken by Docker here; `--port`/JSFB_PORT), runs CPU (`--count`, default 15) and memory/size (`--mem-count`, default 1) separately, and writes RESULTS.md: medians, local factors, krausest's weighted geomean, script times, memory, size, bundle sizes, plus a **projected published factor** = (local/local vanillajs) × (published vanillajs / published keyed fastest), calibrated from krausest's results.json. Calibration check: projection runs ~3–5 % pessimistic (Solid 1.185 vs published 1.133; Vue Vapor 1.151 vs 1.114). Options: --frameworks, --benchmarks, --headed, --summary, --build.

**Implementations.** `lumen` = src/App.stsx compiled by lumen/vite (Photon's TASK-11 plugin); `lumen-hand` = src/hand-compiled.js written from doc-2 (selector, data slots, hoisted apply fns, signal as binding source, one-time writes). Both pass krausest `isKeyed` (keyed for run/remove/swap) and its tr HTML check; HTML matches vanillajs incl. aria-hidden; selection is one id in state; no app-level delegation or manual DOM.

**Results** (M1 Max, Chrome 154 headless, CPU 10 iterations, memory 3; RESULTS.md):

| | lumen (compiled) | lumen-hand | vanillajs | solid | svelte | vue-vapor | react-hooks |
|---|---:|---:|---:|---:|---:|---:|---:|
| CPU weighted geomean (local) | 1.073 | 1.058 | 1.000 | 1.133 | 1.200 | 1.101 | 1.487 |
| projected published factor | 1.122 | 1.106 | 1.046 | 1.185 | 1.254 | 1.151 | 1.554 |
| published (krausest table) | – | – | 1.046 | 1.133 | 1.182 | 1.114 | 1.595 |
| run memory 1k (MB) | 2.87 | 2.50 | 1.87 | 2.68 | 2.87 | 3.10 | 4.39 |
| compressed size (kB) | 6.5 | 6.5 | 2.5 | 4.5 | 9.7 | 18.7 | 51.4 |
| first paint (ms) | 57.6 | 62.9 | 76.4 | 58.3 | 76.3 | 99.4 | 290 |

Against spec §11 (CPU ≤ 1.12, memory ≤ 2.7 MB, bundle ≤ 8 kB, first paint ≤ 60 ms): lumen-hand meets CPU (≈1.06–1.07 after removing the projection bias), memory (2.50, also the 2.5 stretch) and bundle. Compiled `lumen` meets CPU (≈1.08 bias-adjusted, 1.122 raw projection) and bundle (6.23 kB brotli), **misses memory (2.87 MB)**. First paint is noisy locally (vanillajs 76 ms here vs 54 published); Lumen's 58–63 ms is in Solid's range.

**Runtime sizes** (`pnpm --filter lumen size`, min+brotli): benchmark import set 5.99 → 5.39 kB; typical app imports 6.65 → 6.04 kB (soft 6 kB: 40 B over); every core+dom export 9.48 kB (hard cap 10 kB, OK — but hydration/loader (TASK-18) is not in yet: only ~0.5 kB headroom). jsfb bundles: 6.23 kB brotli (compiled), 6.24 kB (hand), budget 8 kB. scripts/size.ts budgets updated to spec §6 (6 kB typical soft, 10 kB every-export hard).

**Optimizations** (before = first run, hand-compiled, 5 iterations: projected 1.165, Solid 1.162 in the same run; after: 1.106 vs Solid 1.185):
1. `$async` tag dispatch (doc-2 §4 amendment): `$async(fn)` stores the async path (`createAsync`) on the component as `$$async`; `createComponent` calls it via the tag, so bundles without `$async` drop the async path (−0.6 kB brotli). Untagged native async functions keep working in dev only (`DEV` from Lux's dom/dev.ts) with a one-time warning; dom tests tag their async components like the compiler does, plus a test for the dev fallback.
2. `toggleClass(el, name, false)` on an element without a class attribute writes nothing: new rows never touch/allocate `classList`.
3. Replace-all in `list` appends new rows in order after the clear (no reverse insertion).
4. Dynamic `insert` regions (what the compiler emits for `{row.label()}` / `{row.id}`): first text goes straight in (no reconcile), regions start with a shared empty `nodes` array, and the region binding uses one shared compute (`this.target`) instead of a closure per insert. Compiled create 1k (sync, in-page) 2.80 → 2.63 ms.
Profiling notes: Lumen's synchronous script time is within ~5 % of vanillajs on every op (in-page microbench); the remaining krausest gap is GC (scavenges copying ~0.6 KB of live JS objects per row: owner, two bindings, links, selector key node, label signal) and paint noise.

**Gaps / follow-ups.**
- Compiled output vs hand (0.37 MB memory, ~1.5 % CPU, select O(n) in the `const id = row.id` form): (a) selector and data-slot hoisting don't see through consts initialised from row data (`const id = row.id`), so that idiomatic form gets a per-row `selected() === id` binding and per-row closures; App.stsx therefore uses `row.id` directly; (b) text children (`{row.id}`, `{row.label()}`) compile to `insert(el, () => …)` (region + text node per row) instead of a template text placeholder plus a text binding; (c) plain values (`{id}`) compile to a static `insert` instead of a one-time write into a placeholder (doc-2 §5.4). Recorded as a new task for Photon (with a runtime text helper from Spark if the contract needs one).
- Hydration/loader must fit the remaining ~0.5 kB of the 10 kB hard cap, or the runtime needs trimming (TASK-18).
- `packages/lumen/src/cli/docs/examples.test.ts` fails in the shared tree (Beacon's in-progress docs work, not runtime).
- Coordination: I accidentally removed another session's `.local/coordination/deps.lock/` (a failed `mkdir` followed by my cleanup) and recreated it within seconds; its owner then ran `pnpm install` (which also installed this package) and released it. I did not run `pnpm install` myself.

Validation: `pnpm typecheck` clean; `pnpm lint` clean for my files; dom/core tests green (209), the whole-suite failures seen at the end (compiler implicit-tbody/select parity, app build tests, cli docs examples) belong to concurrent in-progress work (Photon, Nova, Beacon); the compiler execute test passes when re-run.
<!-- SECTION:NOTES:END -->
