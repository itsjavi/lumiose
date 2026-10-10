---
id: decision-33
title: 'Scoped state reaches the browser as a page payload, seeded by its factory'
date: '2026-10-10 03:32'
status: accepted
---
## Context

Scoped state (doc-6 §A) must be one instance per request on the server and one per page in the browser, shared by islands. Islands must start from the server's values, or their first render disagrees with the HTML. The user asked for "whatever is common to do in today's modern frameworks, and whatever is safe and performant" (2026-10-10). Prior art: Nuxt `useState(key, init)` and Pinia SSR serialize used state into the page payload and hydrate it; Fresh shares signals passed to several islands; SvelteKit seeds context from server data with devalue.

## Decision

- **Seeding:** the factory runs per request on the server, so it seeds itself from request APIs (`locals()`, `cookies()`, …). No separate seed API.
- **What is sent:** only states instantiated during the request and reachable from client code (island or SPA chunks). A state only server code imports never reaches the browser. Only the signals and stores the factory returns are sent; computeds are re-derived and functions are rebuilt by running the factory in the browser.
- **How:** once per page, keyed by a compiler-assigned id (module + export, like island refs), through the existing serializer and its escaping. Values must be plain data (the island-prop rules). A state first instantiated in a streamed boundary is flushed with that chunk, before the islands in it hydrate.
- **Browser:** the factory runs once per page; the server values replace its signals before any island reads them.

## Consequences

- Everything in a sent state is visible to the browser; the docs say so, as they do for island props.
- Payload stays small: unused and server-only states cost nothing.
- Implemented in TASK-193; the async cache (TASK-195) reuses the same payload for cached results.
