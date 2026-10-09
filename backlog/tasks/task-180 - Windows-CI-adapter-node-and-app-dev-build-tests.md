---
id: TASK-180
title: 'Windows CI: adapter-node and app dev/build tests'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-09 15:39'
labels:
  - ci
  - windows
  - test
dependencies: []
priority: medium
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the CI workflow (TASK-161, run 37951517996, check (windows-latest)). Failing on Windows only: packages/adapter-node/src/static.test.ts (unreadable entries/links test), packages/lumen/src/app/dev/dev-server.test.ts (3), app/dev/errors.test.ts (1), app/production/build.test.ts (4), app/production/client-runtime.test.ts (1). Likely the same causes as the vite tests fixed in 578d6fd/1963ff1/058b92e: temp roots with the 8.3 short name (use normalizePath(realpathSync.native(...))), backslash paths compared with Vite's '/' ids, /@fs/ ids of drive-letter paths, and symlinks (use 'junction' for directories). Also on Linux CI only: examples/ssg-travel-journal e2e is flaky: one 'islands' test and 'strict CSP › pages carry a hash policy' fail at islandsReady() (form.search[data-ready] never attached within 5 s) in 3 of the last runs; passes locally and in a Linux container.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 These tests pass on windows-latest
- [ ] #2 ssg-travel-journal e2e passes on ubuntu-latest in CI
<!-- AC:END -->
