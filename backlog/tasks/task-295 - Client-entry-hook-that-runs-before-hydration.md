---
id: TASK-295
title: Client entry hook that runs before hydration
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
labels:
  - islands
  - spa
milestone: m-10
dependencies:
  - TASK-293
priority: medium
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is no place to run code once in the browser before islands hydrate or the SPA router starts: analytics, error-reporting SDKs, polyfills, global error handlers, and registering client instrumentation. The island loader and the SPA entry are generated, and `src/document.stsx` only renders HTML.

Outcome (shape approved in the design task): an optional project module, such as `src/client.ts`, that runs once per document load before the loader hydrates islands and before the SPA router starts, may await async setup, and is bundled like other client code (server-only imports are LUM4003). Questions for the design: pages that ship no JavaScript today (the hook must not silently add the runtime to them; related to TASK-283), ordering with the island loader and the SPA boot, and HMR in dev.

Code: packages/vite/src/app (entry injection); packages/lumiose/src/dom/loader.ts and packages/lumiose/src/app/router/boot.ts are Spark's area, so coordinate with Spark or have the orchestrator serialize the work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The client module runs once per document load, before any island hydrates and before the SPA router starts, in dev and in builds
- [ ] #2 Async setup is awaited before hydration, and an error in it is reported without blocking the page
- [ ] #3 Pages without islands or SPA routes ship no JavaScript unless the approved design says otherwise
- [ ] #4 Tests cover MPA pages with islands, SPA, prerendered SPA and a zero-JS page
- [ ] #5 The docs describe it (concepts/islands.md and concepts/rendering-modes.md or a reference page), and the Coming from guides are updated
<!-- AC:END -->
