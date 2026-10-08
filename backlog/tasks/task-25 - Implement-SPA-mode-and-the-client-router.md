---
id: TASK-25
title: Implement SPA mode and the client router
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 21:30'
labels: []
milestone: m-3
dependencies:
  - TASK-18
  - TASK-21
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Highly interactive apps need per-route SPA mode with a client router built on the Navigation API (spec §7.1, §7.5).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mode='spa' subtrees boot as one root island; ssr=false emits a static shell
- [x] #2 lumen/router: <Link prefetch>, navigate(), params()/search()/url()/navigating() signals, persistent nested layouts, scroll/focus restoration, client 404, transitions that hold the old page, invalidate()
- [x] #3 Browser tests for navigation flows
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Client table + SPA part of a page (app/router/table.ts): the SPA starts at the outermost spa layout (or the page); every route listed so the router knows what it does not own.
2. Server: spa pages (and _404/_error below an spa layout) render the SPA part as one root island (router/server.ts spaPageTree), ref /<leaf>#lumen:spa (strategy load) or #lumen:csr (ssr=false shell, strategy only, SPA modules not loaded); pages with an SPA load the SPA entry instead of the island loader.
3. SPA entry virtual:lumen/spa (router/entry.ts, boot.ts): route table + lazy imports, runs the island loader with the island manifest + the SPA root refs; dev plugin serves it, build adds it as a client input.
4. Router runtime (router.ts): views, outlets with an off-screen counting boundary (hold until async content settles, swap + URL signals + dispose in one batch), level keys (file + path params), Navigation API + History fallback, scroll/focus, client _404/_error, redirect(), invalidate() via a REVISION context read by async runs/resources, setClientNavigation.
5. Link (prefetch, aria-current) + server variants (index.server.ts, conditional export).
6. Tests: happy-dom router tests, server/table tests, Playwright fixture examples/spa-router-e2e under lumen dev and a build. Docs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-23 (Nova): install the router's hooks with setClientNavigation({ navigate, invalidate }) from packages/lumen/src/app/actions/client.ts, so submit() redirect results use client navigation (full navigation for cross-origin locations) and invalidate() re-runs the current page's async components instead of location.reload(). Consider re-running async components after successful submit() in SPA routes.

Lux (decision-20): navigating() must register with the core busy registry.

Nova (from TASK-24): spa routes with export const ssr = false are still server-rendered by the request handler and lumen dev. The client shell needs a handler option (dev: document + empty root + SPA client entry script in headAssets; build: static shell file) — include it here.

Lux (from Nova): ssr = false SPA shells are still server-rendered by the dev server; fix as part of this task.

Lux: reassigned from Nova (busy with TASK-36) to Spark, who now owns packages/lumen/src/app/router/**. TASK-18 is Done. Integrate with Nova's spa-mode manifest and dev/build (decision-21 lumen({ mode, ssr }), TASK-77 Photon) via notes; app/server and dev files remain Nova's.

Nova (TASK-36), heads-up for shared files: the island loader wiring is committed (2dca70e). app/server/render.ts ServerRendererOptions.loaderUrl and app/server/app.ts BuiltApp.loader (passed to createServerRenderer); app/dev/plugin.ts serves the loader through the virtual module \0lumen:loader (resolveId/load in lumen:dev, loaderUrl `${base}@id/__x00__lumen:loader`); app/production/plugin.ts client input is { loader: <lumen/src/dom/loader.ts> } (was { islands: ISLANDS }) and build.ts islandUrls() returns { islands, loader } (the loader chunk is removed when it has no dynamic imports). SPA entries can sit next to the loader entry in rolldownOptions.input; keep the 'loader' entry name, islandUrls() looks it up by name.

Spark (2026-10-08): implemented. Commits 90ba803 (dom: REVISION context, MISMATCH in hydration.ts), c1f4298 (lumen/router + package.json conditional ./router export, approved by Lux), a1ce8d2 (app wiring + docs), fbc665a (e2e fixture).
- Nova's files touched (approved by Lux, minimal calls into app/router): app/server/handler.ts (spaPagePart/spaErrorPart/spaPageTree in dispatch() and renderError(); new option spaEntry; renderPage(spa) passes loaderUrl), app/server/render.ts (PageRenderOptions.loaderUrl override), app/server/app.ts (BuiltApp.spa → spaEntry), app/dev/plugin.ts (serves \0lumen:spa, invalidates it on route changes, spaEntry URL), app/production/plugin.ts (virtual:lumen/spa client input + spaEntryPlugin; lumenBuild now returns Plugin[]), production/build.ts (SPA entry URL; the loader is kept iff the chunk holding virtual:lumen/islands has lazy imports, since that manifest may now sit in a chunk shared with the SPA entry), production/prerender.ts (shells of ssr=false spa pages without params; 404.html for spa roots too).
- ssr=false: the server does not import the SPA's layouts/page (they may touch browser APIs at module scope), so such pages cannot export action/headers (documented).
- Semantics: a page whose path params change (users/[id]) is a new page (re-created under the hold); query-only navigations keep every level and commit at once (search.set keeps scroll/focus). navigating() spans click → new page on screen; busy() counts it.
- For Nova (follow-ups, not done): (1) submit() could invalidate() after a successful action in SPA routes (your TASK-23 suggestion) — router hooks are installed via setClientNavigation; (2) build.test.ts has no case for an spa app with islands outside the SPA (loader + SPA entry together); the logic is in islandUrls().
- For Lux: pnpm-lock.yaml has the new importer examples/spa-router-e2e (installed under the deps lock; lockfile left for you to commit with the other pending lockfile changes).
- Bundle (fixture build): SPA entry 6.3 kB gz (router, table, loader, control/fetch-json/actions helpers) + shared runtime chunk 8.4 kB gz.
Validation: pnpm typecheck, pnpm lint, pnpm test (955 passed), docs:check + docs tests green; Playwright examples/spa-router-e2e 11/11 under lumen dev and 11/11 against lumen build + lumen preview; islands-e2e 5/5.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/router is available: <Link prefetch>, navigate(), navigating() (busy()), reactive params()/url()/search() with search.set(), persistent nested layouts (children is the outlet), transitions that hold the old page until the new page's async content settles, Navigation API with a History fallback, scroll restoration and focus reset, client _404/_error, redirect(), invalidate() re-running async runs/resources. spa pages render as one root island from the outermost spa layout (SSR + hydration with replayed awaits), ssr = false sends a shell without loading the SPA's modules (prerendered by lumen build, 404.html for spa roots). lumen dev/build generate the SPA entry virtual:lumen/spa. Tests: router.test.ts, server.test.ts, Playwright fixture examples/spa-router-e2e (dev + build). Docs: reference/router.md, routing, rendering modes.
<!-- SECTION:FINAL_SUMMARY:END -->
