---
id: TASK-300
title: Use your own server in dev
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
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

Outcome (shape approved in the design task): a dev handler that a project's own server mounts in dev, with HMR, the diagnostics overlay and the same request handling as `lumiose dev`, so one `server.ts` serves dev and production.

Code: packages/vite/src/app/dev, packages/adapter-node.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A project's own Node server mounts the app in dev with HMR and the error overlay, through a documented API
- [ ] #2 The same server file serves production from the build
- [ ] #3 The realtime guide's upgrade handling works in dev without a separate Vite plugin
- [ ] #4 Tests cover mounting, HMR and shutdown
- [ ] #5 reference/adapter-node.md (or a new reference page), guides/realtime.md and the Coming from guides are updated
<!-- AC:END -->
