---
id: TASK-162
title: 'Security review: server, adapters, compiler, CSP'
status: To Do
assignee:
  - Prism
created_date: '2026-10-09 11:53'
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
