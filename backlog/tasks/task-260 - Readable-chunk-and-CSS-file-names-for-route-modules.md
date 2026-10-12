---
id: TASK-260
title: Readable chunk and CSS file names for route modules
status: In Progress
assignee:
  - Nova
created_date: '2026-10-12 20:09'
updated_date: '2026-10-12 22:07'
labels:
  - build
  - router
milestone: m-9
dependencies:
  - TASK-253
priority: low
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-253 every page module is page.stsx and every layout layout.stsx, so the client build names their chunks and CSS page-[hash].js, page-[hash].css, layout-[hash].css (before: about-[hash].js, the folder name for index files). Assets still work (hashes differ), but devtools, bundle reports and the build test fixtures can no longer tell pages apart. Consider naming route chunks after their route folder (for example about-page-[hash].js or the pattern with params sanitized) through Rolldown's chunkFileNames/assetFileNames in the client environment. Area: packages/vite/src/app/production (coordinate with TASK-248).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Client chunks and stylesheets of page, layout, not-found and error modules carry a name derived from their route folder
- [ ] #2 Build tests assert the new names; no change to runtime behavior or hashes of unrelated chunks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-13: route modules (pages, endpoints, layouts, not-found, error) are named after their path below the routes dir, each segment reduced to [A-Za-z0-9_-] and joined with '-': blog/[slug]/page.stsx -> blog-slug-page, (app)/dash/[...rest]/page.stsx -> app-dash-rest-page, root page.stsx -> page (packages/vite/src/app/production/chunk-names.ts).
- JS: the client build's chunkFileNames names a chunk whose facade is a route module (spa pages and layouts) assets/<name>-[hash].js; the ssr build's chunks/<name>-[hash].js too, for readable server stack traces.
- CSS: Vite names a chunk's CSS after chunk.name, and the style module of an spa route lands in a shared chunk without a facade (the CSS manifest's entry and the page both import it), so file-name functions cannot reach it. A codeSplitting group with a name function puts each route style module (?lumiose&type=style) in a chunk named after the route; each style module already had a chunk of its own, so chunking is unchanged and CSS hashes stay the same (checked).
- A Vite config that sets its own entryFileNames/chunkFileNames/assetFileNames (top-level or client environment) keeps them: Lumiose then sets no client output naming.
- Merged per-page stylesheets of TASK-121 (stylesheets.ts merge(rest, 'page')) keep the generic name: they group several modules.
- Evidence: new build test (names of page/layout/not-found/error/server page/spa layout+page in a route group with a rest param; the same app with Vite's default names keeps the lumiose/loader/Counter chunk hashes), updated TASK-121/TASK-123 tests; examples/spa-router-e2e build+dev e2e 28/28 (dist: csr-page, users-id-page, users-layout, slow-page...). Its e2e pageModule regex (/page-[hash].js, Spark's file) still matches via 'slow'; its comment is slightly stale.
<!-- SECTION:NOTES:END -->
