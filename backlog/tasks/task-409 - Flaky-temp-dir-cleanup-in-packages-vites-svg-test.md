---
id: TASK-409
title: Flaky temp-dir cleanup in packages/vite's svg test
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 23:37'
updated_date: '2026-10-16 03:36'
labels:
  - build
  - test
dependencies: []
priority: low
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen at the batch 5 merge (2026-10-16): packages/vite/src/svg.test.ts failed once in pnpm check with ENOTEMPTY when removing its temporary app's node_modules/.vite/deps directory. Vite's optimizer was probably still writing to it. It passed on rerun. Make the cleanup robust (rm with recursive, force and retries, or close the server before removing) so CI does not flake.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The svg test's cleanup cannot fail on a directory the optimizer still writes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): done in fbe25eee.

- svg.test.ts's dev servers no longer pre-bundle dependencies (`optimizeDeps: { noDiscovery: true, include: [] }`). They never needed it, and the optimizer's writes to node_modules/.vite/deps could outlive `close()`.
- Every temp-app removal in packages/vite's tests (9 files) now retries: `rmSync(…, { maxRetries: 5, retryDelay: 100 })`, which Node applies to ENOTEMPTY, EBUSY and EPERM.
- svg.test.ts passed 3 times in a row, and packages/vite passes (219 tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The svg test's servers no longer pre-bundle, and every packages/vite temp-dir removal retries (fbe25eee). Checks: pnpm check (2372 tests), pack:check --smoke --skip-npm (@lumiose/ui 146 files), ui-e2e Chromium 728 passed (22 skipped), Linux Firefox and WebKit 729 passed (21 skipped), apps/web 179 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
