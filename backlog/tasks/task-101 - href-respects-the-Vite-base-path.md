---
id: TASK-101
title: href() respects the Vite base path
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:58'
labels: []
milestone: m-3
dependencies:
  - TASK-21
priority: medium
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beacon found (TASK-57) that the typed href() ignores Vite's base, so apps/web had to write its own link() helper for GitHub Pages builds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 href() prefixes the configured base (dev, build, prerender, SPA router) and honours trailingSlash; apps/web switches back to href(); tests and docs
<!-- AC:END -->
