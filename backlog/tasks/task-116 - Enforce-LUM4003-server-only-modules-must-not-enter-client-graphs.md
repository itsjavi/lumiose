---
id: TASK-116
title: 'Enforce LUM4003: server-only modules must not enter client graphs'
status: Done
assignee:
  - Photon
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:54'
labels:
  - security
  - compiler
  - vite
dependencies: []
priority: high
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 1. An island importing src/server/**/*.server.* code (with secrets) passes lumen check and lumen build, and the secret ships in the island chunk. Docs, the bookshelf README, the ssr template comment and the generated AGENTS.md section claim LUM4003 enforces this.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen dev/build fail with LUM4003 and the importer chain when a *.server.* or src/server/** module is reachable from a client graph (islands, SPA/client routes, client entries); server graphs unaffected
- [x] #2 Tests (incl. a transitive import); errors/LUM4003.md, the bookshelf README, the ssr template comment and the AGENTS.md section are accurate
- [x] #3 lumen check reports LUM4003 at the import site (language-server support split into TASK-137)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): lumen/vite server-only.ts: build = buildEnd of the client environment walks every module (importers + dynamicImporters) and fails with one LUM4003 per server-only module and its importer chain (entry → … → module); dev = load hook of the client environment fails the request with the chain from the module graph. Server-only = *.server.* or src/server/** inside the project root, not node_modules, not CSS (a .server.stsx's stylesheet is built in the client env by the css manifest). Server environments unaffected. compile() now exposes meta.imports [{ specifier, span, dynamic }] (type-only imports stripped). lumen check (cli/check/client-graph.ts, small cli edit as approved): walks the client graph from island components (meta.islands) and modules importing lumen/dom, resolving with ModuleHost (tsconfig paths), compiling non-Lumen modules for their imports, and reports LUM4003 at the import specifier with the chain. Not covered by check: SPA route modules not reached from a lumen/dom importer (the build covers them). Tests: src/vite/server-only.test.ts (transitive client build failure with chain, clean build, ssr build ok, dev request failure, unit), cli/check/check.test.ts (LUM4003 at import sites incl. transitive util.ts; the server page importing db.server.ts is not reported), compile_api imports test. Docs: errors/LUM4003.md, concepts/islands.md, ssr-bookshelf README, create ssr template comment; AGENTS.md generator text was already accurate. REMAINING (AC #2): the language server (Beacon's area, files currently being edited by Beacon) does not show LUM4003 yet: its per-document compilerDiagnostics would need the project client graph; it can call clientGraphDiagnostics(root, compiled, moduleHost) from cli/check/client-graph.ts.

Lux 2026-10-09: the language-server part of AC #2 is split into TASK-137 (Beacon); build/dev enforcement and lumen check are done (5aed23a).
<!-- SECTION:NOTES:END -->
