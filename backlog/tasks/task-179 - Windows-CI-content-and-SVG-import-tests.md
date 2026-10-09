---
id: TASK-179
title: 'Windows CI: content and SVG import tests'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-09 15:39'
updated_date: '2026-10-09 20:55'
labels:
  - ci
  - windows
  - test
dependencies: []
priority: medium
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the CI workflow (TASK-161, run 37951517996, check (windows-latest)). Failing on Windows only: packages/lumen/src/vite/content.test.ts (4 tests) and svg.test.ts / svg.dom.test.ts (9 tests). Causes seen in the log: generated import strings with unescaped Windows paths ("D:alumenlumenpackages...": backslashes as escapes in test/out/svg/*.client.js), 'Denied ID' because temp roots use the 8.3 short name (RUNNER~1) while Vite resolves the long one (use normalizePath(realpathSync.native(mkdtempSync(...)))), and backslash paths in expectations (Vite ids use '/'). The fixes in packages/lumen/src/vite/plugin.test.ts and the other vite tests (578d6fd, 1963ff1, 058b92e) show the pattern: native realpath + normalizePath for temp roots, 'junction' links, '/'-joined expectations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 content and svg tests pass on windows-latest in the CI workflow
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESUME (Halo, 2026-10-09 checkpoint): fix committed and pushed as 840bc9c (content.test.ts, svg.test.ts: temp roots via normalizePath(realpathSync.native(...)) + '/app', '/'-joined paths and expectations, junction links; svg.dom.test.ts: the icon path spliced into JS uses '/'). Passes locally (31 tests). Nothing uncommitted. CI not yet confirmed on windows-latest: run 37953757673 was cancelled by a newer push; run 37954017870 (034ae21, contains 840bc9c) was still pending at checkpoint. Next step: gh run list --workflow CI, then gh run view <id> --json jobs and check 'check (windows-latest)' for content/svg tests; mark AC #1 and Done if green. TASK-177 done (951660f).

Lux 2026-10-09: confirmed in CI run 37954801977 — e2e ubuntu green and this task's Windows tests pass; the remaining windows-latest failures are Photon's vite plugin test and Beacon's cli.test.
<!-- SECTION:NOTES:END -->
