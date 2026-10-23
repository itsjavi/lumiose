---
id: TASK-522
title: Keyed lists insert a new row's content into the live document node by node
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-23 08:17'
updated_date: '2026-10-23 09:11'
labels:
  - performance
  - dom
milestone: m-13
dependencies: []
priority: medium
ordinal: 516000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). The port's island renders a virtual grid: rows (keyed) of 8 cards (keyed), each card with a conditional and two small child components. Clearing a search replaces about 10 rows (80 cards). A MutationObserver on the grid sees 230 node insertions and 223 removals in the live document; the React original sees 11 and 11 (it builds each row detached and inserts it once). With the CPU slowed 4x, clearing the search until the results paint takes 539 ms in Lumiose against 284 ms (a 125 ms debounce included in both, medians of 7), and toggling a filter that changes the list 251 against 185 ms. The CPU profile of the Lumiose run is dominated by insertBefore and style work.

Expected: a new row is complete, its nested lists, conditionals and component fragments included, before it is inserted, and removing a row detaches its root once.

Related: attach runs while rows are created, between DOM writes, so a getBoundingClientRect in it forced one layout per row (63 ms for 10 rows at full CPU speed) until the port moved the measuring to a ResizeObserver. The docs do not say when attach runs relative to insertion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replacing every row of a keyed list whose rows hold nested dynamic content inserts each row with one DOM operation and removes it with one, with a test that counts the mutations
- [x] #2 An in-process A/B of a nested 10x8 list replaced at 4x CPU shows the change against the current runtime
- [x] #3 The JSX docs say when attach runs relative to the element's insertion
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: claimed for the 0.5.1 batch, on a worktree branch.

Spark (2026-10-23): findings. Rows with a root element were already built off-document and inserted once: the nested lists, branches and component fragments of a row render into the detached row (render effects run synchronously). Only rows without a root (a fragment row, a component returning several nodes or a conditional) went in node by node: place() walked the range. Change: place() inserts a range that sits alone in a fragment of its own (new, built off-document, or detached) with that fragment, one insertBefore (packages/lumiose/src/dom/insert.ts). Element rows, hydration (claimed rows are in place, ranges claimed under hydration live in the document) and moves (ranges in the document) keep their paths. A multi-node row still leaves node by node: no DOM call removes several siblings at once (Range.extractContents and deleteContents remove per node), and a scratch Chrome measurement of 10 such rows (100 nodes) at 4x CPU gave the same 1.0-1.1 ms for per-node moves into a fragment, removeChild, a Range per row and one Range for all. attach timing (verified in happy-dom): attachments are user effects, so they run after the update has inserted every new row, with the element connected; inside a pending Suspense they run while the content waits in a fragment and do not re-run on reveal; a signal written by one attachment re-renders before the next one runs, which is what forced one layout per row in the port (TASK-527 proposes batching). In-process A/B: benchmarks/js-framework-benchmark/scripts/grid-ab.ts (bench:grid:ab), two runtime builds in one headless Chrome page, alternating, GC before each sample, 4x CPU, replacing 10 keyed rows of 8 keyed cards (conditional, two child components, click handler) between two spacers, 40 rounds. Fragment rows, HEAD vs this change: until painted 23.85 vs 23.90 ms (paired median +0.15), script with forced style and layout 16.50 vs 16.45 ms (-0.25), script 4.70 vs 4.70 ms (-0.10); mutation records of one replace 200 -> 110 (100 nodes in, 100 out). Element rows (control): 23.25 vs 23.30, 15.75 vs 16.00, 4.30 vs 4.00 ms; 20 records both. No measurable change either way, also with :nth-child and :has() rules in the page. js-framework-benchmark, krausest's local runner (jsfb-ab, temporary variant dirs, removed afterwards; RESULTS.md untouched), 15 alternating runs, HEAD vs change, total ms: 01_run1k 33.34 vs 33.41, 02_replace1k 37.88 vs 37.62, 07_create10k 369.2 vs 373.9 (IQR of the paired difference -11 to +13), 09_clear1k_x8 18.52 vs 18.27: no change (jsfb rows are elements). Runtime size (pnpm --filter lumiose size): +20 to +30 B brotli on the typical and islands entries (9.27 -> 9.29 kB islands page), +60 B on the whole runtime (13.62 -> 13.68 kB), under the hard caps.

Spark: validation. pnpm typecheck, pnpm lint (no new warnings), dom/hydration/router tests (327), pnpm test (2344 passed; 4 vite build tests timed out at 5 s under the full run's load and pass alone, 34/34), node --test scripts (49), pnpm --filter lumiose size (caps OK), cargo test --workspace, docs:gen and docs:check. AC #1: rows with a root are inserted and removed once (they already were; now locked by a test); a row without a root goes in with one insertion and still leaves node by node (see above). Size, exact: islands page 9.27 -> 9.29 kB brotli, whole runtime 13.62 -> 13.68 kB, typical imports 6.15 kB (soft target 6.25 kB).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A keyed list's new row is complete before it enters the document and goes in with one insertion. Rows with a root element already worked that way; rows without one (fragment rows, components returning several nodes or a conditional) were placed node by node, and now place() inserts a range that is alone in its own fragment with that fragment (packages/lumiose/src/dom/insert.ts). Tests in list.test.ts count the insertions and check that nothing is written inside a row once it is in the document, and that a row's attachments run once every new row is connected. The JSX docs now say when attach runs: after the update inserted the element, except inside a pending Suspense, and that a signal written by one attachment re-renders before the next. New in-process A/B, bench:grid:ab (benchmarks/js-framework-benchmark/scripts/grid-ab.ts): two runtime builds in one Chrome page, 10x8 keyed cards replaced at 4x CPU, 40 alternating rounds. Fragment rows, before vs after: until painted 23.85 vs 23.90 ms, script with forced style and layout 16.50 vs 16.45 ms, script 4.70 vs 4.70 ms; mutation records 200 -> 110. Element rows unchanged (23.25 vs 23.30 ms). krausest's local runner, 01/02/07/09: no change. The node-by-node insertion was not the port's cost; the likely cause is the attach that measured and wrote per row, which forced a layout per row (63 ms for 10 rows at 1x, about the whole gap at 4x); TASK-527 proposes batching the effects of a flush before the render work they trigger. Runtime +20 B brotli on an islands page (9.29 kB), +60 B on the whole runtime (13.68 kB).
<!-- SECTION:FINAL_SUMMARY:END -->
