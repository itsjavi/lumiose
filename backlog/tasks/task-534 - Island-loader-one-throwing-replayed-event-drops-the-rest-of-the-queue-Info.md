---
id: TASK-534
title: 'Island loader: one throwing replayed event drops the rest of the queue (Info)'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-23 18:09'
updated_date: '2026-10-23 19:31'
labels:
  - security
dependencies: []
priority: low
ordinal: 527000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: packages/lumiose/src/dom/islands.ts (around 301-315) replays an island's held events in a loop; if one dispatch throws (setting value on a file input, requestSubmit with a stale submitter), the remaining events are dropped. Pre-existing; TASK-508 widened the queue. Catch per event and report through onError.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A throwing replay does not stop the following events, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (worktree): replay() in packages/lumiose/src/dom/islands.ts now runs each held event in its own try/catch; a throw is reported through reportError (phase "hydrate", the island's ref: console plus onError when instrumented) and the events after it still run, in order. Side fix in the failed-load path: a throwing replay used to escape the .catch handler and leave island.g at 2, so the island was never loaded again; it now returns to armed. Also restores an input's value only when it changed (value !== target.value), so a file input picked once replays without throwing (setting a file input's value throws InvalidStateError); text inputs behave as before (an unchanged value set is a no-op). Phase choice: reused "hydrate" instead of adding a new ClientErrorPhase, which would change public API shape. Tests: two cases in src/dom/hydrate.test.ts (TASK-534), both failing on the old code (log [] plus unhandled InvalidStateError; error count 1 instead of 2). Size: loader brotli 1014 -> 1021 B (target 1024 B: OK), min +64 B; islands on typical +0.01 kB; whole runtime 13.73 -> 13.75 kB; client instrumentation (report-only) 0.72 -> 0.76 kB brotli, min unchanged. Docs: reference/dom.md, concepts/islands.md, llms-full.txt regenerated. Checks: targeted vitest (src/dom, 255 tests), pnpm typecheck, pnpm lint (no new warnings), docs:check, pnpm check (exit 0: 2370 tests, cargo), examples/islands-e2e Playwright 8/8.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A held event whose replay throws (a file input whose files changed meanwhile, a submitter no longer in its form) no longer drops the rest of the island's queue: each replay is caught on its own and reported through reportError (phase "hydrate", console and onError), and the following events still run in order (TASK-508 guarantees kept). A failed chunk load with a throwing replay now leaves the island armed for a retry. Input values are restored only when they changed, so a file input picked once replays cleanly. Two regression tests in hydrate.test.ts; docs updated (reference/dom.md, concepts/islands.md). Loader +7 B brotli (1021 B, under the 1 kB target).
<!-- SECTION:FINAL_SUMMARY:END -->
