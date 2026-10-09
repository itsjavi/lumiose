---
id: TASK-173
title: 'Perf: minimal DOM moves for row swaps; trim the island runtime'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 12:12'
updated_date: '2026-10-09 12:26'
labels:
  - perf
  - dom
milestone: m-7
dependencies: []
priority: medium
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the TASK-68 run: 05_swap1k is 1.37x vanilla (Solid 1.12x); script time 1.3 ms vs 0.1, so the extra ~8 ms is layout from extra DOM moves. Islands on top of typical imports are 2.77 kB vs the 2.75 kB soft target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Swapping two rows performs the minimal DOM moves (mutation-count test); jsfb 05 measured before/after with no regressions on 01–09
- [x] #2 Hydration + loader trimmed under the soft target, then doc-1 §6 targets ratcheted (proposal to Lux)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: (1) Swap already does the minimal moves: list.test.ts 'swaps two rows with two moves' (2 insertBefore, 0 removes), and in Chrome on the built jsfb apps the swap's MutationObserver records are identical for lumen, vanillajs and solid (2 removals + 2 insertions on TBODY), with identical row markup. A vanilla-order variant (move the last row after the first, as vanillajs does) made no difference (36.6/36.8 vs 36.2/36.5 ms), so list.ts is unchanged. Re-measured 05_swap1k (krausest runner, 15 iterations, two runs): lumen 36.5/35.9 ms, vanillajs 33.5/32.9, solid 34.5/35.6 → 1.09x (the 1.37x in RESULTS.md was a noisy run: vanillajs measured 22.2 then). The remaining gap is script (1.2 vs 0.5 ms) plus noise, not DOM moves. No change to list code, so 01–09 are unaffected. (2) Hydration + loader trimmed from 2.79 to 2.75 kB brotli (≤ 2816 B, OK): removed the focus save/restore around claiming (nothing moves since TASK-152; new hydrate.test 'keeps the focus of an input …'), .remove()/.replaceWith()/new Text()/new DocumentFragment(), simpler link restore. Proposal to Lux: do not ratchet yet — typical imports 6.13 kB (target 6.25), islands 2.75 (2.75); and every export is 9.97 kB against the 10 kB hard cap (TASK-168's URL check added ~0.13 kB), so the next runtime feature needs a trim first. Validation: dom vitest 146/146, typecheck, oxlint; Playwright islands-e2e 5, spa-router-e2e 22, bookshelf 15, travel journal 17.
<!-- SECTION:NOTES:END -->
