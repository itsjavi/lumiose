---
id: TASK-244
title: Lumiose SSR throughput regressed to ~560 renders/s
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-12 13:24'
updated_date: '2026-10-12 22:43'
labels:
  - benchmark
  - performance
milestone: m-8
dependencies: []
priority: high
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 2026-10-12 quiet-machine SSR run (benchmarks/ssr/RESULTS.md, ef81f5b) measured Lumiose at 559.5 ± 23.4 renders/s (0.75x Solid 1.9.17 at 747), down from 663.7 on 2026-10-08 (a5d73ef), which ran on a loaded machine (load 7-9). Bisect the server renderer/codegen changes since a5d73ef (renames, decision-28 server-side props, TASK-151 and others), find the cause and restore at least the previous throughput.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The regression is bisected to its commits, with the cause recorded
- [x] #2 Lumiose renders the SSR benchmark page at >= 660 renders/s on a quiet machine, or the trade-off is recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: cause found by A/B on the compiled output: decision-28's per-instance memo closure for deep prop reads (TASK-151, ecb44b5) costs ~7%; the renderToString wrapper ~2%. Plain getters were left out of TASK-246 by the user. With TASK-246 and the flattening method, Lumiose leads the SSR benchmark (619 vs Solid 580), so the remaining option is a cheaper memo that keeps decision-28's semantics (e.g. a shared runtime helper instead of a closure per instance).

Lux 2026-10-12, correction: the ~7% attributed to decision-28's memo closures above came from separate-process runs, which are bimodal on this machine (identical builds differ by ~8%). Re-measured in process (old/new alternating, ±0.2% on identical builds): plain getters instead of the memo are 3.1-3.8% SLOWER on the pre-TASK-246 build and 2.2-3.3% slower on the current one; keeping the memo state in the component function's scope instead of a closure per instance is 2.3-2.9% slower. The current memo is the cheapest measured form, and the 664 -> 560 drop is not explained by it. Next step if wanted: build the SSR page with the compiler and runtime of a5d73ef (git worktree) and A/B it in process against today's build, then bisect.

Nova 2026-10-12/13 (session nova-20261012T220911Z-t244), in-process bisect.
Method: git worktrees at each point; its compiler built (debug cdylib of the napi crate, codegen does not depend on the profile) to compile benchmarks/ssr's Page.stsx, plus a private copy of that commit's packages/<lumen|lumiose>/src runtime, so no two variants share modules. All variants load into one Node process (NODE_ENV=production, --expose-gc) and render benchmarks/ssr's page with its data; after a warmup of each, every round measures each variant for 200-250 ms in a rotated order, GC before each run; reported: per-round ratio to the reference (median, IQR), with identical-build controls (A/A) in the same process (they stayed within +-2%). Both methods: without flattening (the method of both the 664 and the 560 runs) and with it (TASK-246, today's RESULTS.md). Every variant renders byte-identical HTML. Tools: .local/agents/nova/nova-20261012T220911Z-t244/ (variant.mjs, point.sh, abn.mjs). Load average 6-20 during the runs; runs at load >30 were discarded and repeated.

AC1, the drop (without flattening, a5d73ef = 100%; medians, 50 rounds):
- a5d73ef -> af9e3442 (insertText TASK-65/90, CSP TASK-138/142): -2.0% (within the A/A spread)
- af9e3442 -> ecb44b5e (TASK-151, decision-28: deep prop reads memoized per instance by a closure; the runtime is identical, only the codegen differs): -4.4%
- ad070064 (TASK-168, decision-29: server attr() runs safeAttrValue(): URL_ATTRIBUTES regex, then value.replace() and the unsafe-scheme regex for every href): -7.2%
- the rest up to ef81f5b (renames, defineState, keyed cache, islands without page context, …): about 0 (+-2%)
Total at ef81f5b: -12.4 to -15.9% across runs, which matches 664 -> 560 (-15.7%). With flattening the same build is only -4.8%: flattening dominates and the regressed paths cost less relative to it.
Recovery (TASK-246, measured from ef81f5b): 2c568919 (exact fast paths in isUnsafeUrl) +5% without flattening; c7db56bf (insertText string fast path) ~0; f6eee545 (inline concatenation in server templates) +8%. Later commits (useId 94e8629b, viewTransition, i18n) cost nothing measurable.

AC2: HEAD (6e9f8892) vs a5d73ef, same process: without flattening -0.5%, +1.7%, 0.0%, +0.2% in four runs (A/A spread +-2%); with flattening +9.6%, +8.7%, +9.8%, +8.0%. So the previous throughput is restored on the old method and exceeded on the current one. The absolute >= 660 renders/s on a quiet machine needs a quiet rerun by the user (pnpm --filter @lumiose/bench-ssr bench); note that RESULTS.md now uses the flattening method, on which a5d73ef itself would score about 9% below today's Lumiose (619 on 2026-10-12), so 660 there is not comparable to the old 664.
Trade-off kept: decision-28's memo costs 3-5% without flattening and nothing or less than plain getters with it (head vs a plain-getter copy of head: +3.4/+4.8% for plain getters without flattening, -2 to -5% with), as Lux measured; codegen, user decision, no change. Residual URL check at HEAD: skipping safeAttrValue entirely gains +1.0/+2.1%, about the A/A spread, so no further change.
No runtime or app change was needed (the runtime cause, the URL check, was already fixed by 2c568919). RESULTS.md and the bench.ts Notes template record the finding.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bisected in process (old and new compiler output and runtime loaded into one Node process, measured alternately, with identical-build controls): the 664 -> 560 renders/s drop came from the unsafe URL check added to server attr() (ad070064, TASK-168, about -7%) and decision-28's once-per-instance memo for deep prop reads (ecb44b5e, TASK-151, about -4% on the unflattened method, none on today's flattening method), plus about 2% of small changes. TASK-246's URL fast path (+5%) and inline template concatenation (+8%) recovered it: today's build renders the page at 1.00x a5d73ef without flattening and 1.07-1.10x with it. No code change was needed; RESULTS.md records the finding. The absolute quiet-machine number needs a rerun by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
