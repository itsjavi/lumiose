---
id: TASK-199
title: 'isServer, query function context, fetchJSON cache: "no-store"'
status: Done
assignee:
  - Nova
created_date: '2026-10-10 20:12'
updated_date: '2026-10-10 20:21'
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
- [x] #1 isServer exported and folded in client bundles (verified in a built example); docs and the factory LUM4003 hint use it
- [x] #2 query fn receives { signal, queryKey }; fetchJSON cache: no-store bypasses the cache; tests on server and browser
- [x] #3 Docs (state, async/data-and-actions, reference) and upgrading notes updated; pnpm check green except the size cap (TASK-200)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-10): implemented in 9c7a8df.
- isServer: export const isServer: boolean = false in src/core/index.ts, true in src/core/server.ts. Fold mechanism: none needed; Rolldown (1.2.12 via Vite 8.3.4) inlines the cross-module constant by default in production builds. Proof: temporary marker in examples/ssr-bookshelf SearchBox island (if (isServer) console.log(marker) and a ternary), lumiose build: the client chunk kept only the client string, the server chunk had both; marker reverted. Permanent check: src/index.test.ts builds a virtual entry against src/index.ts with Vite and asserts server strings are gone (verified it fails when isServer is not a constant). Type is annotated boolean so TS does not narrow branches away.
- query(key, fn) calls fn({ signal, queryKey }); type QueryFunctionContext<TKey> exported from lumiose (TanStack's name). Inside the cache, signal is the flight owner's (=== getAbortSignal() in fn); outside, the current owner's signal or a never-aborting one.
- fetchJSON GET with init.cache === "no-store" bypasses the cache on server and browser (isGet renamed to isCacheable in app/fetch-json.ts). Inside islands the value still goes in the island's await records.
- LUM4003 hint: app/server/browser.ts appends an isServer guard hint to every browser request-API error (no factory detection, to avoid editing core/state.ts during TASK-200); LUM4003.md explains the guard. Registry message unchanged.
- Docs: state.md, reference/reactivity.md (new isServer section), reference/app.md, async.md, data-and-actions.md, LUM4003/4008/4011 docs; upgrading.md unchanged (rename-only page, these APIs are new). llms regenerated.
- Validation: pnpm typecheck, lumiose tests (784), cli docs tests, docs:check, lint (no new warnings) green. Size core+dom (every export): +20 B min, +~0-10 B brotli (10.08 kB either way; cap red from TASK-200).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
isServer exported (false in browser, true on server), folded by Rolldown's default cross-module constant inlining (verified in a built example and by a fold test); query fn receives { signal, queryKey } (QueryFunctionContext type); fetchJSON GET with cache: "no-store" bypasses the component cache; LUM4003 hint and docs use isServer. Commit 9c7a8df.
<!-- SECTION:FINAL_SUMMARY:END -->
