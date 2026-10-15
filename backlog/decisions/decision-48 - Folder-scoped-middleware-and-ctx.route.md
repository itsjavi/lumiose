---
id: decision-48
title: Folder-scoped middleware and ctx.route
date: '2026-10-15 03:14'
status: accepted
---
## Context

`src/middleware.ts` was the only middleware, run for every request. Scoping it meant comparing `ctx.url.pathname` strings, and a layout guard (`locals()` plus `redirect()`) covers its folder's pages but not their form actions or `route.ts` endpoints, so a section such as `/admin` had no safe place for its auth. Routes are matched before middleware runs and `ctx.params` is filled, but the matched pattern was only reachable through `route()`, and `Middleware` took no pattern. Proposal: doc-8, feature 1 (TASK-293).

## Decision

User decision, 2026-10-15.

- A `middleware.ts` in a route folder (the same extensions as `src/middleware.ts`; default export: a function or an array) runs for every request that matches a page, form action or endpoint in that folder or below it, group folders included.
- Order: the trailing-slash redirect and the Origin check answer first, as before; then `src/middleware.ts`; inside its `next()`, the route's locale checks, the folder middleware from the outermost folder to the innermost, and the handler. URLs that match no route run `src/middleware.ts` only.
- `ctx.route` is the matched pattern (the value of `route()`), `undefined` in `src/middleware.ts` for unmatched URLs. `Middleware` becomes generic: `Middleware<"/admin">` types `ctx.params` with the folder's params and `ctx.route` with the patterns below it.
- `src/routes/middleware.ts` is a LUM5002 error pointing to `src/middleware.ts`.
- Folder middleware follows the rule `src/middleware.ts` already follows: per request for server routes and SPA documents, for every route in dev, and at build time for prerendered pages. A folder middleware that covers a prerendered route is a warning in `lumiose check` and the build, since it cannot guard requests there.
- `lumiose routes` prints each route's middleware chain.
- Rejected: an `export const middleware` from layouts and pages (React Router's route-module export), because `spa` layouts and pages are client modules; matchers in `src/middleware.ts`; named middleware listed per page.

## Consequences

- A file named `middleware.ts` under `src/routes` is no longer a colocated module (no migration, decision-47).
- The route manifest gives each page and endpoint a `middleware` list, built like `layouts`; typegen covers folders that have middleware but no layout.
- Implemented in TASK-294.
