---
id: decision-18
title: 'Data loading: async components, endpoints and form actions; no route loaders'
date: '2026-10-08 12:13'
status: accepted
---
## Context

Lumen needs one obvious way to load and mutate data across static, server and SPA routes.

Options considered:
- Remix-style route `loader`s add a second data concept next to async components, which were accepted in decision-13.
- RPC "server functions" add hidden network boundaries and serialization risk (the CVE-2025-55182 class).

Decision-16 delegates this technical decision to the architect.

## Decision

**Reading data: async components.**
- Async components are the only built-in mechanism for reading data, on the server and the client.
- Server-only data access lives in `*.server.ts` modules or under `src/server/`, so it cannot leak into client graphs.

**HTTP APIs: endpoints.**
- Endpoints are `src/routes/**/*.ts` files that export `GET` / `POST` / `PUT` / `PATCH` / `DELETE` handlers of the form `(ctx) => Response`.
- SPA and island code calls them with `fetch`, or with the isomorphic `fetchJSON()` helper. During SSR, same-origin requests are served in-process, without going over the network.

**Mutations: form actions.**
- A page exports `action(ctx)`, or named actions via `export const actions = { name: (ctx) => … }`. They receive `FormData`.
- They may return:
  - a `Response` or `redirect()`;
  - data, exposed to the page via `actionData()`;
  - `fail(status, data)` for validation errors.
- `<form method="post">` works without JavaScript. Islands enhance it with `submit()` and `pending()`.
- An Origin/CSRF check is on by default.

**Refreshing after mutations.**
- `invalidate()` re-runs the async components of the current page (SPA), or triggers a navigation reload (MPA).

**Not in v1:** route loaders and RPC server functions.

## Consequences

- There is one reading concept (`async`/`await`) and one writing concept (form actions, or fetch to endpoints), on every route mode.
- Endpoints double as the API for SPA routes and for external clients.
- `fetchJSON()` returns plain data, so awaited results inside islands stay serializable (LUM4007).
