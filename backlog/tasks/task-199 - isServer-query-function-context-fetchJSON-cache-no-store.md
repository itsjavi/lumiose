---
id: TASK-199
title: 'isServer, query function context, fetchJSON cache: "no-store"'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-10 20:12'
updated_date: '2026-10-10 20:13'
labels:
  - api
  - data
dependencies: []
priority: medium
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-36 (user-approved 2026-10-10). (1) export isServer from lumiose (Solid's name): false in the browser build, true on the server, a constant the bundler folds so server branches vanish from client bundles; docs use it for defineState factory guards (signal(isServer ? locals().user : null)) and the LUM4003 hint inside factories points to it. (2) query(key, fn) calls fn({ signal, queryKey }) like TanStack's QueryFunctionContext; signal is the shared request's signal. (3) a GET fetchJSON with init.cache === "no-store" bypasses the component cache (plain request, not deduped, not sent in the payload). Per-call staleTime/gcTime: not now.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 isServer exported and folded in client bundles (verified in a built example); docs and the factory LUM4003 hint use it
- [ ] #2 query fn receives { signal, queryKey }; fetchJSON cache: no-store bypasses the cache; tests on server and browser
- [ ] #3 Docs (state, async/data-and-actions, reference) and upgrading notes updated; pnpm check green except the size cap (TASK-200)
<!-- AC:END -->
