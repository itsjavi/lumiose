---
id: TASK-162
title: 'Security review: server, adapters, compiler, CSP'
status: To Do
assignee:
  - Prism
created_date: '2026-10-09 11:53'
updated_date: '2026-10-09 12:01'
labels:
  - security
milestone: m-7
dependencies: []
priority: high
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: production hardening. Read-only review of packages/lumen/src/{app,server}, packages/adapter-node, the Vite plugin's dev server surfaces, the compiler's handling of untrusted input (.stsx/.md/.html/.svg), CSP (decision-27), cookies, actions (CSRF/Origin check), redirects, static serving (path traversal, symlinks, dotfiles), request/body size limits, error pages (stack/secret leakage), headers, MCP server exposure, island prop serialization (XSS via JSON in HTML).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Findings report with severity, evidence (file:line, repro) and fixes; Lux files tasks
- [ ] #2 Fuzz-style probes of the .stsx scanner/masking and CSS pipeline (crashes, hangs) included
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: partial report received (app/server only). H1 → TASK-164 (Nova, high); M1/M3/M4/L1-server/L5/L6 + server redirect() scheme check → TASK-165 (Nova); M2 + L1-client → TASK-166 (Spark). L2 (URL sanitization default), L3 (ErrorBoundary production error sanitization), L4 (signed-cookie secret length) need the user's approval. Still open: adapter-node, compiler/svg/content fuzzing (AC #2), Vite dev/LUM4003/MCP, dependency audit.
<!-- SECTION:NOTES:END -->
