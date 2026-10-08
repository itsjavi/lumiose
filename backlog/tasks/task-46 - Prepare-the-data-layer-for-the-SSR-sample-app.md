---
id: TASK-46
title: Prepare the data layer for the SSR sample app
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 13:59'
updated_date: '2026-10-08 14:22'
labels: []
milestone: m-6
dependencies:
  - TASK-23
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The SSR sample (TASK-36) needs a realistic database and domain layer that doesn't depend on the compiler. Building it now uses Nova's time while the compiler pipeline is completed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 examples/ssr-bookshelf with a node:sqlite schema (books, authors, users, reviews, reading lists), migrations and a deterministic seed (~200 books, ~60 authors)
- [x] #2 Server-only modules (src/server/*.server.ts): typed queries (list with search, sort and pagination; detail; author pages; reviews CRUD; reading list), password hashing (node:crypto scrypt), session store backed by signed cookies
- [x] #3 Vitest tests for queries and auth helpers; README outlining the planned pages and islands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Scaffold examples/ssr-bookshelf (private workspace pkg, tsconfig extending base with types:[node], .gitignore data/); take deps.lock for pnpm install.
2. db.server.ts: node:sqlite DatabaseSync, pragmas (WAL, foreign_keys, busy_timeout), user_version migrations, FTS5 book_search kept in sync by triggers, statement cache, transaction helper, getDatabase() singleton (BOOKSHELF_DB or ./data/bookshelf.db).
3. seed.server.ts: mulberry32 PRNG, genre vocabularies -> ~200 books (ISBN-13 with check digits), ~60 authors with bios, ~40 users (scrypt), ~600 reviews, reading lists; CLI with --if-empty.
4. password.server.ts (scrypt hash/verify, params in the hash string) + auth.server.ts (register/authenticate, hashed session ids in a sessions table, signedCookie session cookie, sliding renewal, revoke, currentUser, requireUser -> redirect(/login?next=), safe next).
5. queries.server.ts: createQueries(db) + queries() accessor: listBooks (FTS5 search, genre filter, sort title/newest/oldest/rating/relevance, offset pagination + total), getBook (authors, rating summary + histogram), listReviews, author pages, genres, review CRUD with ownership results, reading list, users, featured/trending, slow recommendationsFor.
6. src/types.ts + src/lib/{pagination,validation}.ts shared with pages/islands.
7. Vitest tests (in-memory DB, full seed with cheap scrypt params) + README site map. Validate pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-task46-20261008T140040Z): claimed and started. node:sqlite in Node 26.8.1 bundles SQLite 3.53.4 with FTS5 available, so search uses an FTS5 table (bm25 relevance) instead of LIKE.

Nova: implementation done in examples/ssr-bookshelf (private workspace pkg @lumen-examples/ssr-bookshelf; pnpm install under deps.lock added only its importer to pnpm-lock.yaml).
- Decisions: books keyed publicly by ISBN-13, authors/genres by slug; one genre per book; ISO-8601 UTC text timestamps; sessions store SHA-256(token) so the DB never holds live tokens; 30-day sliding sessions (renew past half life); rating sort and featured use a Bayesian average (prior 5 reviews at the global mean); trending defaults its window end to the newest review so the fixed-date seed stays lively; recommendationsFor delay = BOOKSHELF_SLOW_MS (default 1500) and accepts an AbortSignal.
- Shared client-safe modules beyond the brief: src/lib/{pagination,search-params,validation}.ts (page math + pageWindow, URL<->BookFilters, form validators reused by actions and islands).
- tsconfig uses types [node, lumen/env]: lumen/env is required because packages/lumen/src/dom/component.ts (Spark, uncommitted TASK-17 work) now reads import.meta.env.DEV; without lumen/env any consumer program fails TS2339. The same change currently breaks 3 root tests (lumen typegen.test, public-api.test, check.test) that type-check fixtures without lumen/env.
- Root vitest.config.ts only lists packages/*, so root 'pnpm test' does not run example tests; proposed to Lux: add examples/* to projects (root config is Lux-owned).
- Evidence: example vitest 69/69 (lib 7, queries 31, auth 21, seed 10); example tsc clean; oxlint clean for the example (only pre-existing router stub warning repo-wide); oxfmt --check clean; seed CLI creates data/bookshelf.db (200 books/60 authors/40 users/600 reviews/262 reading-list rows) in ~0.7 s; data/ is gitignored (git check-ignore verified). Root pnpm typecheck fails only in packages/vscode (Beacon, TASK-29 in progress).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Data/domain layer for the SSR sample (examples/ssr-bookshelf), ready for TASK-36 pages.
- db.server.ts: node:sqlite DatabaseSync, 3 user_version migrations (genres, authors, books, book_authors, FTS5 book_search kept in sync by triggers; users, sessions; reviews with CHECK 1-5 and UNIQUE(book,user), book_ratings view, reading_list), WAL + foreign keys, cached prepared statements, nested-safe transaction(), shared getDatabase().
- seed.server.ts (+ seed-data.server.ts): deterministic mulberry32 seed: 12 genres, 60 authors with bios, 200 books (valid ISBN-13), 40 users (password 'bookshelf', demo reader@example.com), 600 reviews, ~260 reading-list rows; CLI 'node src/server/seed.server.ts [--if-empty]'.
- queries.server.ts: listBooks (FTS5 prefix search with bm25 weights, genre/author filters, title/newest/oldest/rating/relevance sort, offset pagination with totals), getBook (+histogram), featured/trending, slow abortable recommendationsFor, genres, authors, reviews CRUD with not-found/forbidden/conflict results, reading list, users.
- password.server.ts (scrypt, params in hash) and auth.server.ts (register/authenticate, hashed-token session table, signedCookie session cookie with sliding renewal and revocation, currentUser, requireUser -> redirect(/login?next=), safeRedirectPath, Locals.user augmentation).
- src/types.ts + src/lib/* shared with islands; README with site map, modes, actions, islands and Suspense plan.
- 69 Vitest tests. Follow-ups for Lux: include examples/* in root vitest projects; Spark's import.meta.env.DEV in dom/component.ts needs lumen/env in consumer tsconfigs (breaks 3 lumen type tests now).
<!-- SECTION:FINAL_SUMMARY:END -->
