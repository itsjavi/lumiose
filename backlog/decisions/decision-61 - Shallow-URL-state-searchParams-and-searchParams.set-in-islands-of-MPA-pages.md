---
id: decision-61
title: >-
  Shallow URL state: searchParams() and searchParams.set() in islands of MPA
  pages
date: '2026-10-15 13:23'
status: accepted
---
## Context

Server-rendered apps often keep interactive state in the URL without reloading: a search box writing `?q=`, a table's sort and page. Before this decision, `lumiose/router` worked only inside `spa` routes. In islands of MPA pages (`static` and `server` routes), `searchParams()` threw, and `searchParams.set()` loaded a new document. The only way to keep such state in the URL was to make the whole page `spa`: the whole page then ships and hydrates, and its data must come from endpoints.

The user compared three directions on 2026-10-15:

- Route loaders, in `spa` routes or in every mode. Declined: decision-18 stays.
- A client router for MPA pages, which would fetch server HTML and swap the outlet. Not now: it reverses decision-24 (full loads, no client router), brings the volatile-state bugs of persistent layouts to every page, and is a large project.
- Shallow URL state for islands. Chosen as the smallest fix.

## Decision

The user approved the API on 2026-10-15. Implemented in TASK-351.

- Outside an SPA, `searchParams()` and `searchParams.set()` from `lumiose/router` work in islands, with the same names and signatures as in an SPA.
- `searchParams()` is a reactive `URLSearchParams` of the document's query. Every island of the document shares one signal.
- `searchParams.set()` writes the URL with `history.pushState()`, or `replaceState()` with `{ replace: true }` or when the URL does not change. It keeps the path, the hash, the scroll position and focus, and loads nothing.
- Back/forward between those entries (`popstate`) update `searchParams()`.
- These changes are not navigations: `beforeNavigate` and `afterNavigate` do not run.
- The server-rendered parts of the page keep the HTML of the URL they were rendered for. A reload, or a shared link, renders the new query on the server.
- During SSR, islands of `server` pages read the request's query, so hydration matches. Islands of `static` pages cannot read it at build time (LUM5001): they use `client:only`, or read it in `onMount()`.
- Inside an SPA, both functions keep their current behaviour, through the router.

## Consequences

- Islands own the query-dependent UI: they get initial data as props from the server page, and fetch further data from endpoints.
- `searchParams` lives in its own module (`app/router/search.ts`), which the router registers itself with while an SPA runs. An island that uses it ships none of the router.
- `params()`, `route()` and `url()` still work only inside `spa` routes. Islands of other routes receive them as props.
- A client router for MPA pages stays possible later. Shallow state would then become a view with the same levels, as in an SPA.

