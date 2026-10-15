---
id: TASK-305
title: Island load or hydration failure leaves the island dead
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 02:39'
updated_date: '2026-10-15 04:28'
labels:
  - bug
  - islands
dependencies: []
priority: medium
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while researching TASK-293. In packages/lumiose/src/dom/islands.ts, the loader's `go()` starts an island with `void load!().then((component) => { … hydrate(…) … })` and no rejection handler. When the island's chunk fails to load (a deploy replaced the hashed file, a network error) or `hydrate()` throws, the result is an unhandled promise rejection: nothing names the island, the island stays dead because its state never leaves "loading" (so it is never retried), and the clicks and input the loader captured for it before hydration are never replayed.

Expected: the failure is reported with the island's module, captured events are not silently lost (let the browser's default happen, or retry the load on the next interaction), and the reporting path is the one TASK-299's client `onError` will use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A failed island chunk load or a throwing hydration is reported with the island module, instead of an unhandled promise rejection
- [x] #2 Events captured for a failed island are not silently lost (default behaviour runs, or the next interaction retries the load)
- [x] #3 Tests cover a rejected chunk import and a throwing hydration
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (worker, branch claude/spark-m10-22e4a4) started 2026-10-15.

Implementation (Spark):
- packages/lumiose/src/dom/islands.ts: the island's load and hydration run in one promise chain with a catch. A failure is reported through reportError() (new internal module src/dom/report.ts, the single path TASK-299 will route to the client onError; info is { phase: "hydrate", island: ref }, matching ClientErrorInfo's fields). The default report is console.error("Lumiose: hydrate error in island <ref>", error).
- Captured events are dispatched again unintercepted, so their default actions run (a link navigates, a form submits). A chunk that failed to load re-arms the island (state 0): the next interaction imports it again. A throwing hydration leaves the island as server HTML (state 2), since it would throw again; in dev a hot swap still re-renders it.
- packages/lumiose/src/dom/hydrate.ts: a component that throws while claiming now disposes the partial owner and always restores the walk links it redirected (try/finally); before, a throw left own firstChild/nextSibling properties on server nodes.
- No new LUM code: the diagnostics registry is in Photon's compiler crate, and the message names the island ref.
- Size (in-process, pnpm --filter lumiose size): core + dom + islands 9.09 -> 9.16 kB brotli (hard cap 10 kB OK); loader share 0.96 -> 1.04 kB (its 1 kB soft target is reported only; decision-55 replaces per-area targets with one cap, TASK-321). The readable message costs 30 B of that.
- Tests: src/dom/hydrate.test.ts, island loader: a rejected chunk import (report, default replay, reload on the next click) and a throwing hydration (report, default replay, no interception afterwards, no redirected links). Both fail on the old code with unhandled rejections.
- Docs: reference/dom.md (When an island fails), concepts/islands.md; llms-full.txt regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Island chunk-load and hydration failures are reported with the island ref through src/dom/report.ts instead of becoming unhandled rejections; the events the island caught get their default actions; a failed load retries on the next interaction, a failed hydration leaves server HTML and cleans up its partial owner and redirected links. Tests and docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
