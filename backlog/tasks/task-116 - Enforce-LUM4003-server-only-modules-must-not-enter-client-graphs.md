---
id: TASK-116
title: 'Enforce LUM4003: server-only modules must not enter client graphs'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 04:20'
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
- [ ] #1 lumen dev/build fail with LUM4003 and the importer chain when a *.server.* or src/server/** module is reachable from a client graph (islands, SPA/client routes, client entries); server graphs unaffected
- [ ] #2 lumen check / LSP report LUM4003 at the import site (small cli/ edits approved)
- [ ] #3 Tests (incl. a transitive import); errors/LUM4003.md, the bookshelf README, the ssr template comment and the AGENTS.md section are accurate
<!-- AC:END -->
