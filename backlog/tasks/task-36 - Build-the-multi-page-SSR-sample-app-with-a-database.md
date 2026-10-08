---
id: TASK-36
title: Build the multi-page SSR sample app with a database
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 21:09'
labels: []
milestone: m-6
dependencies:
  - TASK-46
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants to see a multi-page, server-rendered site backed by a database.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 examples/ contains an SSR site using node:sqlite (seeded) with many pages: lists with pagination and search, detail pages, create/edit/delete via form actions, cookie sessions with login, islands for interactive bits, and Suspense streaming for a slow section
- [x] #2 Runs in lumen dev and builds with the node adapter; type-checks; README; screenshots in backlog/assets
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Nova:
1. Pages per README site map: /books (exists; filters/sort/pager), /books/[isbn] (paginated reviews, create/edit/delete own review via named actions, reading-list toggle), /authors (+ name filter, pager), /authors/[slug], /genres and /genres/[slug] (static, staticPaths), /register, /reading-list (+ toggle action), /profile, /api/me, _error.
2. Islands: SearchBox (client:load, /api/search), ReadingListToggle (client:visible, submit()/submitting()), StarRatingInput (client:visible, radio group), AccountMenu (client:idle, /api/me on static pages). Each falls back to a plain form/link without JS. Hydration depends on TASK-18: verify SSR output (markers, records) and hydrate if the loader is available.
3. Scoped styles with $tokens from a theme module; keep a small global stylesheet.
4. Suspense recommendations (exists) kept; lumen build + adapter-node run.
5. Playwright e2e across key flows (browse/search/filter/paginate, detail, register, login, review CRUD, reading list, profile, authors, genres, 404, streaming), screenshots to backlog/assets/task-36-*.png, README update.
6. File framework bugs as tasks for their owners.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESUME (Nova, session nova-task71-20261008T162824Z, checkpoint requested by Lux):
- Done before this task: TASK-71 (Done), TASK-26 CSS links (Done: built pages link stylesheets from virtual:lumen/css-manifest; bookshelf build verified: about/index.html links /assets/styles-*.css).
- TASK-36 progress: planning only; no TASK-36 source files changed yet. Read the data layer (queries/auth/validation/pagination/search-params), existing routes and docs (actions, islands, styles/$refs).
- Exact next steps: follow the plan above. Design notes: src/theme.ts tokens (as const) read as $theme.* in scoped <style> blocks; trim src/styles.css to base. Pager.stsx (pageWindow), reviews pager on /books/[isbn] via ?page=, named actions createReview/updateReview/deleteReview (requireUser(ctx), validateReview, map forbidden->error(403), not-found->notFound(), conflict->fail(409)) then redirect to /books/:isbn#your-review. ReadingListToggle: form posts /reading-list?/toggle with hidden bookId + next (no-JS: redirect(safeRedirectPath(next))); the enhanced path calls submit({ bookId }, { action: '/reading-list?/toggle' }) without next and reads { onList }. AccountMenu fetches /api/me in onMount only (static pages render the Sign in link). Island loader: Spark's dom/loader.ts exists (untracked, TASK-18 WIP); wiring it into dev headAssets/build is Nova's job once TASK-18 settles.
- Known failing tests (not mine): examples/vite-counter/src/__probe.test.ts (untracked probe); oxlint error in examples/vite-counter/__probe.config.ts.
- Files touched this session (all TASK-71/TASK-26, uncommitted): packages/lumen/src/server/{node,attrs,frame,ssr}.ts, server/{ssr,render}.test.ts, contract/server.ts, app/production/{plugin,build.test}.ts, app/server/app.ts, packages/compiler/test/server.test.ts, benchmarks/ssr/{RESULTS.md,scripts/bench.ts}. examples/ssr-bookshelf/dist was rebuilt (build output).

Nova (session nova-task36-20261008T203608Z): resumed; claim acquired. Building pages/islands per plan; also wiring the island loader into the renderer (dev + build).

Spark (TASK-18 done) for Nova's loader wiring: the islands e2e (examples/islands-e2e) showed Chromium 153 parses <?start name=…>/<?end> as ProcessingInstruction nodes and applies <template for> natively; dom/islands.ts now waits on both forms. Keep the loader script async (islands hydrate while the stream is open; verified by the e2e). Once loaderUrl lands, examples/islands-e2e/server.ts can pass loaderUrl to renderToStream instead of writing the script tag itself (tell Spark or do it in passing).

