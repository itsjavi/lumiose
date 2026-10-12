---
id: TASK-267
title: Numbers in insert regions skip String()
status: Done
assignee:
  - Spark
created_date: '2026-10-12 22:52'
updated_date: '2026-10-12 23:05'
labels:
  - runtime
  - performance
dependencies: []
priority: low
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-245: in Chrome, a JS string made with String(number) and written to a text node stays alive with the node (about 64 bytes each), while a number written as is does not. TASK-245 changed setText (insertText and bind text paths) accordingly: the jsfb app's heap after 1k rows went from 1.868 to 1.804 MB (hand reference 1.764). insert() still converts with String() for static primitives (document.createTextNode(String(value)), src/dom/insert.ts) and for text items in regions (the String(value) calls in the region rendering), e.g. a dynamic {count()} child rendered with insert(). Measure with a heap A/B (benchmarks/js-framework-benchmark: pnpm bench:jsfb:ab --heap, or page.metrics() after a GC) and pass numbers through where it helps; keep the runtime under its size cap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Numeric children rendered by insert() keep no converted JS string alive (heap A/B in Chrome), with the same text as before
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-13): measured first, then changed insert().

Method: Chromium (Playwright 1.63), old (HEAD) and new runtime bundles alternating per sample in one browser, a fresh context per sample; JS heap growth per child after two HeapProfiler.collectGarbage (Runtime.getHeapUsage), plus heap snapshots grouped by retainer. Scripts: .local/agents/spark/spark-20261012T225355Z-t267/ (heap-ab.ts, heap-snap.ts, snap-diff.ts, who.ts, cpu-ab.ts, text-check.ts).

Findings:
- Static path (`createTextNode(String(n))`) and `setText`: no string stays alive per text node. The whole heap difference is one array, V8's `smi_string_cache` (strong root), which grows to 65,544 B once String() has converted enough small integers: the snapshot diff is the same 64,512 B at 1k and at 10k nodes, also for `t.data = String(i)` vs `t.data = i`. So TASK-245's "about 64 B per text node" at 1,000 rows is this one-time cache growth (64.5 kB / 1,000 rows), not per-node retention. Apps that format integers anywhere else pay it anyway.
- Region path (`insert(parent, () => n())`): the render effect keeps its last value, which was the String() result: 10,000 strings (200,032 B) retained through `Object.value` for 10k regions; 0 after the change.
- Array items: no per-node strings (the content array gets the text nodes), only the cache.

Heap A/B, N = 10k, 10 alternating samples, bytes per child (old → new, paired): region int 409.4 → 387.1 (−22.2); region int after one update 416.5 → 390.1 (−26.4); region float 435.9 → 427.9 (−7.9, a HeapNumber replaces the string); static int 22.9 → 16.4 (−6.5, cache only; static float 0); region array 508.0 → 501.6 (−6.4, cache only). At N = 1k the cache dominates (static int −68, region int −79).

Change: insert() hands strings, numbers and bigints to the DOM as is (static path, `resolve`, `flatten`, `applyRegion`); `resolve`/`flatten` drop their typeof branch since `isFragment` is false for primitives. Text is identical in Chromium (old vs new bundle) for -0, 0, 1.5, -2, NaN, ±Infinity, 1e21, 1e-7, 2**53, 0.1+0.2, 10n and "x", on the static, region, array and in-place update paths, and the text node is reused on update; unit test added (insert.test.ts). Only behaviour change: a Symbol child (not a Renderable) used to render "Symbol(x)" and now throws the DOM's TypeError.

Size, min+brotli bytes (before → after): every export 10,185 → 10,167 (−18); typical + islands 9,322 → 9,304 (−18); typical 6,215 → 6,196 (−19); benchmark imports 5,280 → 5,259 (−21); minified −92 B each.

CPU A/B, 30 alternating samples, in-page ms (old → new, paired median): 10k static inserts 2.40 → 2.40 (0.00); creating 10k regions 8.80 → 8.95 (0.00, IQR −0.27 to 0.40); 300 updates of 1k regions 63.25 → 60.70 (−2.25, IQR −3.00 to −1.50).

Also corrected setText's comment (attributes.ts), which claimed 64 B per text node. Checks: pnpm check green (1,794 tests, size caps OK, cargo OK).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
insert() now writes numbers (and bigints) to the DOM unconverted, like setText. A region binding no longer keeps a String() copy as its last value: about 20 B less per dynamic numeric child in Chrome (heap A/B, 10k children: −22 B/child, −26 after an update), with identical text for -0, NaN, ±Infinity, 1e21 and the rest. The static path never kept strings per node: its only cost was V8's smi_string_cache growing by about 64 kB once, which also explains TASK-245's '64 B per row' at 1,000 rows. Runtime 18 B smaller (every export 10,185 → 10,167 B brotli); region updates about 3.5% faster in a CPU A/B.
<!-- SECTION:FINAL_SUMMARY:END -->
