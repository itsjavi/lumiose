---
id: TASK-167
title: 'Security: adapter-node hardening (from TASK-162 adapter review)'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 12:02'
labels:
  - security
  - adapter
milestone: m-7
dependencies: []
priority: high
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism's adapter review (probes in .local/agents/Prism/prism-20261009T1200Z/adapter/): H1 no request body limit — a 128 MB urlencoded POST without Origin is buffered by formData() (RSS 104→517 MB), endpoints' arrayBuffer() likewise; M1/L4 '//host' and absolute-form targets set the authority (covered by TASK-164; static.ts:73 has the same bug: GET //robots.txt serves index.html); M2 BREACH: on-the-fly compression on reflected input + Set-Cookie — document the risk and the no-transform/compress:false opt-outs; L1 path-scoped lumen({ headers }) rules match the raw URL, not the router's normalized pathname (/x/../admin/page skips the rule); L2 the static index follows symlinked dirs out of dist/client and one unreadable entry empties the whole index; L3 malformed requests (TRACE, bad Host) return 500 with a logged stack — return 400/405/501 without console.error; L5 everything under assets/ is immutable, not only hashed files; L6 /_headers and .br/.gz siblings are directly fetchable; L7 Node default timeouts — document reverse proxy + tuning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 H1: default body limits enforced early (Content-Length) and while streaming (413), for actions and a helper for endpoints — the default values and any public option need the user's approval (pending in chat); implement internals behind a constant until approved
- [ ] #2 L1, L3, L5, L6 fixed; L2: per-entry error handling (never empty the index) and a startup warning for symlinks escaping dist/client (containment by default pending approval); M2 and L7 documented in adapter-node.md/security.md; regression tests for each
<!-- AC:END -->
