---
id: TASK-215
title: 'Site URLs: /showcase for real apps, /demos for samples'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:50'
updated_date: '2026-10-10 22:51'
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
- [ ] #1 build:site serves the two apps under /showcase/<slug>/ and the two samples under /demos/<slug>/, deep links and 404 shells included
- [ ] #2 Showcase pages are indexed and listed in the sitemap; demo pages carry noindex and are left out of the sitemap
- [ ] #3 Every old /examples/... URL redirects to its new home, and site links, pnpm demo entries and docs point at the new URLs
- [ ] #4 Old Dotmatrix share links (/examples/spa-dotmatrix/?song=…) and deep links (/examples/spa-dotmatrix/songs, …/learn/…) open the same song or page under /showcase/dotmatrix/, keeping path, query and hash; an e2e test covers a real share link
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11: the old Dotmatrix URL has been shared publicly, so its redirect must be lossless. Dotmatrix share links carry the whole song in the query string (/?song=…, see examples/spa-dotmatrix/src/model/share.ts). Every old /examples/spa-dotmatrix/<path>?<query>#<hash> must land on /showcase/dotmatrix/<path>?<query>#<hash>: an index.html stub at the old root and the old 404 path (GitHub Pages serves the root 404.html for missing paths, which already routes example deep links) run location.replace() with the rest of the path, query and hash, with a meta refresh and a canonical link as the no-JS fallback. Same mechanism for the other old /examples/... URLs.
<!-- SECTION:NOTES:END -->
