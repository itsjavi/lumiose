---
id: TASK-295
title: Client entry hook that runs before hydration
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 03:16'
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

Approved shape (decision-49): an optional `src/instrumentation.client.ts` (also `.js`, `.mjs`) runs once per document load on every page the app serves, before any island hydrates and before the SPA router starts. The generated island loader and SPA entry (and the CSR start) import it before they start, and pages preload it; pages without islands or SPA routes get a module script with only this file and its imports, without the Lumiose runtime. Its top-level code, top-level `await` included, completes before hydration, while the loader keeps capturing and replaying early input; dev warns above 16 ms; a throw is logged and hydration continues. Server-only imports are LUM4003, and an edit reloads the page in dev.

Code: packages/vite/src/app (entry injection); packages/lumiose/src/dom/loader.ts and packages/lumiose/src/app/router/boot.ts are Spark's area, so coordinate with Spark or have the orchestrator serialize the work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The client module runs once per document load, before any island hydrates and before the SPA router starts, in dev and in builds
- [ ] #2 Async setup is awaited before hydration, and an error in it is reported without blocking the page
- [ ] #3 Tests cover MPA pages with islands, SPA, prerendered SPA and a zero-JS page
- [ ] #4 The docs describe it (concepts/islands.md and concepts/rendering-modes.md or a reference page), and the Coming from guides are updated
- [ ] #5 Pages without islands or SPA routes load the file as one module script without the Lumiose runtime
- [ ] #6 The file may be .ts, .js or .mjs, and dev warns when it takes longer than 16 ms
<!-- AC:END -->
