---
id: TASK-94
title: Drop the empty-CSS JS chunks of islands from client builds
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:32'
labels:
  - build
dependencies: []
priority: low
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen build writes one extra JS chunk per island whose only content is '/* empty css */' (56-67 bytes, e.g. dist/client/assets/Search-CRvydMe7.js next to the real Search-BcoBnrLw.js in examples/ssg-travel-journal; SearchBox-CrHPqz-x.js and three more in ssr-bookshelf). No chunk or page imports them, so they are never loaded: dead files in the deploy. Likely Vite's pure-CSS chunk handling of the island style modules (?lumen&type=style&lang.css) in the client environment. Found by TASK-37. Coordinate with Photon if the fix belongs in lumen/vite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A client build of an app with styled islands contains no '/* empty css */' JS chunks, and island CSS links and hydration are unchanged
- [ ] #2 A build test asserts it
<!-- AC:END -->
