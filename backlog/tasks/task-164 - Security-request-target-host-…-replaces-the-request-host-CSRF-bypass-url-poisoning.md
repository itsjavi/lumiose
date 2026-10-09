---
id: TASK-164
title: >-
  Security: request target '//host/…' replaces the request host (CSRF bypass,
  url() poisoning)
status: Done
assignee:
  - Nova
created_date: '2026-10-09 12:01'
updated_date: '2026-10-09 12:04'
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
- [x] #1 The request URL is built from the configured/derived origin plus the raw path so a leading // stays in the path; request targets not starting with / are rejected (asterisk form only for OPTIONS); regression tests with raw //host requests for CSRF, url() and fetchJSON
- [x] #2 Same fix in every place that builds a URL from a request target (dev server, preview, adapter-node); docs note in security.md
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: toWebRequest (lumen/node: dev server, adapter-node, lumen preview through the adapter) builds the URL as origin + raw target (concatenated, not resolved), with the origin normalized from ORIGIN/origin or protocol + Host (an invalid Host is a BadRequestTarget). requestTarget() accepts only '/…' targets and 'OPTIONS *' (as '/'); others throw BadRequestTarget, answered 400 by adapter-node (before statics, nothing logged) and by lumen dev. adapter-node statics read the raw target's path instead of new URL(req.url, 'http://localhost') (//robots.txt no longer serves index.html) and their 308 Locations collapse leading slashes/backslashes. Tests: packages/lumen/src/app/server/request-target.test.ts (raw sockets: //host stays a path with and without ORIGIN, absolute-form/asterisk/bad Host 400, OPTIONS * ok, CSRF check rejects POST //attacker.test/account with Origin attacker and the action does not run, url() keeps the real host), packages/adapter-node/src/request-target.test.ts (//robots.txt reaches the app on the real origin, absolute form 400). Prism's csrf-probe: all three cases 403, 0 actions. Docs: concepts/security.md 'Request URLs'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Request URLs are origin + raw path everywhere (lumen/node toWebRequest: dev, adapter-node, preview); non-path targets and bad Host get 400; static lookup and redirects use the raw path; raw-socket regression tests; security.md.
<!-- SECTION:FINAL_SUMMARY:END -->
