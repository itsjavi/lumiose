---
id: TASK-245
title: >-
  Compiled jsfb rows: close the gap to the hand-compiled reference on select and
  partial update
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-12 13:24'
updated_date: '2026-10-12 22:52'
labels:
  - benchmark
  - performance
  - compiler
milestone: m-8
dependencies: []
priority: medium
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 2026-10-12 quiet-machine js-framework-benchmark run (ef81f5b) projects Lumiose at 1.132, above the doc-1 §11 target (CPU <= 1.12); lumiose-hand projects 1.09. The gap is mostly 03_update10th1k_x16 (17.4 vs 16.0 ms) and 04_select1k (6.0 vs 5.3 ms). Compare the compiler output with src/hand-compiled.js on these paths and close the gap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The codegen differences behind 03 and 04 are identified
- [x] #2 A jsfb run (03, 04 at least) shows the compiled app within noise of lumiose-hand, or the remaining gap is explained
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon 2026-10-13: findings.
Method (the machine was loaded, load average 4-27): same-browser A/B with krausest's own steps, throttling, tracing and trace analysis, frameworks alternating run by run (new `pnpm bench:jsfb:ab`, scripts/jsfb-ab.ts), plus heap after 1k rows + GC (page.metrics, krausest's 22_run-memory way) and an in-page iframe micro-benchmark of the click handlers. Variants were built from the current compiler output with one textual patch each, to isolate every difference.
Codegen differences, compiled App.stsx vs src/hand-compiled.js:
1. {id} (a const from row data): compiled insertText(text, id) → setText → String(id); hand writes .data = id. In Chrome the String()-made JS string stays alive with the text node (~64 B per row), a number does not. Heap per 1k rows: 1.868 MB compiled vs 1.764 hand; this alone 64 KB. Fixed in the runtime: setText passes numbers to the DOM unconverted (same text; tests cover -0, NaN, ±Infinity, 1e21): compiled 1.804 MB.
2. {row.label()}: compiled insertText(text, () => row.label()); hand bind(text, row.label, setText). The compiler passes identifier calls directly but wraps zero-arg member calls, because a member call may need its receiver (date.toISOString()). Cost: 36 B per row (closure; heap 1.804 vs 1.768 with the hand form) and one extra call plus applyText's checks per update: about 0.1-0.2 ms of script on 03 at 4x (e.g. script medians 1.71 compiled / 1.51 hand-form label / 1.32 hand, n=30). Not fixable safely without knowing row.label is a signal: proposal TASK-268 (Lux).
3. 04 select: identical codegen on the select path (bind(tr, () => _isSelected(id), toggle class), selector, delegated click with data slot); handler script time equal in the micro-benchmark (15-20 µs) and the A/B.
4. Size only: the compiled bundle includes insert.ts's region code for insertText (18.2 vs 17.9 kB; closing </td> tags in the template cost ~10 bytes after minification).
jsfb A/B, compiled (with the setText fix) vs lumiose-hand, alternating in one browser, total ms median (IQR):
- n=40: 03 21.56 (20.54-23.34) vs 21.96 (20.29-24.22), paired hand−compiled +0.71 (−1.55..1.95); 04 6.66 (6.18-7.36) vs 6.88 (6.04-7.87), paired +0.18 (−0.85..1.15); 01 30.87 vs 30.66, paired −0.38 (−0.81..0.28).
- n=30 (pnpm bench:jsfb:ab, quieter): 03 19.56 (17.57-21.84) vs 20.77 (17.89-22.63), paired +0.63 (−1.70..1.98); 04 6.31 (5.56-7.25) vs 7.19 (5.93-7.72), paired +0.38 (−0.96..1.55). Heap 1.804 vs 1.764 MB.
- Before the fix (n=40): 03 21.00 vs 22.44, 04 7.37 vs 6.74: also within noise.
Conclusion: on 03 and 04 the compiled app is within noise of the hand reference; the quiet-run gaps (03 17.4 vs 16.0, 04 6.0 vs 5.3 with equal script time 1.1/1.1 and 0.7/0.6) are not explained by codegen and did not reproduce in alternating runs, so they are most likely run-order/noise effects of the sequential runner. The remaining codegen gap is the label closure (TASK-268). RESULTS.md was not regenerated (needs a quiet-machine full run). Follow-up: TASK-267 (insert() numbers, Spark).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Codegen differences behind 03/04 identified: {id} went through setText's String() (64 B per row kept alive in Chrome), {row.label()} is a closure plus applyText instead of the signal plus setText (36 B per row, ~0.1-0.2 ms script on 03 at 4x), and the select path is identical. The runtime's setText now passes numbers to the DOM unconverted (heap 1.868 → 1.804 MB per 1k rows; hand 1.764). Same-browser alternating jsfb A/B (new pnpm bench:jsfb:ab) shows the compiled app within noise of lumiose-hand on 03 and 04 (and 01). The label closure needs a decision (TASK-268, proposal to Lux); insert() numbers are TASK-267 (Spark).
<!-- SECTION:FINAL_SUMMARY:END -->
