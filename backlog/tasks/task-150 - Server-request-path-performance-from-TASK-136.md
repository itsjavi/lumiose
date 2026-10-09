---
id: TASK-150
title: Server request path performance (from TASK-136)
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 05:35'
labels:
  - perf
  - server
  - adapter
milestone: m-8
dependencies: []
priority: medium
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism's TASK-136 profile of /issues (Lumen ~0.31 ms/request) found: (1) adapter-node static lookup (packages/adapter-node/src/static.ts:68–96) does up to 3 failing async stat() calls per non-asset request (~8% CPU) — index dist/client once at startup (immutable at runtime); (2) the generated production loadModule (app/production/plugin.ts ~353) calls import() per request for middleware/layout/page (2.6–4.3%) — memoize per file; (3) documentRules (app/server/navigation.ts:82) scans the whole shell with includes() (2.3%) — set a flag when a marked link renders; (4) Node<->Web conversion ~10% (toWebRequest: undici Request/Headers + AbortController + close listener per request; sendWebResponse reader loop) — lazy Request and/or a fast path writing rendered chunks straight to res; (5) @bench/data db() resolves the DB path per query (~2%) — cache per env value (Quasar's package, authorised). Prism's prototypes: (1)+(2) gave /issues 3735→5016 req/s, /api 7868→13372. Prototype patch: .local/agents/Prism/task136-1791521148/prototypes.patch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Items 1–3 and 5 implemented with tests; item 4 implemented or measured and documented if not worth it
- [ ] #2 Before/after req/s per route (interleaved, same window) recorded in the notes; adapter-node and app tests green
<!-- AC:END -->
