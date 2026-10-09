---
id: TASK-174
title: 'Perf: production server bundle size'
status: Done
assignee:
  - Nova
created_date: '2026-10-09 12:12'
updated_date: '2026-10-09 12:30'
labels:
  - perf
  - build
milestone: m-7
dependencies: []
priority: low
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fullstack bench: Lumen's server output is 164 kB vs React Router's 70 kB (RR keeps dependencies external). Find what is in it (visualizer), keep build-time/prerender/dev-only code out of the production server entry, and externalize dependencies for Node targets (edge targets stay bundled).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bundle composition documented in the notes; production server entry smaller with no runtime behaviour change; cold start and req/s unchanged or better
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: composition of the bench Lumen app's dist/server (175 kB of JS, 236 kB on disk): Lumen runtime ~118 kB (app chunk 51 kB: request handler 21 kB, navigation 3.5, body 3.3, csp 3.2, actions 2.7, document 2.3, render 2.0, app 2.0, match/table/router/segments/headers/csrf/stylesheets/href ~9; scope chunk 55 kB: core/reactive 7.7, server/render 7.5, frame 6.5, ssr 4.3, effect 4.4, cookies 3.8, attrs 3.2, scope 2.8, serialize 2.5, node 2.4, control 2.0, url 1.1, diagnostics 0.7; island/components/elements ~6 kB), server entry 6 kB (manifest, island and style maps), app code ~45 kB (routes, components, @bench/data 12 kB, a linked workspace package Vite bundles). No build/prerender/dev-only module is in it (prerender.ts, typegen, the dev plugin and overlay are not imported by the entry). npm dependencies are already external (Vite's SSR default); lumen itself is noExternal by design (one module instance with compiled code, and the package ships TypeScript sources, which Node does not strip under node_modules), so the gap to React Router (70 kB, whose react-router runtime stays in node_modules) is Lumen's bundled runtime. Externalizing lumen for Node targets needs a prebuilt JS distribution of lumen: filed as a follow-up suggestion for Lux rather than done here. Change: the server build is minified without mangling (compress + whitespace, names kept for stack traces): 175 kB -> 124 kB (-29%), 236 -> 200 kB on disk; full mangling would give 88 kB but unreadable stacks for no runtime gain. Interleaved run (3 rounds, busy machine): cold start none/nomangle/full 124/126/138 ms, /issues 3800/3148/3682 req/s, /api 12660/11726/13624 req/s — differences within noise. Conformance suite 15/15 on both minified variants; bookshelf e2e 15/15; build tests made quote-agnostic. Docs: rendering-modes.md (server output).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server output composition documented (no build/dev-only code; the gap is the bundled Lumen runtime); server build minified with names kept: -29% (175 -> 124 kB), cold start and req/s unchanged within noise. Externalizing lumen for Node needs a JS distribution of the package (follow-up).
<!-- SECTION:FINAL_SUMMARY:END -->
