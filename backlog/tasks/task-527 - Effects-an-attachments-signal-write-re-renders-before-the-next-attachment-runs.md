---
id: TASK-527
title: >-
  Effects: an attachment's signal write re-renders before the next attachment
  runs
status: Done
assignee:
  - Spark
created_date: '2026-10-23 09:05'
updated_date: '2026-10-23 14:46'
labels:
  - performance
  - core
  - needs-decision
milestone: m-13
dependencies: []
priority: high
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while measuring TASK-522. When several attachments (or effects) run in one flush and each measures the DOM, then writes a signal the page renders, the scheduler runs the render work of each write before the next attachment runs (flush in core/effect.ts drains the render queue between user effects). Every measurement after the first then forces a fresh layout: the private-app port of TASK-492 measured 63 ms for 10 virtual-grid rows at full CPU speed, which at 4x CPU is about the whole gap TASK-522 reported against React (539 vs 284 ms); the TASK-522 grid A/B shows that inserting rows node by node was not the cost. React runs every layout effect of a commit before it renders their state updates together, and Solid holds writes made by effects until the running effects are done. Proposal: run the user effects already queued in a flush before the render passes that their writes trigger, so N measurements cost one layout. It changes what an effect sees: the DOM would not yet reflect a signal that an earlier effect of the same flush wrote, so it needs a decision first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision records whether user effects queued in one flush run before the render work their writes trigger, with its rationale
- [x] #2 If they do: an in-process browser A/B of N attachments that measure and then write shows one forced layout instead of N, and the effect ordering tests stay green
- [x] #3 The JSX docs (When attach runs) match the behaviour
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23 (Lux): the user accepted the proposal (batch: queued user effects run before the render work their writes trigger), to ship in 0.6.0 as a documented behaviour change. Decision recorded as decision-80.

2026-10-23 (Spark): claimed, implementing decision-80 in core/effect.ts on a worktree branch.

Spark (2026-10-23): implemented decision-80 in packages/lumiose/src/core/effect.ts. A flush alternates render passes and user passes: a user pass runs the user effects (attach callbacks included) queued when it starts; their writes apply to signals at once, the render work they queue waits for the pass to end, and the effects they schedule join the next pass. Render bindings still run before user effects within an update. One guard keeps owner semantics, as Solid's runTop does: when render work is pending, the queued render ancestors of the next effect (a conditional, list or attach binding around it, or an async run) run first, top-down, so an effect whose subtree that work replaces is disposed instead of running once more; a pending ancestor whose computed turns out unchanged does no DOM work. flush() and batch() inside an effect still do not flush early. Loop guards as before: an effect's own writes do not re-queue it. Cleanup order, error routing (onError, ErrorBoundary), hydration and islands code untouched.

Spark: tests. core/effect.test.ts 'user effects in one flush (decision-80)': a later effect sees the new value but the old DOM; every queued effect runs before one render pass; an effect that depends on the written signal sees the new DOM in the next pass; bindings still run before effects within an update; flush() and batch() inside an effect; a batch outside a flush; the subtree guard; an unchanged pending ancestor. dom/element.test.ts: 5 attachments that measure, then write: every measurement sees the old DOM, then the 5 writes in one render pass. The old scheduler fails 6 of these; the subtree test fails without the guard. The old 'render effects updated by a user effect run before the next user effect' test became the first one above.

Spark: A/B. bench:measure:ab (new, benchmarks/js-framework-benchmark/scripts/measure-ab.ts, page src/measure/main.tsx): two runtime builds in one headless Chrome page, alternating, GC before each sample, 4x CPU, 30 rounds; N keyed rows of 8 cards whose attach reads getBoundingClientRect and writes a signal the page renders (row min-height, plus a total through a computed); layouts from Chrome's Performance.getMetrics LayoutCount. main vs this branch. N = 10: layouts per replace 11 -> 2, style recalcs 11 -> 2, replace with the attachments 8.30 -> 7.10 ms (paired -1.25), until painted 12.50 -> 11.90 ms (-0.65). N = 80: layouts 81 -> 2, replace 60.60 -> 46.85 ms (paired -13.90), until painted 73.90 -> 65.05 ms (-8.65). The 2 layouts are the measurements' one and the final one after the batched writes. A forced layout costs little in this page (about 0.2 ms at 4x); pages with costlier layout save more per avoided layout. The Chrome client, runtime export and bundling moved from grid-ab.ts into scripts/chrome-ab.ts, shared by both A/Bs.

Spark: no regression. bench:grid:ab (HEAD vs change, 40 rounds, 4x CPU): fragment rows until painted 22.25 vs 22.10 ms (paired -0.15), element rows 21.85 vs 21.85 ms; mutation records unchanged. krausest's local runner (jsfb-ab, temporary variant dirs built from main and this branch, removed afterwards; RESULTS.md untouched), 01-09, 15 alternating runs: every paired total difference within its IQR around 0 except 03 (+0.86, IQR 0.01-1.59); an A/A/B rerun of 01, 02, 03, 07, 09 with a copy of the old build put b - a (-0.07, -0.05, -0.63, -0.96, +0.44 ms) inside the A/A spread (c - a: -0.08, -0.01, -0.39, +1.03, -0.15). The jsfb app has no effects.

Spark: validation. pnpm check (build:compiler, typecheck, lint with no new warnings, fmt:examples, vitest 2368 passed, scripts tests, size, cargo test --workspace), docs:gen and docs:check, Playwright: examples/islands-e2e 8 passed, examples/spa-router-e2e 38 passed, examples/ui-e2e Chromium dev and build 1024 passed (24 skipped), apps/web 188 passed (4 skipped). Size (pnpm --filter lumiose size, brotli): typical imports 6.15 -> 6.23 kB (soft target 6.25 kB), islands page 9.30 -> 9.33 kB, whole runtime 13.68 -> 13.73 kB (cap 15 kB), core 4.41 -> 4.44 kB. Docs: concepts/jsx.md (When attach runs), concepts/signals.md (flush order, a common mistake), reference/reactivity.md (effect), coming-from/react.md (useLayoutEffect); llms-full.txt regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
User effects and attach callbacks queued in a flush now all run before the render work their signal writes trigger (decision-80, packages/lumiose/src/core/effect.ts): the writes render together after the pass, and the effects they schedule run in the next pass of the same flush. Signal reads stay synchronous; only the DOM lags for later effects of the same pass. Render bindings still update before user effects within an update, and queued render work that owns an effect (a conditional or list around it) still runs before it, so no effect runs inside content an earlier effect's write removed. In-process Chrome A/B (new bench:measure:ab, 4x CPU, main vs change): attachments that measure, then write, cost 2 layouts per replace instead of N + 1 (N = 10: 11 -> 2, replace 8.30 -> 7.10 ms; N = 80: 81 -> 2, replace 60.60 -> 46.85 ms, until painted 73.90 -> 65.05 ms). Grid A/B and krausest's local cases: no change. Runtime +80 B brotli on typical imports (6.23 kB, under the 6.25 kB target). Shipped as feat(core)! with a BREAKING CHANGE footer for 0.6.0; docs (JSX: When attach runs, signals flush order, reactivity reference, coming from React) updated in the same commit.
<!-- SECTION:FINAL_SUMMARY:END -->
