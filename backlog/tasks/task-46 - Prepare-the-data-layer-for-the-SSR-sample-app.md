---
id: TASK-46
title: Prepare the data layer for the SSR sample app
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 13:59'
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
