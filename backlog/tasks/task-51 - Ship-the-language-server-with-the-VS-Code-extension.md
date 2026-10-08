---
id: TASK-51
title: Ship the language server with the VS Code extension
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 14:25'
updated_date: '2026-10-08 15:41'
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
