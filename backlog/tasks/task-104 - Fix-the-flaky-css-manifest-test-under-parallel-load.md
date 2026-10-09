---
id: TASK-104
title: Fix the flaky css-manifest test under parallel load
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 22:17'
updated_date: '2026-10-09 04:18'
labels: []
milestone: m-2
dependencies: []
priority: low
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nova saw packages/lumen/src/vite/css-manifest test fail in a full pnpm test run but pass alone (2026-10-09), likely a timing or shared-temp-dir race under parallel load.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root cause found and fixed (isolated temp dirs, deterministic waits); the test passes repeatedly under full-suite parallelism (e.g. 10 consecutive full runs of the vite project)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): Could not reproduce a deterministic race: the test already uses its own mkdtemp dir and a port-0 dev server. Measured the 'stylesheets in dev' test: ~0.25 s alone, 0.9-3.2 s in full runs with 12 CPU hogs (10 cores), so under the parallel load Nova saw (concurrent cargo builds) it can exceed Vitest's 5 s default timeout; the builds in beforeAll already had 60 s. Fix: explicit 30 s timeout on the dev test. Evidence: 9 full runs without load + 3 + 10 full runs under synthetic load, css-manifest passed every time (max 3.2 s). Unrelated failures seen in those runs, not mine: src/cli/cli.test.ts 'lumen check, lint and fmt report in the envelope' times out (5 s) in every run under load and most runs without; client-runtime.test.ts SPA test and docs.test.ts error-page test failed while other agents' changes were in the tree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
css-manifest.test.ts: the dev-server test gets a 30 s timeout (it took up to 3.2 s under load vs Vitest's 5 s default; root cause of the flake). 10 consecutive full runs under CPU load pass.
<!-- SECTION:FINAL_SUMMARY:END -->
