---
id: TASK-91
title: 'Size: a real islands app ships 11.5 kB brotli of runtime (10 kB cap)'
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 21:08'
updated_date: '2026-10-08 22:15'
labels:
  - size
  - runtime
dependencies: []
priority: medium
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured on the built bookshelf (TASK-36, `pnpm --filter @lumen-examples/ssr-bookshelf build`, brotli of dist/client/assets): loader entry chunk 7.59 kB (core + DOM runtime + hydrate + loader + Vite's preload helper `__vite__mapDeps`, since the loader is the only static entry and shared modules land in it), shared `dom-*.js` chunk 3.60 kB (includes `submit()`/actionData (`x-lumen-action`, `data-l-action`) and fetchJSON), `attributes-*.js` 0.31 kB; islands themselves 0.4-1.1 kB each. A page with any island loads ~11.5 kB of runtime, above the 10 kB hard cap that "applies to what an app actually ships" (Lux, TASK-12/49); TASK-18 reported 8.68 kB for the synthetic typical app. Islands use signal, ref, onMount, onCleanup, keyed .map lists, class objects, submit and fetchJSON.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Size report includes a real-app row (bookshelf islands or equivalent) with hydration
- [ ] #2 Either the real app fits the 10 kB cap or Lux decides on the budget
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure real builds per chunk/module: scripts/size-apps.ts builds each sample app (lumen build, temp outDir) and splits each client chunk into framework runtime vs app code from its source map.
2. Chunking: one runtime chunk (codeSplitting group), merged into the only client entry when there is one; empty island loader without islands.
3. SPA builds where nothing hydrates (all spa pages ssr=false, no islands): start the router without the island loader and hydration (router/csr.ts).
4. Replace Vite's preload helper with a smaller one.
5. Trim the runtime (router, tree-shaking hygiene), re-measure; CI-style check exits 1 above the cap; docs.
6. Report per-app before/after; Lux decides the budget for whatever stays over.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from Nova, TASK-37): SSG pages ship ~12.4 kB brotli JS and Nova measured the loader chunk alone at ~7.4 kB, but Spark measured the loader at 0.74 kB (TASK-18). The build likely bundles the runtime into the loader chunk, or duplicates it across chunks. Investigate the chunking first (examples/ssg-travel-journal build output).

Spark (2026-10-09): Investigation (scripts/size-apps.ts, source-map attribution). No duplication across chunks; the excess came from (a) Rolldown splitting the runtime into 2-4 shared chunks (loader + dom + attributes; SPA: islands + spa + dom + src) whose import/export lists and separate compression cost 0.5-1.5 kB, (b) Vite's __vitePreload helper (1.6 kB min, ~0.55 kB brotli) in every app, (c) the SPA entry pulling the island loader + hydration + serialize (~2.3 kB brotli) into spa-chiptune although nothing there hydrates (ssr=false, no islands). The 0.74 kB 'loader' figure of TASK-18 is the loader's increment over the runtime it shares; the loader chunk holds that shared runtime.
Before (runtime brotli / app code): ssr-bookshelf 11.01 / 3.14 kB, ssg-travel-journal 9.88 / 2.23 kB, spa-chiptune 15.69 / 25.33 kB.
Commit fadbc30: app/production/client-runtime.ts (new, wired in lumenBuild in plugin.ts: Nova's area, minimal edit after TASK-98 landed) = one runtime chunk + empty loader without islands + smaller preload helper; router/csr.ts + entry.ts CSR start; size-apps.ts (pnpm --filter lumen size:apps, exits 1 above 10 kB); docs (islands, rendering modes). After: bookshelf 9.94 / 3.09, journal 9.07 / 2.24, chiptune 11.21 / 25.22 kB. Validation: typecheck, lint, pnpm test (1023 passed), e2e build projects green: spa-router-e2e 11/11, spa-chiptune 7/7, ssr-bookshelf 14/14, ssg-travel-journal 16/16, islands-e2e 5/5.
<!-- SECTION:NOTES:END -->
