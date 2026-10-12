---
id: TASK-262
title: 'Flaky @lumiose/cli tests: help timeouts under full-suite load'
status: Done
assignee:
  - Beacon
created_date: '2026-10-12 21:08'
updated_date: '2026-10-12 21:51'
labels:
  - cli
  - tests
dependencies: []
priority: medium
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen by several M9 workers (TASK-148, TASK-250/251): packages/cli/src/cli.test.ts help tests (and CLI docs tests) time out when the whole pnpm test runs under load, and pass alone. Make them deterministic (in-process invocation, or a timeout derived from a single cold start) so CI does not flake; do not just raise the timeout without a reason.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help, misuse, routes, typegen, docs and explain tests run in-process through main(argv, io) instead of a cold-started bin per call
- [x] #2 One subprocess smoke test keeps the bin wiring (stdout, stderr, exit code) covered, with a timeout justified by its cold starts
- [x] #3 Full pnpm test green at least twice, and cli.test.ts green alone
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon 2026-10-12: cause: the help test spawned the bin 9 times and the docs/explain test 3 times, each a cold Node start that imports the whole command graph (~0.2 s idle, seconds under full-suite load), against the default 5 s test timeout. Fix (packages/cli/src/cli.test.ts): run() now calls main(argv, io) in-process with a capturing io (cwd = the fixture, no color), the same pattern as docs/docs.test.ts; the help, misuse, routes, typegen, docs and explain tests use it. runBin() keeps the subprocess for what needs a real process: a new smoke test of the bin (-v and a typo, run concurrently: stdout, stderr, exit code; 30 s timeout for two cold starts), check/lint/fmt (60 s, they shell out to tsc/oxlint/oxfmt) and build/preview/dev (servers, SIGTERM). docs.test.ts and examples.test.ts were already in-process / 60 s. Timings: help test 3 ms (was 9 cold starts); under the full suite the bin smoke test took 366 ms, check/lint/fmt 17.4 s of its 60 s. Evidence: cli.test.ts alone 10/10 green; pnpm test x2 green (165 files, 1769 tests each), a third verbose run green. Checks: @lumiose/cli typecheck, oxlint, oxfmt --check on the file clean; pnpm lint exit 0. pnpm typecheck currently fails only in packages/lumiose/src/app/i18n/server.ts, router/index.server.ts, server/i18n.test.ts (Nova's in-progress TASK-261 Locale typing), not in this change; build:compiler/cargo/fmt:examples not run (test-only change, no Rust).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CLI tests no longer cold-start the bin per call: help, misuse, routes, typegen, docs and explain run in-process through main(argv, io); one bin smoke test (two concurrent cold starts, 30 s) keeps the bin wiring covered; check/lint/fmt and build/preview/dev stay subprocesses with their 60 s budgets. Full pnpm test green three times, the file green alone.
<!-- SECTION:FINAL_SUMMARY:END -->
