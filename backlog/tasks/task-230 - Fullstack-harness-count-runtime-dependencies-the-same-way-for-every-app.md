---
id: TASK-230
title: 'Fullstack harness: count runtime dependencies the same way for every app'
status: Done
assignee:
  - Quasar
created_date: '2026-10-11 02:05'
updated_date: '2026-10-11 02:40'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Quasar's TASK-202/203 finding: 'Production dependency packages' follows each template's package.json. SvelteKit lists everything as devDependencies (as sv create does), so it reads 0, while SolidStart reads 177, and both builds run without node_modules. Redefine the metric as the packages the production server actually loads from node_modules at runtime: trace the bare imports of the server output, transitively through the resolved packages, the same way for every app. Keep the client JS payload metrics as they are. Update doc-4 and the viewer label.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The metric counts the packages the production server loads at runtime, measured the same way for all apps, with the method in doc-4
- [x] #2 Values for every app are checked by hand against a manual trace on at least two apps
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar 2026-10-11: new metric other.runtime-deps ('Packages the production server loads at runtime'), replacing other.deps (package.json closure, removed with dependencyCount). harness/src/trace-loads.ts is preloaded into the start script via NODE_OPTIONS=--import and records every file the server resolves (module.registerHooks, import and require); runtimeDependencies() in measure.ts loads /, /projects/:slug, /issues/:id in a browser and requests /issues/new, /search, /login, both JSON endpoints and a 404, then maps files to packages (after the last node_modules/, or the nearest named package.json for workspace packages), excluding the app, its build output and files outside the repo. bench.ts builds first when --skip-conformance. Values on 2026-10-11: Lumiose 2, React Router 75, Next 7, SolidStart 0, SvelteKit 0, Nuxt 21, Remix 3 41. Hand checks: Nuxt = the 21 dependencies in .output/server/package.json; SvelteKit and SolidStart outputs import only node: builtins; Lumiose server.ts -> @lumiose/adapter-node -> lumiose (no deps) = 2; React Router's 7 bare imports have a 75-package static dependencies closure (differs by scheduler / supports-color). Method and checks in doc-4 §4; SvelteKit's §8 dependency caveat rewritten. Checked: harness tsc, oxlint, oxfmt; bench --quick --metrics other on sveltekit,remix records the metric (result discarded).
<!-- SECTION:NOTES:END -->
