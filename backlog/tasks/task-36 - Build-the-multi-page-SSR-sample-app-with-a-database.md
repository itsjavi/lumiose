---
id: TASK-36
title: Build the multi-page SSR sample app with a database
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:53'
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
- [ ] #1 examples/ contains an SSR site using node:sqlite (seeded) with many pages: lists with pagination and search, detail pages, create/edit/delete via form actions, cookie sessions with login, islands for interactive bits, and Suspense streaming for a slow section
- [ ] #2 Runs in lumen dev and builds with the node adapter; type-checks; README; screenshots in backlog/assets
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
<!-- SECTION:NOTES:END -->
