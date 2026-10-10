---
id: decision-34
title: 'Async cache keys: the URL for fetchJSON, TanStack-style arrays for query()'
date: '2026-10-10 03:32'
status: accepted
---
## Context

The keyed async cache (doc-6 §B) needs keys for deduplication, caching, invalidation and replay to islands. The user left the key format to the orchestrator (2026-10-10). Prior art: TanStack Query (array keys, stable hashing, prefix invalidation), SvelteKit (`invalidate(url)` re-runs loads that fetched that URL), Next.js (fetch keyed by URL, plus tags).

## Decision

- A GET `fetchJSON` awaited in a component body is keyed by its absolute URL: the common case needs no key at all.
- `query(key, fn)` keys are arrays of JSON-serializable values, hashed stably (object key order ignored); invalidating a key invalidates every key it prefixes, as TanStack Query does.
- Invalidation targets: a URL string (fetchJSON entries) or a key array (query entries); no argument keeps today's whole-page refresh.
- Keys must be serializable because cached results travel to islands in the page payload (decision-33).

## Consequences

- Users who know TanStack Query or SvelteKit recognise both forms.
- `fetchJSON` outside component bodies (handlers) and non-GET requests stay uncached.
- The call syntax (`query`, `invalidate` overloads, `submit({ invalidate })`) stays provisional until the naming audit (TASK-190) and the user's confirmation.
