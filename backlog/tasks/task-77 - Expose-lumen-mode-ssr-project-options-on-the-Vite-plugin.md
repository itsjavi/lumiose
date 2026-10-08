---
id: TASK-77
title: 'Expose lumen({ mode, ssr }) project options on the Vite plugin'
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 16:38'
labels:
  - compiler
  - app
dependencies: []
priority: high
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-21: the project default route mode is set with lumen({ mode, ssr }) in vite.config.ts. The app layer already reads it (app/project.ts projectOptions(): the 'lumen' plugin's api.options), and so do lumen dev/build and, since TASK-28, lumen check/typegen/routes (cli/project.ts). But LumenOptions (packages/lumen/src/vite/index.ts) has no mode/ssr (nor trailingSlash/csrf) and the plugin exposes no api, so lumen({ mode: 'server' }) is a type error and is ignored at runtime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LumenOptions accepts mode ('static' | 'server' | 'spa'), ssr, trailingSlash and csrf, typed with the app layer's types
- [ ] #2 The 'lumen' plugin exposes api: { options } with them, so projectOptions() returns them (dev, build, lumen routes/check)
- [ ] #3 A test: a project with lumen({ mode: 'server' }) lists its routes as server via lumen routes
<!-- AC:END -->
