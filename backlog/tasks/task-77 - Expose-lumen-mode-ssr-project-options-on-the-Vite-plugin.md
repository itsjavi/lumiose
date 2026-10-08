---
id: TASK-77
title: 'Expose lumen({ mode, ssr }) project options on the Vite plugin'
status: Done
assignee:
  - Photon
created_date: '2026-10-08 16:38'
updated_date: '2026-10-08 20:51'
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
- [x] #1 LumenOptions accepts mode ('static' | 'server' | 'spa'), ssr, trailingSlash and csrf, typed with the app layer's types
- [x] #2 The 'lumen' plugin exposes api: { options } with them, so projectOptions() returns them (dev, build, lumen routes/check)
- [x] #3 A test: a project with lumen({ mode: 'server' }) lists its routes as server via lumen routes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add mode/ssr/trailingSlash/csrf (+ md/html per Lux) to LumenOptions, typed via app-layer types.
2. Validate at plugin creation; expose api: { options } on the 'lumen' plugin.
3. Tests: plugin api.options + lumen routes lists server routes for lumen({ mode: 'server' }).
4. Remove TODO(TASK-77) workarounds in create.test.ts / cli.test.ts (coordinate with Beacon/Nova owners via notes).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: blocks TASK-33 AC #1 (create-lumen templates set lumen({ mode: 'static' | 'server' | 'spa' }); today the option is ignored and is a TS2353 in vite.config.ts). When done, remove the pluginTakesMode guard in packages/create/src/create.test.ts and the api.options workaround in packages/lumen/src/cli/cli.test.ts (its vite.config.ts fixture), both marked TODO(TASK-77).

Photon (2026-10-08): implemented.
- packages/lumen/src/vite/options.ts (new): LumenOptions gains mode/ssr/trailingSlash/csrf typed with the app layer's RouteMode/TrailingSlash/CsrfOptions, JSDoc on each (defaults, overrides, examples). projectOptionsOf() validates at lumen() creation and throws TypeError naming the option and expected values: bad enum values, non-boolean ssr, csrf not false|{allowedOrigins}, allowedOrigins entries that are not full origins (compared verbatim with the Origin header, so no path/trailing slash), non-RegExp include/exclude, unknown option names (typos fail instead of being ignored).
- packages/lumen/src/vite/index.ts: plugin is Plugin<LumenPluginApi>; 'lumen' plugin has api: { options } (frozen ProjectOptions, unset options absent). lumen/vite re-exports LumenOptions, LumenPluginApi, ProjectOptions, RouteMode, TrailingSlash, CsrfOptions types.
- md/html (decision-22) are NOT added: their behaviour is TASK-69; until then lumen({ md }) fails as an unknown option rather than being silently ignored. TASK-69 adds them to KNOWN + LumenOptions.
- TODO(TASK-77) removed: cli.test.ts fixture now uses lumen({ mode: 'server' }) (covers AC #3: lumen routes prints/JSONs every route as server, defaultMode server); create.test.ts pluginTakesMode guard removed. Its 'builds' test asserted prerendered > 0 for every template, which only held because mode was ignored; now asserted for static templates only (server/spa render per request; spa shells come with TASK-25).
- Tests: src/vite/options.test.ts (2 tests: api.options shape/freeze, every validation message). cli.test.ts + create.test.ts (20) pass; lumen and create tsc clean; oxlint/oxfmt clean.
- Docs (for Beacon): packages/lumen/docs/reference/vite.md still shows LumenOptions with include/exclude only and its Status note says trailingSlash 'arrives with lumen dev/build'; update it with mode/ssr/trailingSlash/csrf (and regenerate llms-full.txt).

Photon (2026-10-08, during TASK-54): packages/lumen/docs/reference/vite.md now documents mode/ssr/trailingSlash/csrf (LumenOptions block, validation, status note, example); llms-full.txt regenerated. The Beacon docs follow-up above is done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen({ mode, ssr, trailingSlash, csrf }) is typed (app-layer types, JSDoc), validated at plugin creation with option-specific TypeErrors (unknown options rejected), and exposed as the 'lumen' plugin's api.options, which projectOptions() reads for dev, build and the CLI. Tests: options.test.ts; cli.test.ts now configures lumen({ mode: 'server' }) and lumen routes reports server routes; create.test.ts TODO guard removed. md/html stay with TASK-69. Docs follow-up for Beacon: reference/vite.md.
<!-- SECTION:FINAL_SUMMARY:END -->
