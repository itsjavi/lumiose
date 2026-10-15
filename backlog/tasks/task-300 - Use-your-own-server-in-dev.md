---
id: TASK-300
title: Use your own server in dev
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:44'
labels:
  - dev-server
milestone: m-10
dependencies:
  - TASK-293
priority: low
ordinal: 302000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A custom server works only with the build: `dist/server/entry.js`, its `createHandler()` and `@lumiose/adapter-node`. In dev the app runs inside `lumiose dev`, so a project with its own Express, Hono or Node server keeps two setups, and WebSocket upgrades need a separate Vite plugin in dev (guides/realtime.md). React Router lets a custom server mount the dev build through Vite's middleware mode.

Approved shape (decision-52): `createDevHandler(options?)` from `@lumiose/vite/dev`, next to `lumioseDev()`, starts Vite in middleware mode with the project's config and returns the same Node handler as `@lumiose/adapter-node`'s `createHandler()`, plus `close()`, with the overlay, HMR on `options.server`, server-only reloads and typegen of `lumiose dev`. One `server.ts` uses it in dev and `createHandler()` in production; production never loads Vite.

Code: packages/vite/src/app/dev, packages/adapter-node.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A project's own Node server mounts the app in dev with HMR and the error overlay, through a documented API
- [x] #2 The same server file serves production from the build
- [x] #3 The realtime guide's upgrade handling works in dev without a separate Vite plugin
- [x] #4 Tests cover mounting, HMR and shutdown
- [x] #5 reference/adapter-node.md (or a new reference page), guides/realtime.md and the Coming from guides are updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 3).

Nova (2026-10-15), batch 3, implementation:
- `createDevHandler(options?)` in packages/vite/src/app/dev/handler.ts, exported from `@lumiose/vite/dev` with the types `DevHandler` and `DevHandlerOptions` (named after the existing `DevServer`/`DevServerOptions`). Vite runs in middleware mode (`appType: "custom"`) with the project config and `lumioseDev()`; `server` becomes `server.hmr.server`, so HMR upgrades on the project server and Vite ignores other upgrades. The handler is `vite.middlewares` as `(req, res, next?)` (request listener or connect/Express middleware), with `vite` and `close()` (stops Vite; the project server stays open). Options mirror `createDevServer()`: root, configFile, mode, routesDir, logLevel, customLogger.
- Sample examples/ssr-realtime: one `server.ts` (`--dev` uses createDevHandler, else `createHandler()` from the build); the chatSockets Vite plugin is gone; `pnpm dev` runs `node server.ts --dev`. In dev unknown upgrades are left alone (HMR shares the server).
- Tests: packages/vite/src/app/dev/handler.test.ts (app, Vite client and overlay through the project server; HMR socket on it next to the project own /ws upgrade; server-only edit sends the update and the next request renders it; connect middleware with next; close() closes HMR and leaves the server). examples/ssr-realtime Playwright now runs on the build and in dev: 9 passed (SSE, chat, refused handshakes, Vite HMR client connected through server.ts).
- Docs: reference/vite.md (## createDevHandler()), reference/adapter-node.md (one server.ts example), reference/cli.md (pointer), guides/realtime.md (dev through server.ts, no plugin; mistakes), Coming from: react-router.md (custom server in dev row), nextjs.md (custom server next({ dev }) row); sample README.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
createDevHandler({ server }) from @lumiose/vite/dev mounts lumiose dev in a project own Node server (Vite middleware mode: routes, overlay, HMR on that server, server-only updates, typegen) and returns a Node handler like adapter-node createHandler() plus close(); one server.ts serves dev and the build, and the realtime sample WebSockets work in dev without a Vite plugin.
<!-- SECTION:FINAL_SUMMARY:END -->
