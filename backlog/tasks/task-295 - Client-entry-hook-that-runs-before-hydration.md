---
id: TASK-295
title: Client entry hook that runs before hydration
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:32'
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
- [x] #1 The client module runs once per document load, before any island hydrates and before the SPA router starts, in dev and in builds
- [x] #2 Async setup is awaited before hydration, and an error in it is reported without blocking the page
- [x] #3 Tests cover MPA pages with islands, SPA, prerendered SPA and a zero-JS page
- [x] #4 The docs describe it (concepts/islands.md and concepts/rendering-modes.md or a reference page), and the Coming from guides are updated
- [x] #5 Pages without islands or SPA routes load the file as one module script without the Lumiose runtime
- [x] #6 The file may be .ts, .js or .mjs, and dev warns when it takes longer than 16 ms
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15), batch 2, implementation:
- Every page loads the file first in its head: `<script type="module" src data-l-client>` (builds: plus `<link rel="modulepreload">` for the chunks it imports; dev: `\0lumiose:client`, a wrapper that times it). Handler option `clientEntry: { url, preloads }` (internal), nonce-tagged with csp strict, also on error pages and prerendered pages. Pages without islands or SPA routes load only that module: no runtime (build test + Chromium check).
- Waiting: apps with the file use `packages/lumiose/src/app/client-loader.ts` instead of `lumiose/dom/loader` (dev and build pick it; `lumiose/dom/loader` is untouched, so custom servers and apps without the file pay nothing). It `import()`s the same URL (`clientEntry()` in app/client-entry.ts, one module instance) and gates each island import on it (`afterClientEntry`): islands load and hydrate after its top-level code, TLA included, while the loader already captures input. The SPA entry passes the gate to `startSpa(islands, config, gate)` (boot.ts, new optional param) and `startCsr(config, ready)` (csr.ts, new optional param); generated only when the file exists.
- Failure: a throw is logged ("Lumiose: src/instrumentation.client.ts threw; the page hydrates anyway.") and hydration continues; the browser also reports the module error once.
- Dev: `\0lumiose:client` imports `\0lumiose:client-mark` first, then the file, and warns when evaluation + TLA exceed 16 ms. Adding/removing the file rescans (head tag, loader and SPA entry switch); an edit reloads the page (no HMR boundary).
- Build: the file is an extra client input (`instrumentation`); `islandUrls` returns its URL and import closure. Found a latent bug: with a third entry Rolldown keeps the `spa` entry as a facade over the runtime chunk, and `islandUrls` judged "has SPA pages" by the facade dynamic imports and deleted the SPA entry (prerendered SPA did not hydrate). It now reads the chunk that holds the SPA entry module.
- LUM4003 applies as for any client graph (build test). `.ts`, `.js`, `.mjs`.
- Spark-area edits (allowed by Lux for this task): app/router/boot.ts, app/router/csr.ts, plus one test in app/router/csr.test.ts. dom/loader.ts unchanged.
- Tests: app/client-entry.test.ts (happy-dom: entry resolution and failure, gate, loader capture while waiting, startSpa gate incl. SPA roots), csr.test.ts (startCsr waits), handler.test.ts + csp.test.ts (head tags, nonce), build.test.ts (zero-JS page without runtime, islands page loader, prerendered SPA and server SPA entry, LUM4003), dev-server.test.ts (head tag, timed wrapper, loader switch on add/remove), examples/ssg-spa-e2e Playwright in dev and build (runs once, before the SPA mounts, not on client navigations). Plus a scratch Chromium run (not committed) of an MPA island page with a 300 ms TLA entry: entry finished before the island mounted, two early clicks replayed (count 2); a zero-JS page loaded only the entry chunk; a throwing entry still let the island hydrate.
- Docs: concepts/islands.md (Code before hydration, API row, mistake), concepts/rendering-modes.md, concepts/server.md, reference/dom.md, Coming from: react-router.md (entry.client row), nextjs.md (instrumentation-client.ts row, onRouterTransitionStart row), solid.md (entry-client row).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/instrumentation.client.ts (.ts/.js/.mjs) runs once per page load on every page, first in the head; its top-level code (TLA included) completes before islands hydrate and before the SPA router or CSR start, while the loader captures and replays early input; a throw is logged and hydration continues; zero-JS pages load only it; dev warns above 16 ms; LUM4003 applies. Apps without the file are unchanged (plain loader and SPA entry).
<!-- SECTION:FINAL_SUMMARY:END -->
