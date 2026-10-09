---
id: TASK-150
title: Server request path performance (from TASK-136)
status: Done
assignee:
  - Nova
created_date: '2026-10-09 05:35'
updated_date: '2026-10-09 05:53'
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
- [x] #1 Items 1–3 and 5 implemented with tests; item 4 implemented or measured and documented if not worth it
- [x] #2 Before/after req/s per route (interleaved, same window) recorded in the notes; adapter-node and app tests green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: (1) adapter-node indexes dist/client once when the static handler is created (path -> stats, with its .br/.gz copies); a miss costs no fs call; files written later are not served (documented; static.test covers it). (2) the generated production loadModule memoizes import() per file (build.test: same promise twice). (3) the server <Link> notes its data-l-prefetch marker in the request scope (notePrefetchLink in scope.ts; Spark's router file touched for that one call); documentRules reads the flag instead of searching the shell, and the prefetch:none stream appends the rules at flush when the flag is set, without scanning chunks; a hand-written data-l-prefetch on a plain <a> no longer counts (routing.md says so); navigation tests updated. (4) measured, not changed: Request construction is ~5-13 µs/request (noisy), ~1/3 for the abort signal; a lazy signal or header pairs would save ~1-2% of a page request and 2-3% of /api but break new Request(request)/clone() following the disconnect signal; recorded in node-http.ts. (5) @bench/data db() returns the open connection without resolving the path while TRACKER_DB is unchanged (data.test covers switching). Before/after req/s, bench Lumen app, interleaved 3 rounds × 4 s per route in one window (before = HEAD with TASK-151, HEAD adapter-node), best / median: / 1196/1165 -> 1233/1216 (+4%); /projects/api?page=3 1230/1215 -> 1354/1327 (+9%); /issues/5982 3899/3717 -> 5350/5226 (+41%); /api/issues/5982 9326/9280 -> 17520/17468 (+88%). Tests: adapter-node 23/23, lumen app/server+router+production 178/178, @bench/data 21/21. Docs: reference/adapter-node.md (static index), concepts/routing.md (marker).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Static index at startup, memoized production loadModule, prefetch-marker flag instead of shell scan, cached DB path; Node<->Web conversion measured and left as is (documented). Interleaved req/s: / +4%, /projects +9%, /issues +41%, /api +88%.
<!-- SECTION:FINAL_SUMMARY:END -->
