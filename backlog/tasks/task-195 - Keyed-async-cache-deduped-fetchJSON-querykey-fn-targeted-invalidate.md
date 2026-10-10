---
id: TASK-195
title: 'Keyed async cache: deduped fetchJSON, query(key, fn), targeted invalidate'
status: To Do
assignee:
  - Nova
created_date: '2026-10-10 03:33'
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
- [ ] #1 Two components awaiting the same URL or key make one request, on the server and in the browser; handler calls and non-GET requests stay uncached
- [ ] #2 invalidate(url) and invalidate(keyPrefix) re-run only the matching components; cached keys show at once and revalidate in the background
- [ ] #3 Islands reuse server-fetched entries without refetching; tests cover SSR, hydration, SPA navigation, aborts and errors
- [ ] #4 Docs: async, data-and-actions and reference pages updated
<!-- AC:END -->
