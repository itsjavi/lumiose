---
id: TASK-291
title: Windows CI hangs in the Vercel adapter test
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-14 08:20'
updated_date: '2026-10-14 08:22'
labels:
  - ci
  - windows
  - adapters
dependencies: []
priority: high
ordinal: 293000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-175 the Windows check job never finishes `pnpm test`: it runs until GitHub's 6-hour job limit or a manual cancel. packages/adapter-vercel/src/index.test.ts never completes on Windows. `commonAncestor()` (function.ts) climbs with `dirname()` until a directory prefix matches, but the test passes POSIX paths while `sep` is a backslash on Windows, so no prefix ever matches. `dirname('/')` is '/', so the loop spins forever. The loop is synchronous, so Vitest's test timeout cannot stop it. The same loop would also hang a real build whose traced files sit on another drive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 commonAncestor() stops at the filesystem root: dirs that share no ancestor throw a clear error instead of looping
- [x] #2 The commonAncestor test uses platform paths and passes on Windows
- [x] #3 CI check and e2e jobs have a timeout-minutes cap, so a hang costs minutes, not hours
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found with: the Windows log of run 38508582430 completes 165 of the 166 test files Ubuntu completes; the missing one is adapter-vercel src/index.test.ts. A win32 path simulation reproduces the infinite loop with the old code and shows the guard (POSIX paths and two drives throw; platform paths give the right ancestor). Locally: the adapter's tests (12) pass, and typecheck, oxlint, oxfmt and docs:check pass. The Windows run itself is verified by the next CI push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
commonAncestor() throws at the filesystem root instead of looping forever. The test now uses platform paths, and a new test covers the no-common-root error. The CI check and e2e jobs are capped at 30 minutes and pack at 15, so a hang no longer holds a Windows runner, and the main-branch runs queued behind it, for 6 hours. The Vercel deploy doc mentions the one-drive requirement.
<!-- SECTION:FINAL_SUMMARY:END -->
