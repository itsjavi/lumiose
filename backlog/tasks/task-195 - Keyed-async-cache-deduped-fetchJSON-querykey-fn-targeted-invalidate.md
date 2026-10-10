---
id: TASK-195
title: 'Keyed async cache: deduped fetchJSON, query(key, fn), targeted invalidate'
status: Done
assignee:
  - Nova
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 19:55'
labels:
  - state
  - data
dependencies:
  - TASK-190
priority: medium
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §B, decision-34. Component-level GET fetchJSON calls dedupe and cache by absolute URL; query(key, fn) caches anything else under TanStack-style array keys; invalidate(url | keyPrefix) re-runs only the async components that awaited those entries, invalidate() keeps the page-wide refresh, submit() accepts invalidate targets. Stale-while-revalidate with TanStack defaults. Server results reach islands through the page payload (decision-33). Call syntax provisional until TASK-190 and the user's confirmation. Touches the app layer (Nova) and async runs in src/dom/async.ts and src/core (Spark): Lux coordinates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Two components awaiting the same URL or key make one request, on the server and in the browser; handler calls and non-GET requests stay uncached
- [x] #2 invalidate(url) and invalidate(keyPrefix) re-run only the matching components; cached keys show at once and revalidate in the background
- [x] #3 Islands reuse server-fetched entries without refetching; tests cover SSR, hydration, SPA navigation, aborts and errors
- [x] #4 Docs: async, data-and-actions and reference pages updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared cache helpers (src/app/cache/shared.ts): stable hashKey (TanStack, object key order ignored), partial prefix match, one shared in-flight request per entry that callers join with their own AbortSignal (ref-counted: the last waiter to leave aborts it).
2. Browser cache (src/app/cache/client.ts): module-level entries, one version signal per entry read by the awaiting run (dependency tracking through the reactive graph, no core/dom change). Cached data returns at once; stale entries revalidate in the background; arrival bumps the version only when data changed (structural sharing) and a run is showing the old data. Invalidated entries make re-runs wait for the refetch (old UI stays, isPending true). gcTime 5 min after the last run lets go. Seeds from the page payload 'c' record on a miss.
3. Server cache (src/app/cache/server.ts): per request on the StateScope; entries awaited inside islands (incl. SPA trees) are marked and sent in the payload 'c' record next to 's'; server $await records a marker instead of the value for cached awaits (no double send).
4. fetchJSON (both conditions) and query(key, fn) route component-level awaits through the cache; handlers and non-GET stay plain. invalidate(...targets), submit({ invalidate: true | targets }), dev warning for non-URL strings.
5. Tests (SSR, hydration, SPA navigation, aborts, errors), docs (async, data-and-actions, app/reactivity reference, query pointer), examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Syntax approved (decision-35): await query(key, fn); invalidate(...targets) with URL strings or key arrays (variadic), no args = whole page; submit(form, { invalidate: true | Target[] }); dev warning for string targets that don't look like URLs.

2026-10-10 Nova (implementation):
- Files: src/app/cache/{shared,client,server}.ts; fetchJSON (both conditions), query export, invalidate(...targets), submit({ invalidate: true | targets }); server/frame.ts (detached loaders, cachedValues, c:<key> await markers), server/render.ts (payload c), dom/hydrate.ts (DEV-only: no LUM4006 for c: markers).
- Scopes: server = StateScope.cache (per request via runInRequestScope; render-own scope outside requests; per test under Vitest). Browser = module map, reset with resetStates() generation; kept across SPA navigations, gcTime 5 min after the last holding run is disposed.
- Dependency tracking: each browser entry has a core trigger tracked by the awaiting run (like a signal read). invalidate(target) triggers it, so only those runs re-run. No core/dom change.
- SWR result path: an entry with data returns at once (Promise.resolve) and refetches in the background unless its data arrived in the current task (setTimeout-cleared fresh flag, so the re-runs its own arrival causes do not refetch) or the await is a hydrating island's (frame.h). Arrival uses TanStack structural sharing (replaceEqualDeep) and triggers re-runs only when data changed and a run shows the old data. Invalidated entries: re-runs (isPending) wait for the refetch, keeping their UI; new instances show the stale data and refetch. reconcile (TASK-192) not used: an async re-run replaces its subtree anyway, and the data is plain JSON; structural sharing keeps unchanged references for users who reconcile into a store.
- Payload: c record next to s, keyed by URL (same-origin as /path?query, resolved against location in the browser, so proxies with another origin still match) or the query hash. Reachability: entries awaited inside an island frame (SPA pages render inside the SPA root island). Island await records hold "c:<key>": 1 instead of the value for directly awaited cached promises; derived values (fetchJSON(u).then(...)) are still recorded. The browser cache reads payload scripts lazily on a miss (no loader/dom bytes).
- Aborts: one flight per entry with its own owner (getAbortSignal() inside query fns is the shared request's); callers join with their own signal (run lifetime by default); the last waiter leaving aborts the request and clears the entry's flight. Hydration misses are not shared (dom/hydrate track() stubs fetch). Errors never cached: failed first load leaves the entry empty (browser) or drops it (server); failed background refetch keeps data.
- Sizes (brotli): core+dom every export 10,321 B (+0), typical 6,209 B (+0), hydrate path 8,197 B / islands 9,151 B (+0; only a DEV branch changed). App layer: fetchJSON on top of core+dom 581 -> 1,635 B (+1,054 B), fetchJSON+submit+invalidate(+query) 1,700 -> 2,748 B.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Keyed async cache shipped with the approved syntax: component-level GET fetchJSON cached by absolute URL, await query(key, fn) with stable TanStack-style keys, invalidate(...targets) (URL strings exact, key arrays by prefix; no args = whole page, now also refetching every entry), submit({ invalidate: true | targets }), DEV warning for non-URL string targets. Per request on the server (StateScope), per page in the browser (kept across SPA navigations, gcTime 5 min). SWR with TanStack defaults; targeted re-runs through a per-entry trigger the awaiting run tracks. Islands/SPA trees get server entries once via the payload c record; island await records carry c:<key> markers instead of the values. Ref-counted shared flights; errors never cached. Tests: src/app/cache/{client,server}.test.ts, hydrate.test.ts (SSR->hydration without refetch, targeted invalidate across two islands), router.test.ts (cached back navigation), actions client.test.ts (submit targets on SPA/MPA); spa-router-e2e e2e (hydration makes no /api request, invalidate(url), cached back navigation), islands-e2e and ssr-bookshelf e2e green. Docs: async, data-and-actions, islands, reference app (fetchJSON, query, invalidate, submit), reactivity (isBusy), query (when to use @lumiose/query), LUM4007. Commits f413572, 32a0f2d, 2bc4c85. core+dom sizes unchanged; app-layer fetchJSON +1.05 kB brotli.
<!-- SECTION:FINAL_SUMMARY:END -->
