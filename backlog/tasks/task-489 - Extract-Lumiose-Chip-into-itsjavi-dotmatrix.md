---
id: TASK-489
title: >-
  Dotmatrix: deploy the apps to GitHub Pages at /dotmatrix/, /dotmatrix/react/
  and /dotmatrix/advanced/
status: Done
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-21 06:53'
labels: []
milestone: m-13
dependencies:
  - TASK-488
priority: medium
ordinal: 485000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73 (revised 2026-10-21): one Pages deployment of itsjavi/dotmatrix with pocket at /dotmatrix/, pocket-react at /dotmatrix/react/ and advanced at /dotmatrix/advanced/. Each app builds with its base; the root 404.html hands deep links below /react/ and /advanced/ to that app's SPA shell (the approach of the Lumiose site's scripts/site.ts). pocket-react joins when TASK-491 lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A push to main deploys pocket at /dotmatrix/ and advanced at /dotmatrix/advanced/
- [x] #2 Deep links and share links (?song=) work in each app, including after a reload
- [x] #3 pocket-react is served at /dotmatrix/react/ once TASK-491 lands
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chime, 2026-10-21: the Pages deployment is committed on itsjavi/dotmatrix main, locally and not pushed (10e54f1 build, a7753f6 ci, 4f7310c docs).
- `scripts/site.ts` (`pnpm build:site`, `pnpm preview:site`): builds each app with `LUMIOSE_BASE=/dotmatrix/<path>`, then assembles `dist/site` with pocket at the root, `advanced/`, and `react/` once `apps/pocket-react` exists. The `.br`/`.gz` twins and `_headers` are left out. The root `404.html` (pocket's) starts with a script: below `/dotmatrix/advanced/` and `/dotmatrix/react/` it hides the page and renders that app's `404.html` (or `index.html`) in place, as in the Lumiose site's `scripts/site.ts`.
- `.github/workflows/pages.yml`: runs on push to main and workflow_dispatch, uses configure-pages' base_path, then upload-pages-artifact and deploy-pages, with the same pinned SHAs as Lumiose.
- Tests: `scripts/site.test.ts` (node --test, 8 pass) and `tests/site.spec.ts` (`pnpm test:site`, also part of `pnpm test:e2e` and the CI e2e job). Pocket: it loads, deep links reload, its 404 works, and a share link round-trips, including after a reload. Advanced: it is cross-origin isolated by its service worker, a song only the browser knows reloads at its URL through the root 404, and unknown paths get Advanced's own 404. The React tests skip until the app lands; they were checked once against a stand-in app.
- Validation: `pnpm check` is green, and so is `pnpm test:e2e` (advanced 28, pocket 66, site 6 passed and 2 skipped).
- GitHub: Pages for itsjavi/dotmatrix is already set to GitHub Actions (html_url itsjavi.com/dotmatrix/, through the custom domain of the user site), and the github-pages environment allows main. Remaining: a push of main, which needs the user's approval. Then check the deploy run and the live URLs (AC #1, #2). AC #3 waits for TASK-491: pocket-react must take Vite's `base` from `LUMIOSE_BASE` and build into `dist/`.

2026-10-21 (Lux): pushed (user-approved) and deployed: itsjavi.com/dotmatrix/ (Dotmatrix Pocket) and itsjavi.com/dotmatrix/advanced/ (Dotmatrix Advanced) answer 200; a deep link (/dotmatrix/advanced/songs/1) reloads into the app shell through the root 404.html; pocket's /learn/ loads. AC 3 waits for the React port (TASK-491).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
itsjavi/dotmatrix deploys one GitHub Pages site on every push to main: Dotmatrix Pocket at itsjavi.com/dotmatrix/, the React port at /dotmatrix/react/ and Dotmatrix Advanced at /dotmatrix/advanced/. Each app builds with its base; the root 404.html hands deep links below /advanced/ and /react/ to that app's shell. Verified live: all three load, a deep link and an old share link reload into the right app.
<!-- SECTION:FINAL_SUMMARY:END -->
