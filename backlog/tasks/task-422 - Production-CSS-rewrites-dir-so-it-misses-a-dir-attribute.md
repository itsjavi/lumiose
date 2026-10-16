---
id: TASK-422
title: 'Production CSS rewrites :dir() so it misses a dir attribute'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:39'
updated_date: '2026-10-16 04:24'
labels:
  - build
  - css
milestone: m-12
dependencies: []
priority: medium
ordinal: 420000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-385 (2026-10-16). The production minifier, Lightning CSS, rewrites `:dir(rtl)` for the configured CSS targets, and the rewrite misses an element whose direction comes from a `dir` attribute. Those rules work in dev only. @lumiose/ui now avoids `:dir()`, but users' own CSS hits the same bug. Raise the targets so `:dir()` passes through (every supported browser has it), or stop that one transform, and add a build test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `:dir(rtl)` in a component's CSS matches under a `dir` attribute in a production build, with a test
- [x] #2 The supported-browsers docs and the CSS targets agree
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 9 (no Spark or Photon session is running; it may edit the files the fix needs).

2026-10-16 (Beacon): Cause: @lumiose/vite left Vite 8's default CSS target (Baseline on 2025-05-01: Chrome and Edge 111, Firefox 114, Safari 16.4), and Chrome before 120 lacks `:dir()`, so Lightning CSS (Vite's production CSS minifier) lowered it to `:lang()` lists. Fix: the plugin's config hook sets `build.cssTarget` to Baseline widely available on 2026-10-01 (Chrome and Edge 123, Firefox 124, Safari and iOS 17.4, from baseline-browser-mapping 2.11.27), unless the project sets `build.cssTarget` or `build.target` (packages/vite/src/index.ts CSS_TARGET). The JS target stays Vite's default (older, so it still covers the documented browsers). Test: plugin.test.ts 'keeps :dir() in production CSS, unless the project sets its own target (TASK-422)' builds a component whose style block has `.arrow:dir(rtl)`: the minified CSS keeps `:dir(rtl)` and has no `:lang(`; with `cssTarget: ["chrome111"]` (Vite's default) it has `:lang(`. Docs: stability.md Browsers names the CSS targets and the override; concepts/styles.md says what an older target lowers; packages/ui/docs/README.md keeps the theme's no-`:dir()` rule for projects with an older target. llms files regenerated. Re-check CSS_TARGET with the stability page at each release. Checks: @lumiose/vite tests (223 passed), pnpm typecheck, docs:check (lumiose and ui).
<!-- SECTION:NOTES:END -->
