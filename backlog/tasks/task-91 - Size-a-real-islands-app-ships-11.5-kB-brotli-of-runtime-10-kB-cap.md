---
id: TASK-91
title: 'Size: a real islands app ships 11.5 kB brotli of runtime (10 kB cap)'
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 21:08'
updated_date: '2026-10-08 21:43'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from Nova, TASK-37): SSG pages ship ~12.4 kB brotli JS and Nova measured the loader chunk alone at ~7.4 kB, but Spark measured the loader at 0.74 kB (TASK-18). The build likely bundles the runtime into the loader chunk, or duplicates it across chunks. Investigate the chunking first (examples/ssg-travel-journal build output).
<!-- SECTION:NOTES:END -->
