---
id: TASK-197
title: '@lumiose/query: optional adapter over @tanstack/query-core'
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 18:14'
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
- [ ] #1 createQuery/createMutation/useQueryClient-equivalents with reactive results; observers unsubscribe with their owner
- [ ] #2 Tests with query-core (dedupe, invalidation, mutations, cleanup); an example in an SPA example app
- [ ] #3 Package README and a docs page; publishable through pnpm release:version
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Names approved (decision-35): package @lumiose/query; exports useQuery, useMutation, useQueryClient, QueryClientProvider (TanStack Solid v5 names) instead of createQuery/createMutation.
<!-- SECTION:NOTES:END -->
