---
id: TASK-36
title: Build the multi-page SSR sample app with a database
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:52'
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
