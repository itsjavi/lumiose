---
id: TASK-260
title: Readable chunk and CSS file names for route modules
status: To Do
assignee:
  - Nova
created_date: '2026-10-12 20:09'
updated_date: '2026-10-12 21:45'
labels:
  - build
  - router
milestone: m-9
dependencies:
  - TASK-253
priority: low
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-253 every page module is page.stsx and every layout layout.stsx, so the client build names their chunks and CSS page-[hash].js, page-[hash].css, layout-[hash].css (before: about-[hash].js, the folder name for index files). Assets still work (hashes differ), but devtools, bundle reports and the build test fixtures can no longer tell pages apart. Consider naming route chunks after their route folder (for example about-page-[hash].js or the pattern with params sanitized) through Rolldown's chunkFileNames/assetFileNames in the client environment. Area: packages/vite/src/app/production (coordinate with TASK-248).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Client chunks and stylesheets of page, layout, not-found and error modules carry a name derived from their route folder
- [ ] #2 Build tests assert the new names; no change to runtime behavior or hashes of unrelated chunks
<!-- AC:END -->
