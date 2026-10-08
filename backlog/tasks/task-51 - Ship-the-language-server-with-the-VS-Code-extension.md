---
id: TASK-51
title: Ship the language server with the VS Code extension
status: In Progress
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
- [ ] #1 The packaged extension provides LSP features in a Lumen project that does not install @lumen/language-server
- [ ] #2 Platform targets and the runtime used (VS Code's Node vs. a configured node) are documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bundle @lumen/language-server (src/bin.ts) with Rolldown into packages/vscode/server/bin.mjs (ESM, minified; prefer module builds so the UMD vscode-* packages bundle), copying the target's compiler.<platform>.node next to it; the bundled @lumen/compiler loader requires it relative to bin.mjs. Do not bundle TypeScript 7 (native, per platform): use the project's.
2. Extension: bundled entry server/bin.mjs; runtime selection (bundled -> VS Code's own Node.js via a module server; workspace/setting -> node, Node >= 24); lumen.server.runtime default empty; activate() returns { server() } for tests.
3. Platform-specific packaging: scripts/targets.ts (vsce target -> napi suffix), scripts/package.ts (build + vsce package --target -> lumen-vscode-<target>.vsix); .vscodeignore/.gitignore.
4. test:vscode runs the smoke suite in two modes (workspace server, bundled server without @lumen/language-server) and asserts the chosen server and runtime.
5. Document targets, runtime and limits in packages/vscode/README.md and the docs' editor section.
<!-- SECTION:PLAN:END -->
