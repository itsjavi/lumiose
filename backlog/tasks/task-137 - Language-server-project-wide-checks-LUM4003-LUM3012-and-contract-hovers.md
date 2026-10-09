---
id: TASK-137
title: 'Language server: project-wide checks (LUM4003, LUM3012) and contract hovers'
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:54'
updated_date: '2026-10-09 05:08'
labels:
  - language-server
dependencies: []
priority: low
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-ups from Photon: TASK-116 (LUM4003 in the LSP via clientGraphDiagnostics from cli/check/client-graph.ts), TASK-62 (lumen check and LSP reuse CustomPropertyCheck for LUM3012), TASK-63 (hovers from the opt-in contract compile meta).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The LSP reports LUM4003 at import sites using the project client graph, incrementally
- [x] #2 lumen check and the LSP report LUM3012 like lumen build
- [x] #3 Hovers on JSX expressions show the contract meta (kind, helper, reactive reads)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): cli/check/project-checks.ts: projectDiagnostics(root, compiled, host) = LUM4003 (clientGraphDiagnostics) + LUM3012 (lumen/vite CustomPropertyCheck over the compiled modules, stylesheets under src/, and stylesheets/Lumen modules the compiled modules import); lumen check's compiler provider uses it. ProjectChecks (exported from lumen/tooling) lists src .stsx/.tsx on each run, reads through the module host (open buffers win) and recompiles only changed texts. LSP: ServerOptions.projectDiagnostics factory (providers.ts uses ProjectChecks with compileWithModules); one run per project and change generation (bumped in modulesChanged), findings merged into each document's Lumen diagnostics; when a run changes another open document's findings, diagnostics are refreshed (pull) or pushed. Hovers: language-server/src/contract.ts compiles with { contract: true } per document version and appends the innermost entry (site, component, via, kind, reactive reads) to the TypeScript hover in .stsx/.tsx. No false LUM3012/LUM4003 on any example, apps/web, playground, site-kit or the bench app. Tests: check.test.ts (LUM3012 with a child block read and a .css read), server.test.ts (LUM4003 + LUM3012 follow buffer edits; contract hovers tracked/once/deferred). Docs: errors/LUM3012.md, errors/LUM4003.md, getting-started (editor features), concepts/compiler.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Project-wide LUM4003 and LUM3012 in lumen check and the language server (incremental), and execution-contract hovers on JSX expressions.
<!-- SECTION:FINAL_SUMMARY:END -->
