---
id: TASK-25
title: Implement SPA mode and the client router
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:47'
labels: []
milestone: m-3
dependencies:
  - TASK-18
  - TASK-21
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Highly interactive apps need per-route SPA mode with a client router built on the Navigation API (spec §7.1, §7.5).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 mode='spa' subtrees boot as one root island; ssr=false emits a static shell
- [ ] #2 lumen/router: <Link prefetch>, navigate(), params()/search()/url()/navigating() signals, persistent nested layouts, scroll/focus restoration, client 404, transitions that hold the old page, invalidate()
- [ ] #3 Browser tests for navigation flows
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-23 (Nova): install the router's hooks with setClientNavigation({ navigate, invalidate }) from packages/lumen/src/app/actions/client.ts, so submit() redirect results use client navigation (full navigation for cross-origin locations) and invalidate() re-runs the current page's async components instead of location.reload(). Consider re-running async components after successful submit() in SPA routes.

Lux (decision-20): navigating() must register with the core busy registry.
<!-- SECTION:NOTES:END -->
