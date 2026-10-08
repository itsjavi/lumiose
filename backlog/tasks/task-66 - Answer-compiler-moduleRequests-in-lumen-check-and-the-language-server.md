---
id: TASK-66
title: Answer compiler moduleRequests in lumen check and the language server
status: To Do
assignee:
  - Beacon
created_date: '2026-10-08 16:15'
labels:
  - tooling
  - styles
dependencies: []
priority: medium
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen check and the language server call compile() without `modules` (packages/lumen/src/cli/check/compile.ts). For a file whose $ references import constants, compile() returns moduleRequests and withholds css, and with it every CSS diagnostic of the file (LUM3005, LUM3009, LUM3014-3016, and LUM3008 for unresolvable imports). lumen/vite runs the request loop; check and the LSP should too, resolving specifiers like TypeScript/Vite would (relative paths, tsconfig paths) and reading the files from disk or the open documents. Found while writing TASK-56.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen check and the LSP resolve and supply requested modules (transitively) so files importing $ constants get their CSS diagnostics
- [ ] #2 LUM3008 is reported for an import that cannot be resolved or does not export the name
- [ ] #3 Tests cover a file with an imported token and a CSS error
<!-- AC:END -->
