---
id: TASK-262
title: 'Flaky @lumiose/cli tests: help timeouts under full-suite load'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-12 21:08'
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
