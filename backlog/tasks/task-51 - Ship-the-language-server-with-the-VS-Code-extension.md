---
id: TASK-51
title: Ship the language server with the VS Code extension
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 14:25'
updated_date: '2026-10-08 15:47'
labels: []
milestone: m-4
dependencies:
  - TASK-30
priority: low
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The lumen-vscode .vsix (TASK-30) only launches @lumen/language-server found in the workspace (or lumen.server.path); the server runs from TS sources on Node >= 24 and loads the native @lumen/compiler binding, so a project without the server installed gets highlighting only. Bundle the server (JS build, platform-specific @lumen/compiler binary => platform-specific .vsix targets) into the extension's server/ dir, which src/workspace.ts already looks up as the last fallback, and/or make create-lumen templates add @lumen/language-server as a dev dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The packaged extension provides LSP features in a Lumen project that does not install @lumen/language-server
- [x] #2 Platform targets and the runtime used (VS Code's Node vs. a configured node) are documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bundle @lumen/language-server (src/bin.ts) with Rolldown into packages/vscode/server/bin.mjs (ESM, minified; prefer module builds so the UMD vscode-* packages bundle), copying the target's compiler.<platform>.node next to it; the bundled @lumen/compiler loader requires it relative to bin.mjs. Do not bundle TypeScript 7 (native, per platform): use the project's.
2. Extension: bundled entry server/bin.mjs; runtime selection (bundled -> VS Code's own Node.js via a module server; workspace/setting -> node, Node >= 24); lumen.server.runtime default empty; activate() returns { server() } for tests.
3. Platform-specific packaging: scripts/targets.ts (vsce target -> napi suffix), scripts/package.ts (build + vsce package --target -> lumen-vscode-<target>.vsix); .vscodeignore/.gitignore.
4. test:vscode runs the smoke suite in two modes (workspace server, bundled server without @lumen/language-server) and asserts the chosen server and runtime.
5. Document targets, runtime and limits in packages/vscode/README.md and the docs' editor section.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo execution by Beacon (assignee).

Evidence:
- AC1: pnpm --filter lumen-vscode run test:vscode packages lumen-vscode-darwin-arm64.vsix (1.64 MB: dist/extension.cjs 435 KB, server/bin.mjs 1.16 MB, compiler.darwin-arm64.node 3.1 MB) and passes in both modes. Bundled mode (workspace has only lumen and typescript, no @lumen/language-server): suite asserts source=bundled, path .../extension/server/bin.mjs, runtime VS Code's Node.js v24.21.0; grammar, $ref hover in .stsx, TS hover in .stsx and takeover hover in .tsx, snippets and auto-closing all pass. Screenshot: backlog/assets/task-51-bundled-server.png ($gap -> 8 hover from the bundled server).
- AC2: packages/vscode/README.md documents the lookup order, runtimes (bundled: VS Code's Node.js, nothing to install; workspace/setting: node >= 24 from PATH; lumen.server.runtime overrides), the project's TypeScript 7 requirement, the five platform targets and their compiler binaries, and the limits (a target packages only where its compiler binary exists, so one CI runner per target or cross-compiled binaries; no Alpine/win32-arm64/web build; no WASM fallback). packages/lumen/docs/getting-started.md Editor section updated.
- Unit tests: workspace.test.ts covers BUNDLED_SERVER lookup and serverRuntime (10 tests). pnpm typecheck, pnpm lint, pnpm test (72 files, 764 tests) pass; oxfmt clean.
- Decision: the workspace server keeps precedence over the bundled one, so a project can pin the server to its lumen version.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The lumen-vscode .vsix now ships the language server: scripts/build.ts bundles @lumen/language-server and its runtime deps (vscode-languageserver, vscode-css-languageservice, lumen/tooling, the @lumen/compiler loader) with Rolldown into server/bin.mjs and copies the target's native compiler.<platform>.node beside it; TypeScript 7 stays the project's. The extension runs the bundled server on VS Code's own Node.js (no Node >= 24 or server install needed), keeps node for workspace/configured servers, and lumen.server.runtime overrides both. scripts/package.ts produces platform-specific lumen-vscode-<target>.vsix packages (darwin-arm64/x64, linux-x64/arm64, win32-x64). test:vscode runs the real-VS Code smoke suite with the workspace server and with the bundled server in a workspace without @lumen/language-server; both pass. Targets, runtimes and packaging limits are documented in packages/vscode/README.md.
<!-- SECTION:FINAL_SUMMARY:END -->
