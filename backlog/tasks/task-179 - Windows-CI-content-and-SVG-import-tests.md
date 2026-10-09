---
id: TASK-179
title: 'Windows CI: content and SVG import tests'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-09 15:39'
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
