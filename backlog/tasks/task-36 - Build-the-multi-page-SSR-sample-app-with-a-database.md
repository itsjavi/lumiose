---
id: TASK-36
title: Build the multi-page SSR sample app with a database
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:59'
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
