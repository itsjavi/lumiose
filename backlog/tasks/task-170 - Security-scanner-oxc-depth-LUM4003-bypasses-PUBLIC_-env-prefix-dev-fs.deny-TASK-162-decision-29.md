---
id: TASK-170
title: >-
  Security: scanner/oxc depth, LUM4003 bypasses, PUBLIC_ env prefix, dev fs.deny
  (TASK-162, decision-29)
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 12:10'
labels:
  - security
  - compiler
  - vite
milestone: m-7
dependencies: []
priority: high
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism TASK-162: H1 deep nesting ({a: ×5000, template, parens, JSX) overflows the native stack and kills Vite/LSP/MCP — depth limits with diagnostics in the scanner/masker and oxc passes, or a large-stack compile thread as backstop; M1 LUM4003 bypasses — register the plugin for workers, check new URL(literal, import.meta.url) in client environments + generateBundle backstop, match on realpath (case-insensitive FS, symlinks), cover non-node_modules files outside the Vite root; L5a CSS_REQUEST tested against the full id with query (use cleanId); decision-29: default envPrefix PUBLIC_ (overridable), server-only files in server.fs.deny for dev (overridable).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Depth limits/backstop with regression tests at depth 100k; LSP and MCP survive
- [ ] #2 LUM4003 bypass repros fail the build/dev request; envPrefix and fs.deny defaults with tests; docs (server.md, LUM4003.md, security.md)
<!-- AC:END -->
