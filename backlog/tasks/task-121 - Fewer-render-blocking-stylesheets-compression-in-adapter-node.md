---
id: TASK-121
title: Fewer render-blocking stylesheets; compression in adapter-node
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 04:20'
labels:
  - build
  - adapter
  - perf
dependencies: []
priority: medium
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 7. Bookshelf /books loads 9 CSS files (0.2–3 kB each); the SPA shell 6. adapter-node serves HTML and assets uncompressed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each page links one merged stylesheet (or inlines small CSS) without breaking scoping or HMR; measured before/after
- [ ] #2 adapter-node serves precompressed .br/.gz assets built at build time and compresses HTML (opt-out option); docs updated
<!-- AC:END -->
