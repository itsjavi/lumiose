---
id: decision-52
title: 'Dev handler for custom servers: createDevHandler()'
date: '2026-10-15 03:14'
status: accepted
---
## Context

A custom server worked only with the build (`dist/server/entry.js`, `createHandler()`, `@lumiose/adapter-node`). `lumiose dev` always listens on its own port, so a project with its own Node, Express or Hono server kept a second setup in dev, and WebSocket upgrades needed a separate Vite plugin there. Proposal: doc-8, feature 7 (TASK-293).

## Decision

User decision, 2026-10-15.

- `createDevHandler(options?)` from `@lumiose/vite/dev`, next to `lumioseDev()`: it starts Vite in middleware mode with the project's `vite.config.ts` and returns the same Node handler as `@lumiose/adapter-node`'s `createHandler()` (a request listener or connect middleware), plus `close()`.
- It behaves like `lumiose dev`: diagnostics overlay, HMR with its WebSocket on the server passed in `options.server`, reloads after server-only edits, typegen.
- One `server.ts` serves both: `createDevHandler()` in dev, `createHandler()` in production. `@lumiose/vite` stays a dev dependency, so production never loads Vite.
- `lumiose dev` stays the default.
- Rejected: a `dev` flag on the adapter's `createHandler()` (the adapter would depend on Vite) and a `lumiose({ server })` option that hosts the project's server.

## Consequences

- The realtime guide's upgrade handling works in dev through the project's own server.
- Implemented in TASK-300.
