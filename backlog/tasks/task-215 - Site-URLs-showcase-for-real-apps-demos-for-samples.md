---
id: TASK-215
title: 'Site URLs: /showcase for real apps, /demos for samples'
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 22:50'
updated_date: '2026-10-11 02:10'
labels:
  - site
  - seo
milestone: m-7
dependencies: []
priority: high
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): the full apps get indexed, descriptive URLs: /showcase/chiptune-tracker/ (examples/spa-chiptune) and /showcase/dotmatrix/ (examples/spa-dotmatrix). Samples with dummy content move to /demos/travel-journal/ (examples/ssg-travel-journal) and /demos/counter/ (examples/vite-counter), with <meta name="robots" content="noindex"> and no sitemap entries. Old /examples/... URLs get redirect stubs (GitHub Pages has no server redirects: a meta refresh plus a canonical link). Repository folders keep their names. The site's /examples index becomes /showcase plus a demos list; the bookshelf sample needs Node, so it stays repository-only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 build:site serves the two apps under /showcase/<slug>/ and the two samples under /demos/<slug>/, deep links and 404 shells included
- [x] #2 Showcase pages are indexed and listed in the sitemap; demo pages carry noindex and are left out of the sitemap
- [x] #3 Every old /examples/... URL redirects to its new home, and site links, pnpm demo entries and docs point at the new URLs
- [x] #4 Old Dotmatrix share links (/examples/spa-dotmatrix/?song=…) and deep links (/examples/spa-dotmatrix/songs, …/learn/…) open the same song or page under /showcase/dotmatrix/, keeping path, query and hash; an e2e test covers a real share link
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11: the old Dotmatrix URL has been shared publicly, so its redirect must be lossless. Dotmatrix share links carry the whole song in the query string (/?song=…, see examples/spa-dotmatrix/src/model/share.ts). Every old /examples/spa-dotmatrix/<path>?<query>#<hash> must land on /showcase/dotmatrix/<path>?<query>#<hash>: an index.html stub at the old root and the old 404 path (GitHub Pages serves the root 404.html for missing paths, which already routes example deep links) run location.replace() with the rest of the path, query and hash, with a meta refresh and a canonical link as the no-JS fallback. Same mechanism for the other old /examples/... URLs.

Beacon 2026-10-11:
- scripts/site.ts: EXAMPLES now carry their site path and whether they are indexed: spa-chiptune -> showcase/chiptune-tracker/, spa-dotmatrix -> showcase/dotmatrix/ (indexed), ssg-travel-journal -> demos/travel-journal/, vite-counter -> demos/counter/ (every HTML page gets <meta name="robots" content="noindex"> before </head>). Each is built with LUMIOSE_BASE at its new path, so deep links and the per-app 404 shells (root 404.html in-place fallback) work under the new prefixes. Repository folders unchanged.
- Redirects: a stub at each old root (examples/<folder>/index.html: script, then meta refresh + canonical + noindex) and the same script at the top of the root 404.html: below an old prefix it location.replace()s to base + new path + rest of path + search + hash. `node scripts/site.ts redirects --out <dir> [--base]` writes only these (used by apps/web's e2e). The preview server's trailing-slash 301 now keeps the query, like GitHub Pages.
- /examples (apps/web) is now /showcase (routes/showcase/index.stsx: the two apps, then a Demos section with the travel journal, the counter and the bookshelf source); routes/examples/index.stsx redirect()s to /showcase, which the build turns into a meta refresh + canonical + noindex stub. Nav/footer 'Examples' became 'Showcase'; content/showcase.ts split into showcase() and demos(); screenshots moved to public/showcase/<slug>.png. Landing links updated.
- sitemap.xml: every indexable page of the output (not 404 pages, redirect stubs or noindex pages), absolute URLs from --site-url / LUMIOSE_SITE_URL, defaulting on GitHub Actions to https://<owner>.github.io<base>; robots.txt with the Sitemap line only when the base is /. Full build with --base /lumiose/: 99 URLs incl. showcase/chiptune-tracker/* and showcase/dotmatrix/*, no demos/ or examples/ URLs; 29/29 demo HTML files carry noindex.
- Tests: apps/web/e2e/redirects.e2e.ts (11 tests): a real Dotmatrix share link (Maple Hollow encoded with encodeSong) from /examples/spa-dotmatrix/?song=… and without the trailing slash with a hash, deep links (songs, learn/notes?step=2#scales, chiptune songs/3, journal tags, counter), the same below /lumiose/, /examples -> /showcase, and the no-JS stub (refresh, canonical, noindex). Manual end-to-end on the assembled site (pnpm build:site --base /lumiose/ + preview:site): the old share link opens Dotmatrix at /lumiose/showcase/dotmatrix/ with 'Opened the shared song' (backlog/assets/task-215-dotmatrix-share-link.png); old chiptune deep link lands on /lumiose/showcase/chiptune-tracker/songs/. Showcase page: backlog/assets/task-215-showcase.png.
- Checks: lumiose check (web), vitest whole repo (1543 passed), oxlint, oxfmt, node --test scripts/*.test.ts (31), web e2e 25 passed. pnpm check itself could not run: its pnpm install step fails on other agents' new dependencies (ERR_PNPM_IGNORED_BUILDS esbuild, plus vue minimumReleaseAge entries) - reported to Lux; I reverted the pnpm-workspace.yaml edits that run made.
- Left for others: comments naming /examples/<name>/ in examples/*/vite.config.ts, examples/ssg-travel-journal/src/lib/site.ts and spa-chiptune's playwright.pages.config.ts (example owners); pages.yml could pass --site-url ${{ steps.pages.outputs.base_url }} for a custom domain (Photon).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Real apps at /showcase/chiptune-tracker/ and /showcase/dotmatrix/ (indexed, in a new sitemap.xml), samples at /demos/travel-journal/ and /demos/counter/ (noindex, out of the sitemap); /examples became /showcase; every old /examples/… URL, Dotmatrix share links included, redirects losslessly (stubs + root 404 script, meta refresh + canonical without JS), covered by e2e with a real share link.
<!-- SECTION:FINAL_SUMMARY:END -->
