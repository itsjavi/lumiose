---
id: TASK-66
title: Answer compiler moduleRequests in lumen check and the language server
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 16:15'
updated_date: '2026-10-08 16:28'
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
- [x] #1 lumen check and the LSP resolve and supply requested modules (transitively) so files importing $ constants get their CSS diagnostics
- [x] #2 LUM3008 is reported for an import that cannot be resolved or does not export the name
- [x] #3 Tests cover a file with an imported token and a CSS error
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/lumen/src/cli/check/modules.ts: ModuleHost — TS-compatible (bundler) resolver: relative/absolute paths with .js→.ts substitution and .ts/.tsx/.stsx/.js/.jsx probing + index files, tsconfig `paths` (extends chain, JSONC), package `exports`/`imports` (conditions import/module/browser/default) and main fallback; caches resolutions and disk sources; optional `read` overlay (editor buffers); records each compiled file's cssDeps; invalidate(path, kind) returns dependents.
2. compile.ts: compileWithModules (request loop, 32-round cap) and compileDiagnostics({ modules }); lumen check's provider builds one host per run (tsconfig from --project). Export via lumen/tooling.
3. language-server: one host per project root with open-document overlay; LumenFile.modules; invalidate on didOpen/didChange/didClose and watched-file changes (register module globs), clear dependents' cached provider results and refresh/push.
4. Tests: check fixture (.stsx importing tokens via chained re-export, let/misspelled/unresolvable refs → LUM3008 at the ref, LUM3005 now reported), resolver unit tests, LSP test incl. dependency edit invalidation.
5. Docs: styles.md build-time math clamp note (TASK-61); regen llms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-task66-20261008T161642Z): implemented.

**ModuleHost** (packages/lumen/src/cli/check/modules.ts, exported from lumen/tooling with compileWithModules): TypeScript-compatible resolution (bundler) — relative/absolute paths (.js→.ts/.tsx, .jsx→.tsx, .mjs→.mts, .cjs→.cts first; then the file; then .ts/.tsx/.stsx/.js/.jsx; then dir index), tsconfig `paths` (exact key, else longest-prefix `*` pattern; followed through `extends` strings/arrays incl. packages; JSONC; targets relative to the declaring config; no baseUrl — TS 7), package `imports` (#x) and `exports` (subpaths, `*` patterns, null exclusions, conditions import/module/browser/default — not `types`, declarations have no values), else module/main/index; node_modules packages realpath'd (pnpm workspaces). Caches resolutions, package.json manifests and disk sources; optional `read` overlay (editor buffers, never cached). `record(file, cssDeps)` + `invalidate(path, change)` → dependents; created/deleted files or a tsconfig/package.json change clear resolutions and return every recorded file. Vite-only aliases are not seen (TS would not resolve them either; documented).

**compile.ts**: compileWithModules runs the request loop (≤32 rounds, as lumen/vite), records cssDeps; compileDiagnostics({ modules }) uses it. lumen check's provider builds one ModuleHost per run with the checked tsconfig (DiagnosticProvider context gained optional `project`).

**Language server**: one ModuleHost per project root reading open documents first; LumenFile.modules (unset for non-file URIs); didOpen/didChange/didClose and watched-file events invalidate the host and drop the cached provider results of open dependents, then refresh (pull) / push. Watchers now also registered for **/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json}.

**Docs**: styles.md — how imports of constants resolve (Vite vs check/editor, LUM3008), and the Build-time math "Negative results" paragraph + 2 table rows (TASK-61: negative results in non-negative properties ship as 0, mirroring lightningcss#1329; margins keep negatives; verified with the compiler: padding-left/width/font-size → 0, margin-left → -4px); cli.md lumen check mentions compiler diagnostics and resolution. llms regenerated (docs:check clean).

**Evidence**: modules.test.ts (6: relative/extension rules, paths via extends + JSONC, #imports, exports conditions/patterns/null, main, overlay + cache invalidation, dependents, created files, tsconfig reload, --project). check.test.ts: Tokens.stsx importing via tsconfig paths + `export *` / `export { space as gap } from` → LUM3008 at $mutable (let), $brand (unresolvable), $gapp (no export) and LUM3005 .oops (previously all withheld); TS reports only TS2724/TS2307. server.test.ts: same in the LSP with exact ranges/messages, an unsaved edit of theme.ts re-checks the unchanged dependent, and a disk change two re-exports away (didChangeWatchedFiles) clears $acent. pnpm test 837/837; pnpm lint clean for my files (one pre-existing warning in app/router/index.ts); typecheck green for lumen and language-server — pnpm typecheck fails only in packages/site-kit (Halo, TASK-59 in progress: no tsconfig yet). lumen check on examples/vite-counter: no problems.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen check and the language server now answer the compiler's moduleRequests, so files whose $ references import constants get their full CSS diagnostics (LUM3005/3009/3014-3016, and LUM3008 for unresolvable imports, missing exports and non-constant values at the reference). A shared ModuleHost in lumen/tooling resolves like TypeScript (relative paths with TS extension rules, tsconfig paths through extends, package exports/imports), caches resolutions and sources per check run / per LSP project, reads editor buffers first in the LSP, and tracks each file's cssDeps so edits to a constants module (in a buffer or on disk) re-check open dependents. compileWithModules runs the request loop (32-round cap). Tests: ModuleHost unit tests, a lumen check fixture with tsconfig paths and chained re-exports, and an LSP test covering buffers and watched-file invalidation. Docs: styles.md explains import resolution per tool and the TASK-61 negative-result clamping in Build-time math; llms regenerated.
<!-- SECTION:FINAL_SUMMARY:END -->
