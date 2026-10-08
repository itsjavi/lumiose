---
id: TASK-46
title: Prepare the data layer for the SSR sample app
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 13:59'
updated_date: '2026-10-08 14:03'
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
- [ ] #1 examples/ssr-bookshelf with a node:sqlite schema (books, authors, users, reviews, reading lists), migrations and a deterministic seed (~200 books, ~60 authors)
- [ ] #2 Server-only modules (src/server/*.server.ts): typed queries (list with search, sort and pagination; detail; author pages; reviews CRUD; reading list), password hashing (node:crypto scrypt), session store backed by signed cookies
- [ ] #3 Vitest tests for queries and auth helpers; README outlining the planned pages and islands
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
<!-- SECTION:NOTES:END -->
