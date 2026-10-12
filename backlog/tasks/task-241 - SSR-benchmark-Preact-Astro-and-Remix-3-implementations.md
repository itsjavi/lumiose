---
id: TASK-241
title: 'SSR benchmark: Preact, Astro and Remix 3 implementations'
status: Done
assignee:
  - Nova
created_date: '2026-10-11 03:48'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For the stack table's 'Rendering' column (decision-37 amendment, user 2026-10-11). Add implementations of the SSR benchmark page (src/data.ts, the same elements, classes and escaping) for Preact (preact-render-to-string), Astro (the Container API rendering .astro components to a string) and Remix 3 (its component model's server render). Use the latest stable versions (decision-41), compile each with its own toolchain as its bundler plugin would, and make each pass scripts/run.ts's output checks. Smoke only: the user's machine is busy, and the full run belongs to TASK-235. Document any method caveats, such as async renderers or framework overhead, in RESULTS.md's method notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Preact, Astro and Remix 3 render the same page, pass the output checks and are pinned to their latest stable versions
- [x] #2 Method caveats are documented; no RESULTS.md regeneration (TASK-235 runs it)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-11): entries landed in c595508.
- Versions (latest stable, pinned exactly): preact 11.0.1 + preact-render-to-string 6.8.0, astro 7.3.8, remix 3.0.0.
- Preact: src/preact/Page.jsx (the React page with class), Oxc automatic runtime importSource preact (as @preact/preset-vite), sync renderToString.
- Astro: src/astro/*.astro (Page, Row, Tags, Badge with a slot, Summary), built by vite build with astro/config getViteConfig (Astro's own compiler-rs plugin) as an SSR build of Page.astro; the astro runtime stays external so it is shared with experimental_AstroContainer. render = container.renderToString(Page, { props }) (async, partial; goes through Request/Response.text()). A full build bundling the container failed at runtime (the @@ASTRO_MANIFEST_REPLACE@@ placeholder is only filled by astro build), hence the external runtime.
- Remix 3: src/remix/Page.jsx with setup/render components (handle.props), Oxc automatic runtime jsxImportSource remix/component, exactly the remix/node-tsx transform, ahead of time. renderToString (remix/component/server) drains renderToStream and strips flush markers (async).
- Output: all three pass scripts/run.ts checks. Astro escapes > and ' in text; Remix writes data-id before class.
- Method caveats added to the RESULTS.md template in scripts/bench.ts (not regenerated).
- Smoke (busy machine, 1 round x 1 run x 500 ms, scratch output; not results): Solid 583, Lumiose 448, Svelte 404, Preact 145, Vue 143, Astro 137, React 113, Remix 3 34 renders/s.
- pnpm-lock.yaml not committed: the install also recorded Quasar's untracked benchmarks/fullstack/apps/astro importer, so Lux commits it with that app.
Only TASK-235's measuring run remains.

Lux 2026-10-12: measured in the quiet-machine SSR run (ef81f5b): Preact 237, Astro 201, Remix 3 45 renders/s.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preact, Astro and Remix 3 SSR entries measured on 2026-10-12 and shown on the landing.
<!-- SECTION:FINAL_SUMMARY:END -->
