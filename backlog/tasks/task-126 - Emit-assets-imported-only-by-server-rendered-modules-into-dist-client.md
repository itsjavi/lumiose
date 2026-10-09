---
id: TASK-126
title: Emit assets imported only by server-rendered modules into dist/client
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-09 04:21'
labels:
  - build
dependencies: []
priority: high
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-107. lumen build renders server/static pages in the ssr environment, whose build does not emit assets (Vite's emitAssets is false for server environments) and writes to dist/server. An asset imported only by a server-rendered module (import photo from './photo.png' in a .stsx route, or a relative <img src> in a .md/.html import rendered on the server) gets its fingerprinted URL (/assets/photo-[hash].png) in the HTML, but the file is never written to dist/client, so it 404s. Reproduced with a static route importing a 10 kB PNG: dist/client has only index.html and 404.html. Islands/client-rendered components are fine (the client build emits their assets).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An asset imported only by server-rendered modules (stsx, .md/.html) is written to dist/client/<assetsDir> with the URL the HTML uses
- [ ] #2 No duplicate or conflicting files when the client build also emits the asset; CSS stays as today
- [ ] #3 build.test.ts covers a static route importing an image
<!-- AC:END -->
