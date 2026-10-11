---
id: TASK-229
title: Layout-level export const prerender applies to the pages below it
status: Done
assignee:
  - Nova
created_date: '2026-10-11 02:05'
updated_date: '2026-10-11 02:11'
labels:
  - app
  - build
milestone: m-7
dependencies: []
priority: medium
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-38 amendment (user 2026-10-11): `export const prerender` on a layout applies to every page below it, inherited the same way as `mode` and `ssr` (nearest layout that sets it, then the project default). A page can still opt out with `prerender = false`. TASK-216 reads it from pages only and warns with LUM5002 on layouts. Update the route manifest and typegen, the diagnostics (LUM5002 no longer fires on spa layouts; LUM5006 applies when the inherited prerender meets ssr = false), concepts/rendering-modes.md and the reference pages, and llms.txt. Add tests for a prerendering layout, a page opting out, and nested layouts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A layout's prerender applies to the pages below it, with the nearest setting winning and a page able to opt out with prerender = false
- [x] #2 Diagnostics, the manifest, typegen and docs follow the inherited value, with tests for a layout, an opt-out and nested layouts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-11): manifest.ts resolves a page's prerender as own export, else the nearest layout that sets it, else lumiose({ prerender }) (which still applies only to ssr pages, so ssr = false shells stay shells under the project default). A layout's prerender has no effect (LUM5002, and is not inherited) only when the layout's resolved mode is not spa; spa layouts no longer warn. LUM5006 fires when an explicit prerender = true, own or inherited, meets ssr = false: on the page when it sets prerender or ssr = false itself, else once on the deeper of the two layouts. PageRoute.prerender is the resolved per-page value (TASK-227 can read it; routeOptions() in packages/cli still lacks defaultPrerender, left to TASK-227). Typegen needed no change (routes.d.ts carries no prerender). Docs: concepts/rendering-modes.md, errors/LUM5002.md, errors/LUM5006.md, reference/vite.md, llms-full.txt regenerated; packages/vite/src/options.ts JSDoc (Photon area, one comment line). examples/ssg-spa-e2e now prerenders through its root layout instead of lumiose({ prerender: true }). Tests: manifest.test.ts (layout, opt-out, nested layouts, layout over project default, inherited LUM5006), build.test.ts (layout prerender with an opt-out page and a nested prerender = false/true pair). Checks: lumiose src/app vitest 338/338, @lumiose/vite 130/130, @lumiose/cli 94/94 (docs tests included), typecheck lumiose/vite/cli clean, oxlint clean on touched files, docs:check green, ssg-spa-e2e lumiose check clean and Playwright 8 passed / 2 skipped (by design).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A layout's export const prerender now applies to every spa page below it, inherited like mode and ssr (nearest layout wins, then lumiose({ prerender })); a page opts out with prerender = false. LUM5002 fires only where prerender has no effect (endpoints, static/server layouts and pages); LUM5006 covers an inherited prerender = true meeting ssr = false. Manifest, docs and the ssg-spa-e2e fixture follow; tests cover a prerendering layout, an opt-out and nested layouts.
<!-- SECTION:FINAL_SUMMARY:END -->
