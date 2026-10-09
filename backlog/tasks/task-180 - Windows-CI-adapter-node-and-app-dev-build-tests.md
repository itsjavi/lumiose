---
id: TASK-180
title: 'Windows CI: adapter-node and app dev/build tests'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-09 15:39'
updated_date: '2026-10-09 20:55'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova RESUME 2026-10-09: all my work is committed and pushed (216b895: real project roots via realProjectRoot()/realpathSync.native in build() and createDevServer(), path-agnostic dev overlay frames, tests using realpathSync.native temp roots, the /@fs/ URL from normalizePath, chmod-000 assertions skipped on win32; client:idle requestIdleCallback timeout 2 s for the ubuntu e2e flake). CI run 37952282108 on 216b895: check macOS/ubuntu, e2e macOS/windows green; check (windows-latest) and e2e (ubuntu-latest) were still running at checkpoint. NEXT: gh run view 37952282108 — if Windows check still fails in app/dev, app/production or adapter-node tests, read the log (gh run view --job <id> --log-failed) and continue from there; Halo's (content/svg) and Photon's (vite/) Windows failures are listed on TASK-161. Nothing uncommitted from me; no claims or locks held.

Lux 2026-10-09: confirmed in CI run 37954801977 — e2e ubuntu green and this task's Windows tests pass; the remaining windows-latest failures are Photon's vite plugin test and Beacon's cli.test.
<!-- SECTION:NOTES:END -->
