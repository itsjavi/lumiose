---
id: TASK-66
title: Answer compiler moduleRequests in lumen check and the language server
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 16:15'
updated_date: '2026-10-08 16:21'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/lumen/src/cli/check/modules.ts: ModuleHost — TS-compatible (bundler) resolver: relative/absolute paths with .js→.ts substitution and .ts/.tsx/.stsx/.js/.jsx probing + index files, tsconfig `paths` (extends chain, JSONC), package `exports`/`imports` (conditions import/module/browser/default) and main fallback; caches resolutions and disk sources; optional `read` overlay (editor buffers); records each compiled file's cssDeps; invalidate(path, kind) returns dependents.
2. compile.ts: compileWithModules (request loop, 32-round cap) and compileDiagnostics({ modules }); lumen check's provider builds one host per run (tsconfig from --project). Export via lumen/tooling.
3. language-server: one host per project root with open-document overlay; LumenFile.modules; invalidate on didOpen/didChange/didClose and watched-file changes (register module globs), clear dependents' cached provider results and refresh/push.
4. Tests: check fixture (.stsx importing tokens via chained re-export, let/misspelled/unresolvable refs → LUM3008 at the ref, LUM3005 now reported), resolver unit tests, LSP test incl. dependency edit invalidation.
5. Docs: styles.md build-time math clamp note (TASK-61); regen llms.
<!-- SECTION:PLAN:END -->
