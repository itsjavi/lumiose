---
id: TASK-197
title: '@lumiose/query: optional adapter over @tanstack/query-core'
status: Done
assignee:
  - Spark
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 18:55'
labels:
  - state
  - data
  - package
dependencies:
  - TASK-192
priority: low
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §E. New optional package packages/query with the names of @tanstack/solid-query (createQuery, createMutation, …): query-core observers write into a store through reconcile (TASK-192); the QueryClient is provided through context (or scoped state once TASK-193 lands). Browser first (SPA and islands); SSR dehydration later. Take the deps lock before adding dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 createQuery/createMutation/useQueryClient-equivalents with reactive results; observers unsubscribe with their owner
- [x] #2 Tests with query-core (dedupe, invalidation, mutations, cleanup); an example in an SPA example app
- [x] #3 Package README and a docs page; publishable through pnpm release:version
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Names approved (decision-35): package @lumiose/query; exports useQuery, useMutation, useQueryClient, QueryClientProvider (TanStack Solid v5 names) instead of createQuery/createMutation.

2026-10-10 Spark (query): packages/query landed (bf0724a) with the example (afe0691). @tanstack/query-core pinned to 5.104.0 (2026-09-26). Design: observers write into a store; data is copied with snapshot() and patched with reconcile() (default key "id"; solid-query's `reconcile` option: key | false | fn), query-core structuralSharing off. The copy matters: a store writes into the object it wraps, and the cache's data is shared by every observer. Options are tracked by one effect (setOptions); a second, untracked effect subscribes and returns the unsubscribe, so observers unsubscribe with their owner and never subscribe on the server (effects don't run there): SSR renders the cached data or pending, no fetch, no dehydration. QueryClientProvider renders the context provider and calls client.mount()/unmount() in onMount. Re-exports all of query-core, like solid-query. Validation: 13 package tests (happy-dom + server), typecheck, lint, docs:gen/check + cli docs tests, pack:check (would publish @lumiose/query@0.1.0), node --test scripts/release.test.ts scripts/pack.test.ts (22 pass), spa-router-e2e Playwright 24/24 (dev + build). Release scripts needed no change: publishable() discovers non-private packages/*.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@lumiose/query: useQuery, useMutation, useQueryClient and QueryClientProvider over @tanstack/query-core 5.104.0, with solid-query v5 names and accessor options. Results are Lumiose stores written through reconcile() (identity kept for unchanged data), options tracked by an effect, observers disposed with their owner, no fetching on the server. Docs: packages/query/README.md and docs/reference/query.md (when to use it vs fetchJSON/query()). Example: examples/spa-router-e2e /query with an e2e spec. Follow-ups (not scheduled): SSR dehydration, Suspense/throwOnError, useQueries/useInfiniteQuery/queryOptions.
<!-- SECTION:FINAL_SUMMARY:END -->
