---
id: TASK-164
title: >-
  Security: request target '//host/…' replaces the request host (CSRF bypass,
  url() poisoning)
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 12:01'
labels:
  - security
  - server
milestone: m-7
dependencies: []
priority: high
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-162 H1 (Prism): node-http.ts:26-27 builds new URL(req.url, base); req.url='//attacker.test/account' makes host attacker.test, so the CSRF Origin check (csrf.ts:44) passes and ctx.url/url() report the attacker host even with ORIGIN set (reset-link poisoning; fetchJSON same-origin test at fetch-json.ts:37 also poisoned). Probe: .local/agents/Prism/prism-20261009T1200Z/app/csrf-probe.ts (raw socket).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The request URL is built from the configured/derived origin plus the raw path so a leading // stays in the path; request targets not starting with / are rejected (asterisk form only for OPTIONS); regression tests with raw //host requests for CSRF, url() and fetchJSON
- [ ] #2 Same fix in every place that builds a URL from a request target (dev server, preview, adapter-node); docs note in security.md
<!-- AC:END -->
