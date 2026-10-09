---
id: TASK-126
title: Emit assets imported only by server-rendered modules into dist/client
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:21'
updated_date: '2026-10-09 04:40'
labels:
  - build
dependencies: []
priority: high
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-107. lumen build renders server/static pages in the ssr environment, whose build does not emit assets (Vite's emitAssets is false for server environments) and writes to dist/server. An asset imported only by a server-rendered module (import photo from './photo.png' in a .stsx route, or a relative <img src> in a .md/.html import rendered on the server) gets its fingerprinted URL (/assets/photo-[hash].png) in the HTML, but the file is never written to dist/client, so it 404s. Reproduced with a static route importing a 10 kB PNG: dist/client has only index.html and 404.html. Islands/client-rendered components are fine (the client build emits their assets).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An asset imported only by server-rendered modules (stsx, .md/.html) is written to dist/client/<assetsDir> with the URL the HTML uses
- [x] #2 No duplicate or conflicting files when the client build also emits the asset; CSS stays as today
- [x] #3 build.test.ts covers a static route importing an image
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: reassigned to Halo (Nova is on the benchmark). Edits in packages/lumen/src/app/production/** and packages/lumen/src/vite/** authorised for this task; Spark (TASK-123, SPA modulepreload) and Photon may be editing nearby — check git diff on those files first and keep hunks separate. TASK-107 stays Done (behaves like .stsx imports); this task fixes both.

Halo (2026-10-09): the ssr environment builds with emitAssets: true, and lumen:build's generateBundle (ssr) moves every emitted asset under assetsDir to the client outDir: same content-hash file names as the client build, so a file the client build already wrote is kept (no duplicates); .css assets are dropped (the client build emits every stylesheet via the CSS manifest), so dist/server has no assets/. build.test.ts 'writes assets that only server-rendered pages import to dist/client, once (TASK-126)' covers a .stsx route import, a relative image in a .md import, an asset shared with an island, CSS count and an empty dist/server/assets; it fails without the change. Docs: concepts/rendering-modes.md (output). Validation: vitest app/production, adapter-node, vite (96 tests), lumen typecheck, oxlint; ssg-travel-journal and ssr-bookshelf build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen build now writes assets imported only by server-rendered modules (.stsx routes, .md/.html imports) to dist/client/<assetsDir> under the URL the HTML uses, once, with CSS unchanged and nothing left in dist/server.
<!-- SECTION:FINAL_SUMMARY:END -->
