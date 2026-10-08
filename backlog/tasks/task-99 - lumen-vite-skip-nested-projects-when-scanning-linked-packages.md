---
id: TASK-99
title: 'lumen/vite: skip nested projects when scanning linked packages'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 21:51'
updated_date: '2026-10-08 21:51'
labels:
  - build
dependencies: []
priority: low
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon (TASK-57): the one-time scan of linked Lumen packages (packages/lumen/src/vite/scan.ts) also covers nested projects inside a package, so building apps/web emits packages/site-kit/showcase's Showcase CSS (assets/Showcase-*.css, unused). Skip directories with their own package.json or tsconfig.json below a linked package, as lumen check does (cli/check/shadow.ts listFiles).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A linked package's nested project (site-kit/showcase) is not scanned; apps/web's build has no Showcase asset
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: assigned to Photon (lumen/vite linked-package scan).
<!-- SECTION:NOTES:END -->
