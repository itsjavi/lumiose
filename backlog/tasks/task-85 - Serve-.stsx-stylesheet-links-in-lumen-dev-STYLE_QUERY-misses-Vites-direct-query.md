---
id: TASK-85
title: >-
  Serve .stsx stylesheet links in lumen dev (STYLE_QUERY misses Vite's direct
  query)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 20:57'
updated_date: '2026-10-09 04:07'
labels:
  - bug
  - vite
  - css
dependencies: []
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In lumen dev, the server links each route file's style module (`<link rel="stylesheet" href="/src/X.stsx?lumen&type=style&lang.css">`). The browser requests it with `Accept: text/css`, so Vite injects `direct` (`/src/X.stsx?direct&lumen&type=style&lang.css`). `STYLE_QUERY` in packages/lumen/src/vite/styles.ts was anchored as `/\?lumen&type=style&lang\.css$/`, so lumen/vite's `load` hook skipped the id, Vite read the raw .stsx source and served it as `text/css`: every SSR page in dev was unstyled (bookshelf, found by Nova in TASK-36). Builds are fine (CSS manifest).

Nova applied a minimal fix in the working tree (uncommitted, outside Nova's area): `STYLE_QUERY = /[?&]lumen&type=style&lang\.css(?:&|$)/` plus an assertion in src/vite/plugin.test.ts ("serves the scoped CSS of a file…": a `?direct&lumen…` request returns plain CSS with the scope token). The test fails without the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A <link rel=stylesheet> request for a .stsx style module in lumen dev returns the compiled CSS (Vite direct request), with a test
- [x] #2 HMR of linked style modules (t= query) still updates the stylesheet
- [x] #3 The fix is reviewed and committed by the owner
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (owner review, 2026-10-09): Nova's STYLE_QUERY fix (7edfda0) is correct for the initial <link> request. AC #2 did NOT hold: on a style-only edit Vite sends css-update for /X.stsx?direct&lumen&type=style&lang.css, and Vite's client re-requests the link with cleanUrl(path) + ?t=, i.e. /X.stsx?t=… (query dropped), which served the file's JS as the stylesheet: the page lost its styles on every CSS HMR. Fix: lumen/vite adds a pre-transform dev middleware (styles.ts linkedStyleUrl) that puts the style query back on Accept: text/css requests for Lumen files. Test in plugin.test.ts (Linked.stsx): the HMR payload is a css-update of the direct module and an HTTP request for /Linked.stsx?t=… with Accept text/css returns the updated CSS (fails without the middleware); module requests still get JS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Linked .stsx style modules work in lumen dev: the initial <link> request (Vite's ?direct) loads the compiled CSS (Nova's STYLE_QUERY fix, 7edfda0) and CSS HMR of a linked stylesheet now re-serves CSS (dev middleware restores the style query that Vite's client drops). Tests: src/vite/plugin.test.ts (16 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
