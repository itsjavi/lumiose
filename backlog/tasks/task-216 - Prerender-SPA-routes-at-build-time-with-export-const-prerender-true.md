---
id: TASK-216
title: Prerender SPA routes at build time with export const prerender = true
status: Done
assignee:
  - Nova
created_date: '2026-10-10 22:50'
updated_date: '2026-10-11 01:51'
labels:
  - app
  - build
milestone: m-7
dependencies: []
priority: high
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-38 (user 2026-10-11). Today a spa route is either server-rendered per request (needs a server) or an ssr = false shell. Add build-time prerendering: `export const prerender = true` on a spa route (with staticPaths() for params), or `lumiose({ prerender: true })` as the project default, renders it in the build's prerender step and emits HTML that hydrates into the client router. A build whose routes are all static or prerendered needs no dist/server. Typegen, diagnostics (a prerendered route that reads the request, prerender together with ssr = false) and docs follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 export const prerender = true and lumiose({ prerender: true }) prerender spa routes (staticPaths() for params) into HTML that hydrates into the SPA router
- [x] #2 An all-prerendered build emits no dist/server; prerender combined with ssr = false, or a prerendered route reading the request, is a LUM diagnostic
- [x] #3 concepts/rendering-modes, the reference pages and llms.txt are updated, with tests covering hydration and client navigation from a prerendered page
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-11): implemented.
- Route meta reads `export const prerender` (literal true/false). PageRoute gains `prerender: boolean`: own page export, else `lumiose({ prerender })` (CreateRouteManifestOptions.defaultPrerender), only for spa pages with ssr. Layout and endpoint exports, and exports on static/server pages, are LUM5002 warnings (no effect). Layout cascading was not part of decision-38, so it is not implemented (proposal for Lux).
- New LUM5006 (error, registry.rs additive entry authorized by Lux): `prerender = true` on a page whose resolved ssr is false. `lumiose({ prerender: true, ssr: false })` throws in option validation (packages/vite/src/options.ts, Photon's file: additive option only). Under the project default alone, an ssr = false page stays a shell.
- LUM5001 now covers prerendered spa pages (message and docs). Missing staticPaths() on a prerendered spa page with params stops the build (message suggests prerender = false).
- prerender.ts renders spa pages with prerender through the built handler (prerendering guard, fully resolved); static-site.ts no longer needs dist/server for them (form actions still do). Dev and the built app render prerendered spa pages fully resolved, as static ones.
- Typegen: no change to routes.d.ts was needed; the manifest carries prerender, and build/dev pass defaultPrerender.
- Tests: manifest/meta/options unit tests; 4 build tests (hydrating HTML with #lumiose:spa, staticPaths deep links, 404.html, no dist/server; project default + opt-out; LUM5001 + missing staticPaths; LUM5006). New Playwright fixture examples/ssg-spa-e2e (dev + static build via lumiose preview): hydration without console errors, onMount after hydration, client navigation from a prerendered page, deep links with params, unknown URLs -> _404 inside the SPA that still navigates. 8 passed, 2 build-only skipped in dev.
- Docs: concepts/rendering-modes (new 'Prerendered SPA routes' section with the browser-only-code guidance for TASK-217/218), errors LUM5001/LUM5006, reference vite/cli/router, docs README; llms.txt/llms-full.txt regenerated from HEAD docs plus these pages only (Beacon's uncommitted docs edits excluded; llms-full needs regenerating again once Beacon commits).
- Follow-up TASK-227 (Beacon): lumiose routes/check pass defaultPrerender and label prerendered pages.
- Validation: lumiose + vite + cli vitest suites green except docs.test llms-full staleness caused by Beacon's in-flight docs; typecheck green; oxlint clean on touched files; cargo test -p lumiose_compiler green; scripts tests green. pnpm check stops at lint on another worker's benchmarks/js-framework-benchmark/frameworks/keyed/solid-2 and at fmt:examples on spa-chiptune/spa-dotmatrix in-flight files (not mine).
- pnpm-lock.yaml: the new fixture adds an importer (examples/ssg-spa-e2e); left uncommitted for Lux (the lockfile also holds other workers' changes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SPA routes can be prerendered at build time (decision-38): `export const prerender = true` on a spa page or `lumiose({ prerender: true })` for all spa pages (`prerender = false` opts out), with staticPaths() for params. The build renders them through the built handler into HTML that hydrates into the SPA router (#lumiose:spa root island), and an all-prerendered build emits no dist/server. Diagnostics: LUM5006 (prerender with ssr = false), LUM5001 (request APIs while prerendering), LUM5002 warnings where prerender has no effect, and a config error for prerender: true with ssr: false. Docs and an e2e fixture (examples/ssg-spa-e2e) cover hydration, client navigation and deep links.
<!-- SECTION:FINAL_SUMMARY:END -->
