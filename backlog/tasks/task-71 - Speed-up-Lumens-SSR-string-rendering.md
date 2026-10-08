---
id: TASK-71
title: Speed up Lumen's SSR string rendering
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 16:26'
updated_date: '2026-10-08 16:51'
labels: []
milestone: m-3
dependencies: []
priority: medium
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The SSR benchmark (TASK-20, benchmarks/ssr/RESULTS.md) renders the 1,000-row page at ~340 renders/s: 2.1x slower than Solid (~700) and 1.5x slower than Svelte (~520), ahead of Vue and React. A CPU profile of the Lumen run (node --cpu-prof scripts/run.ts lumen) shows ~36% of the time in escaping (packages/lumen/src/server/node.ts escapeText/escapeAttr: regex test + replace with a callback per match), ~7% in class serialization (server/attrs.ts classString/addTokens: split(/\s+/) and includes() dedupe for every element), ~13% GC, then list/ssr/runComponent. Candidates: a char-code escaping loop that slices unchanged runs; escaping only what HTML requires (& and < in text, & and " in double-quoted attributes; Solid and Svelte do this) if client/server parity allows; a fast path or cache for plain-string classes; fewer allocations per component frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lumen renders the benchmark page at least 1.5x faster than in the TASK-20 baseline on the same machine, with the server parity and golden tests green
- [ ] #2 benchmarks/ssr/RESULTS.md regenerated with the new numbers
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Nova: 1. Profile (node --cpu-prof scripts/run.ts lumen) and fix the hot paths in my files: escaping (node.ts), class serialization (attrs.ts), list() concatenation (ssr.ts), per-component owner cost (frame.ts runComponent, a hunk separate from Spark's TASK-18 WIP in the same file). 2. Measure codegen alternatives by hand-editing dist/lumen/Page.js and file them for Photon (no compiler edits). 3. Update test expectations, run parity/golden/server tests, regenerate RESULTS.md with more rounds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-task71-20261008T162824Z):

Profile before (338 renders/s): escapeText/escapeAttr + their regexes ~44%, GC 13%, classString/addTokens ~7%, owner create/dispose ~2%.

Changes (packages/lumen/src/server):
- node.ts: escapeText/escapeAttr use indexOf scans for the next '&' and the next delimiter, slicing unchanged runs (no regex, no callback, no per-call allocation when nothing needs escaping). Decision: escape only what the HTML tokenizer acts on, like Solid/Svelte/Marko: '&' and '<' in text, '&' and '"' in double-quoted attribute values. '>' and quotes in text parse as themselves, so the DOM is unchanged; parity.test.ts compares parsed DOMs and stays green. Every escapeAttr caller writes a double-quoted value. contract/server.ts doc of escape() updated. Microbench on the bench strings: 2.5x faster escaping.
- attrs.ts: classAttr memoizes string values (Map, cleared at 512 entries) and classString has an allocation-free fast path for already-normalized class lists (ASCII tokens, single spaces, no duplicates, <= 8 tokens); anything else takes the old split/dedupe path. New unit test for the edge cases (duplicates, extra/other whitespace, NBSP/non-ASCII, many tokens, escaping).
- frame.ts runComponent: sync components run under a lazy owner (core's runWithLazyOwner, as client list rows do), materialized only when the component provides context, registers a cleanup, reads lifetime(), awaits or calls getOwner() (Head depth, Suspense, ErrorBoundary). The component and props pass through module slots, so the hot path allocates no closure. content(result) still runs inside the component's (lazy) owner. Async components keep createOwner.
- ssr.ts list(): rows concatenate directly; only from the first async row on are pieces collected and joined.

Results (same machine, heavily loaded: other agents' rustc/vite builds): 338 -> ~545-570 renders/s in quiet stretches, 543 +/- 49 over the full 4-round bench (1.61x). Solid 663 +/- 51 in the same run.

Remaining gap to Solid is in compiled component calls, measured by hand-editing dist/lumen/Page.js: static text children as getters (+9% when plain), branch closures (+3%), getter objects for non-JSX props on the server (+12% as data props); together ~695 renders/s = Solid's level. Filed TASK-78 for Photon (the eager-props part needs Lux's decision).

Test expectation updates caused by the escaping change: server/ssr.test.ts, server/render.test.ts, and packages/compiler/test/server.test.ts (Photon's file: two expectations, '&gt;' and attribute '&lt;' no longer escaped).
<!-- SECTION:NOTES:END -->
