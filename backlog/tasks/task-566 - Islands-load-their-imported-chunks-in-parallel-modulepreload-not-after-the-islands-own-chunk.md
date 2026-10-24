---
id: TASK-566
title: >-
  Islands load their imported chunks in parallel (modulepreload), not after the
  island's own chunk
status: To Do
assignee:
  - Nova
created_date: '2026-10-24 16:45'
labels:
  - vite
  - islands
  - performance
dependencies: []
priority: medium
ordinal: 558000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the virtualizer trial (TASK-565, 2026-10-24): an island's imports only start loading once its own chunk has loaded. A shared chunk (the virtualizer, used by two islands) arrived last in the import chain, at 2.20 s instead of 1.88 s on slow 4G, so the tracker became usable 0.45 s later (2.55 s against 2.10 s), although its mount costs the same. Fix the loading order: preload each island's static import graph (modulepreload links in the HTML, or the island loader preloading the chunk's deps), without loading islands that the page does not hydrate yet beyond what client:visible/idle allow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a page whose island imports shared chunks, those chunks start loading in parallel with the island's own chunk (a build test checks the preload links or loader map)
- [ ] #2 An alternating A/B on a real app shows the earlier interactive time, with no regression on pages without islands
- [ ] #3 Docs describe how island chunks load
<!-- AC:END -->
