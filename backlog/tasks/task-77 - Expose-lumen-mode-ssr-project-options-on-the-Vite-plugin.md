---
id: TASK-77
title: 'Expose lumen({ mode, ssr }) project options on the Vite plugin'
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 16:38'
updated_date: '2026-10-08 16:53'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: blocks TASK-33 AC #1 (create-lumen templates set lumen({ mode: 'static' | 'server' | 'spa' }); today the option is ignored and is a TS2353 in vite.config.ts). When done, remove the pluginTakesMode guard in packages/create/src/create.test.ts and the api.options workaround in packages/lumen/src/cli/cli.test.ts (its vite.config.ts fixture), both marked TODO(TASK-77).
<!-- SECTION:NOTES:END -->
