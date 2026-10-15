---
id: decision-49
title: 'Instrumentation files: instrumentation.server and instrumentation.client'
date: '2026-10-15 03:14'
status: accepted
---
## Context

Nothing ran in the browser before islands hydrate or the SPA router starts (analytics, error-reporting SDKs, polyfills), and nothing reported what happens inside a request or in the browser. Server errors went to the handler's `onError` option, which defaults to `console.error` and which no adapter exposes. Proposal: doc-8, features 2, 5 and 6 (TASK-293).

## Decision

User decision, 2026-10-15. Two optional project files, named after Next.js's `instrumentation.ts` and `instrumentation-client.ts` with Lumiose's suffix rule (the user's change to the proposal). There are no `entry.server` or `entry.client` files: React Router's own rendering and hydration, which Lumiose does not expose (decision-32).

**`src/instrumentation.server.ts`** (also `.js`, `.mjs`; server-only through the `.server.` segment):
- Loaded by `lumiose dev`, `lumiose preview`, `dist/server/entry.js` (any host) and the deploy adapters; not while prerendering, where errors fail the build.
- `register()`: once per server instance (per isolate on workers), awaited before the first request.
- `onRequestError(error, info)`: unexpected errors, in dev too: those masked as 500, streamed-boundary errors, rejected `waitUntil()` work, and errors an `ErrorBoundary` caught (with their `digest`). Not `redirect()`, `notFound()` or `error(status)`. `info` is `{ request, route, params, phase, digest }`, with `phase` one of `"middleware"`, `"action"`, `"endpoint"`, `"render"`, `"stream"`, `"waitUntil"`.
- `instrumentations`: an array of observers with optional wrappers for `request`, `middleware` (each file), `action`, `endpoint`, `render` (until the shell is ready) and `stream` (each streamed boundary). The handler's `onError` option stays, and `@lumiose/adapter-node` gains it.

**`src/instrumentation.client.ts`** (also `.js`, `.mjs`):
- Runs once per document load on every page the app serves, before any island hydrates and before the SPA router starts. Pages without islands or SPA routes get a module script with only this file and its imports, without the Lumiose runtime.
- Its top-level code, top-level `await` included, completes before hydration; the loader keeps capturing and replaying early input. Dev warns when it takes longer than 16 ms. A throw is logged and hydration continues.
- `onError(error, info)`: errors in islands (`"hydrate"`, `"render"`, `"effect"`), the router (`"navigate"`) and `submit()` (`"submit"`).
- `instrumentations`: observers with optional wrappers for `navigate`, `submit`, `fetch` (`fetchJSON` and `query`) and `hydrate` (each island).

**Observer rules (both files):** a wrapper receives `call`, which never throws and resolves to `{ status: "success" }` or `{ status: "error", error }`, plus an `info` object; it cannot change arguments or results, and an error it throws is logged without affecting the app (React Router's model). Unused exports cost nothing: no client code ships for them, and the server adds at most one branch per phase.

## Consequences

- `.client.` is part of the reserved file name only; it does not become a general client-only convention.
- OpenTelemetry stays a docs example, not a dependency; an official package could build on `instrumentations` later.
- Implemented in TASK-295 (client entry), TASK-298 (server) and TASK-299 (client hooks).
