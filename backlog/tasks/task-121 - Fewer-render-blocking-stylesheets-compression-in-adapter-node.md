---
id: TASK-121
title: Fewer render-blocking stylesheets; compression in adapter-node
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:54'
labels:
  - build
  - adapter
  - perf
dependencies: []
priority: medium
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 7. Bookshelf /books loads 9 CSS files (0.2–3 kB each); the SPA shell 6. adapter-node serves HTML and assets uncompressed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each page links one merged stylesheet (or inlines small CSS) without breaking scoping or HMR; measured before/after
- [x] #2 adapter-node serves precompressed .br/.gz assets built at build time and compresses HTML (opt-out option); docs updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: reassigned to Halo (Nova is on the benchmark). Edits in packages/lumen/src/app/production/**, packages/lumen/src/vite/** and packages/adapter-node/** authorised. Spark is editing adapter-node and app/production for TASK-125 (headers, static preview): do the stylesheet part first, then compression, checking git diff and keeping hunks separate. Compression must have an opt-out (the fullstack benchmark runs with compression off, doc-4).

Halo (2026-10-09), part 1 (stylesheets), measured with the sample apps' builds (brotli; first view = /, /, / of bookshelf, chiptune, journal; session = visiting 7/4/6 pages with an HTTP cache):
- Before: first view 8/6/8 render-blocking CSS requests, 2.4/2.8/3.6 kB; session 16/11/12 requests, 4.5/4.6/5.4 kB.
- One merged file per page: first view 1 request, 1.6/2.0/2.3 kB; session 7/4/5 requests but 9.4/9.1/9.6 kB (shared CSS re-downloaded per page). Inline everything: 0 requests, 9.4/9.1/11.8 kB per session.
- Chosen: the longest common prefix of every route's stylesheet list merged into one shared, cacheable file; each page's remaining stylesheets inlined in one <style> when <= 4 kB raw, else merged into one file per list. First view 1 request (0.9/2.0/1.6 kB) + 0.8/0/1.0 kB inline; session 1 request, 4.7/3.6/5.5 kB (same bytes as before). After the change, measured pages link 1 file (2 for pages whose own CSS is over 4 kB: bookshelf /books/[isbn], journal posts).
Implementation: packages/lumen/src/app/production/stylesheets.ts (build: merging, inline), app/server/stylesheets.ts (runtime tags), production/plugin.ts renderChunk fills styleTags in the server entry from lumen/vite's new api.cssManifest(context) (options.ts/index.ts); app.ts stylesheetLinks uses it. Tags carry data-l-css; the client preload helper skips covered stylesheets (islands, SPA routes). Cascade order kept (shared prefix first, then the page's own in order); dev unchanged (separate CSS modules, HMR). Tests: build.test.ts (new TASK-121 test + updated expectations), preload-helper.test.ts; Playwright: journal 16, bookshelf 14, chiptune 18, islands-e2e 5 pass; pnpm size OK. Docs: concepts/styles.md, concepts/islands.md.
Part 2 (compression): found in progress, uncommitted, under Nova's claim (.local/coordination/claims/task-121 owned by nova-20261009T040837Z, files packages/lumen/src/app/production/precompress.ts, packages/adapter-node/src/compress.ts, static.ts, server.ts modified 06:39-06:40); not touched, waiting for Lux.

Halo (2026-10-09): part 2 was committed meanwhile as f2c577f + 888a446 (adapter-node brotli/gzip: precompressed .br/.gz from lumen build incl. .html, on-the-fly compression of app responses, compress: false opt-out, docs in reference/adapter-node.md). Verified: adapter-node + precompress tests 21/21; the merged stylesheets of part 1 are written before the precompress step, so they get .br/.gz too. Part 1 commits: 9a3d567 + fix 786f039 (9a3d567 staged some hunks out of place; 786f039 restores the intended content). The claim dir .local/coordination/claims/task-121 belongs to nova-20261009T040837Z and was left as is.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pages link one shared, cached stylesheet (the CSS every page starts with) and inline their own CSS when <= 4 kB, else one merged file; tags carry data-l-css so islands and SPA routes do not reload covered sheets. Sample apps: first view 6-8 CSS requests (2.4-3.6 kB brotli) -> 1 request (0.9-2.0 kB) + 0-1 kB inline; a visit to every page 11-16 requests -> 1, same bytes. adapter-node compression (precompressed .br/.gz, compressed HTML, compress: false) landed in f2c577f.
<!-- SECTION:FINAL_SUMMARY:END -->