Nova (session nova-task36-20261008T203608Z), solo on TASK-36:
- Commits: 2dca70e feat(app) island loader in pages with islands (renderToStream loaderUrl; dev virtual module \0lumen:loader; build client entry 'loader', BuiltApp.loader; tests in server/island.test.ts, app/dev/dev-server.test.ts, app/production/build.test.ts); d23095c feat(bookshelf) pages/actions/islands/styles; bf8b072 docs (islands.md loader section + status, rendering-modes status, reference/server.md loaderUrl, docs README status table, llms regenerated); 5e706a7 test(bookshelf) e2e + README.
- AC #1 evidence: routes /, /books (q/genre/sort/pager), /books/[isbn] (histogram, paginated reviews ?page=, named actions createReview/updateReview/deleteReview: requireUser, validateReview -> fail(400), conflict -> fail(409), forbidden -> error(403), not-found -> notFound()), /authors (+ name filter, pager), /authors/[slug], /genres + /genres/[slug] (static, staticPaths), /about, /login, /register, /logout, /reading-list (+ toggle action, next for no-JS), /profile, /api/search, /api/me, _404, _error. Islands (src/islands): SearchBox client:load, ReadingListToggle client:visible (submit()), StarRatingInput client:visible (validateReview on submit), AccountMenu client:idle (/api/me). Suspense recommendations streamed. Scoped styles: component-root or file-level blocks (works under decision-23 either way), $theme tokens from src/theme.ts; src/styles.css base only.
- AC #2 evidence: lumen dev: every route answers (200/302/404) and all four islands hydrate in Chromium (search suggestions, toggle without navigation, star hover + rating hint, account menu on /about), no LUM4006/console errors. lumen build: 15 files prerendered (about, genres x13, 404); adapter-node server.ts serves it; Playwright e2e/bookshelf.e2e.ts 14/14 pass (3 consecutive runs) incl. hydration (LUM4006 fails a test) and a javaScriptEnabled:false suite. Typecheck: package typecheck is now 'lumen check' (tsconfig jsx/jsxImportSource/rootDirs/.lumen includes); No problems found. README rewritten (site, styles, actions, islands, e2e). Screenshots: backlog/assets/task-36-{home,books,search,book,review-errors-no-js,reading-list,profile,author,authors,about-account-menu}.png (BOOKSHELF_SCREENSHOTS=1 pnpm test:e2e).
- Framework bugs filed: TASK-85 (Photon) lumen dev served raw .stsx as text/css for <link> stylesheet requests (STYLE_QUERY missed Vite's ?direct): every SSR page was unstyled in dev. Minimal fix applied in the working tree, uncommitted (packages/lumen/src/vite/styles.ts + plugin.test.ts assertion; outside my area) for Photon to review/commit. TASK-86 (Photon) LUM2001 false positives in server route components (queries() from *.server.ts, url().searchParams, locals().user); pages pass data to child components as a workaround. TASK-91 (Spark) real-app runtime with hydration 11.5 kB brotli (loader chunk 7.59 + dom chunk 3.60 + 0.31) vs the 10 kB cap.
- Notes: the APIRequestContext (page.request) does not send the session cookie to 127.0.0.1 (Secure cookie over http), so the 403 test posts with fetch() from the page. Native textarea 'required' runs before the rating hint, so the hint shows once the review text is filled.
- Validation: pnpm typecheck clean; pnpm lint 0 errors (1 warning in app/router/index.ts, TASK-25 WIP, not mine); pnpm test 897 passed, 18 failed, all in packages/language-server/src/server.test.ts ('Connection is closed', TASK-80/Beacon + in-progress compiler changes; no TASK-36 files involved); lumen app+server suites 382/382, vite plugin 14/14, docs tests 16/16, bookshelf vitest 69/69.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
examples/ssr-bookshelf is a complete multi-page SSR site on node:sqlite. It covers books (search, genre, sort and a pager), book detail (ratings, paginated reviews, create/edit/delete your own review through named actions), authors, prerendered genre pages, register/login/logout with cookie sessions, the reading list, the profile, streamed recommendations and the error pages.
- Four islands hydrate in lumen dev and in the build: live search, reading-list toggle, star rating input with shared validation, and the account menu on static pages. Each one falls back to a plain form or link without JavaScript.
- Framework: pages with islands now get the island loader in dev and build (renderToStream loaderUrl), with tests and docs.
- Evidence: 14 Playwright e2e tests on the adapter-node build (including a no-JS suite), lumen check clean, README, and screenshots in backlog/assets/task-36-*.png.
- Filed: TASK-85 (dev stylesheet links, fixed in the working tree for Photon to commit), TASK-86 (LUM2001 false positives), TASK-91 (runtime size of a real islands app).
<!-- SECTION:FINAL_SUMMARY:END -->
