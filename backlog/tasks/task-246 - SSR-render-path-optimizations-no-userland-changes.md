---
id: TASK-246
title: SSR render-path optimizations (no userland changes)
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-12 14:06'
updated_date: '2026-10-12 16:48'
labels:
  - benchmark
  - performance
  - compiler
milestone: m-8
dependencies: []
priority: high
ordinal: 248000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 2026-10-12 SSR profiling (TASK-244 discussion with the user): optimizations of the compiler output and server runtime that need no userland changes and keep the rendered HTML identical. Each step is measured alone: the previous build is frozen as a bundled snapshot and old/new processes alternate over several rounds (median), nothing else running. Out of scope (user, 2026-10-12): plain getters instead of decision-28's memoized props, and compile-time component inlining.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The SSR benchmark flattens every framework's output string (what a server pays to write it), and RESULTS.md says so
- [x] #2 URL attribute safety: the compiler routes only URL attributes through the URL check, and the runtime check has an exact fast path; adversarial client/server tests cover it
- [x] #3 Text holes take an inline string fast path
- [x] #4 Direct string concatenation for server templates whose holes are known strings, or a recorded reason why not
- [x] #5 Each step's measured gain (or none) is recorded in the notes; pnpm check passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: related to TASK-244 (the regression is mostly decision-28's per-instance memo closures, ~7%, out of scope here). Standalone takeover of Photon (compiler), Nova (server runtime, benchmarks/ssr) and Spark (dom/url.ts) areas; no other agents running.

Lux 2026-10-12, method: each step bundled (esbuild) with its runtime as a snapshot; old and new rendered alternately in one process (3 s warmup each, 10 pairs of 1 s runs, gc between), 3 processes, median. Identical builds measure within ±0.2% this way; across processes the machine is bimodal (~505 vs ~545), which is why separate processes are not compared.
- #1 run.ts flattens each result (32252a6).
- #2 URL check (2c56891, 36077d1): +2.6%. Done in the shared runtime (dom/url.ts) instead of compiler routing: a length pre-check on the name (URL attributes are 3, 4, 6 or 10 chars) and exact value fast paths (no ':' / first char above space and not j, v, d). Same decisions, no contract change, the client gets it too; url.test.ts checks both against the plain regexes (exhaustive short strings + 20k mutations).
- #3 merged attribute holes, hand-edited output: -0.5..+0.1%, no gain; not implemented (user to confirm).
- #4 insertText string fast path (c7db56b): +0.6%.
- #5 literal class folding, hand-edited output: +0.6%; not implemented, as it needs compiler normalization that matches the client (parity risk) for a small gain (user to confirm).
- #6 guarded concatenation (f6eee54): upper bound of straight concatenation +12.7%; compiled design +8.0%: hoisted _cN(...holes) returns new SSRHtml(concat) when every hole is a string (list/branch: SSRHtml), else ssr(_sN, ...holes) with the same evaluated holes; lumiose/server exports SSRHtml; doc-2 §3 updated. Skipping checks on always-string attribute holes: no gain, kept uniform.
- Cumulative, base0 -> final: +12.2% (10.5..12.3).
- Full SSR run on the new method (114b08a): Lumiose 618.9, Solid 579.5 (1.07x behind), Svelte 504.7. pnpm typecheck, pnpm test (1570), cargo test --workspace and clippy pass.

Lux 2026-10-12: user decision: items 3 (merged attribute holes) and 4 (class folding) stay out, given their measured gains (none and +0.6%); their ACs are removed.

Lux 2026-10-12: cheaper decision-28 memo tried at the user's request: no gain. Plain getters -3.2%, memo state in the function scope -2.7% (in process, vs the current IIFE memo); the current form stays.

Lux 2026-10-12: fullstack server rerun after TASK-246 (results/2026-10-12T162115, all 8 apps, rebuilt with the new compiler): Lumiose req/s unchanged within noise (home 1377→1323, issue 5464→5520; other apps moved by the same few percent). Rendering is a small share of a request in the fullstack app; the gain shows in the SSR benchmark only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SSR render path +12% with no userland changes: guarded direct concatenation in compiled server templates (+8%), exact fast paths in the unsafe URL check (+2.6%), a text string fast path (+0.6%). The SSR benchmark now flattens results; Lumiose leads it (619 vs Solid 580). Merged attribute holes and class folding measured no/low gain and were left out by the user; cheaper memo variants were slower. Fullstack req/s unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
