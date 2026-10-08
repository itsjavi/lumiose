---
id: TASK-37
title: Build the multi-page SSG sample app
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 21:11'
labels: []
milestone: m-6
dependencies:
  - TASK-26
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants to see a static, multi-page site built with Lumen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/ contains a static site (for example docs or a blog) from Markdown content with dynamic routes via staticPaths, tags, RSS and sitemap endpoints, global and scoped styles, $tokens, and one or two islands
- [ ] #2 lumen build outputs static HTML in dist/client that works when served statically; type-checks; README; screenshots in backlog/assets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reassigned to Nova (owner of prerender/build). examples/ssg-* ownership moves to Nova. .md imports (TASK-69) aren't built yet: load the Markdown content with import.meta.glob(…, { query: '?raw', import: 'default' }) plus a Markdown library for now, behind one small content module, so switching to native .md imports later is a one-file change.
<!-- SECTION:NOTES:END -->
