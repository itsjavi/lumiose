---
id: TASK-98
title: Production builds map island refs of linked packages to their chunk URLs
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 21:51'
updated_date: '2026-10-08 21:57'
labels:
  - bug
  - build
dependencies: []
priority: high
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon while building apps/web (TASK-57). Islands from a linked workspace package (@lumen/site-kit SiteNav, ThemeToggle) hydrate in a lumen build, but every page also gets <link rel=modulepreload href="@lumen/site-kit/src/SiteNav.stsx"> (a 404): islandUrls() in packages/lumen/src/app/production/build.ts only maps chunks inside the root (path not starting with ../), while TASK-74 names modules of linked packages package-relatively. Map those chunks under the same package-relative specifier (the CompileOptions.packages naming).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Island chunks of linked packages map to their built URLs; no modulepreload or island URL uses a bare package-relative ref
- [ ] #2 Covered by a build test with a linked package island
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: assigned to Nova (islandUrls in app/production/build.ts is Nova's), since TASK-74 (Photon) names linked-package chunks package-relatively. Do it after TASK-93/94.
<!-- SECTION:NOTES:END -->
