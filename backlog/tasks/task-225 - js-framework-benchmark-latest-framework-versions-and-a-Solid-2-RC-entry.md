---
id: TASK-225
title: 'js-framework-benchmark: latest framework versions and a Solid 2 RC entry'
status: Done
assignee:
  - Spark
created_date: '2026-10-11 01:43'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-41 (user 2026-10-11): benchmark every framework at its latest stable version. The krausest entries are installed from krausest's lockfiles and are behind: react 19.2.0 (latest 19.3.0), solid-js 1.9.3 (1.9.17), svelte 5.42.1 (5.57.2), and vue 3.6.0-rc.5 for Vue Vapor (latest 3.6.0-rc.11; Vapor only ships in the 3.6 RCs, so it stays on the newest RC). Install each entry at its latest version (remix 3.0.0 is current), with versions pinned in the setup and recorded in RESULTS.md. Add a 'solid-2 (RC)' entry on solid-js@next (2.0.0-rc.14) with its matching compiler preset, labelled as a pre-release, next to stable Solid. krausest's published table measured older versions, so label the 'published factor' row with the versions it used, or drop it for entries that changed. Verify every entry builds and completes a smoke run. The full run waits for the quiet-machine measurement wave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every entry is installed at its latest stable version (Vue Vapor at the newest 3.6 RC), pinned, and listed with its version
- [x] #2 A solid-2 (RC) entry builds and runs, labelled as a pre-release
- [x] #3 RESULTS.md is clear about which versions krausest's published factors used
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): implemented. Reference entries are pinned in scripts/jsfb.ts (PINNED) and installed exactly over krausest's lockfiles with npm install --save-exact; a .jsfb-pinned.json marker in each checkout entry triggers a reinstall and rebuild when a pin changes. Versions: solid-js 1.9.17 + babel-preset-solid 1.9.16, svelte 5.57.2, vue 3.5.43, vue-vapor on vue 3.6.0-rc.11, preact 11.0.1, react/react-dom 19.3.0, remix 3.0.0 (unchanged, current).
New local entry frameworks/keyed/solid-2: krausest's solid entry ported to Solid 2 (solid-js + @solidjs/web 2.0.0-rc.14; createProjection replaces createSelector, batch removed), same rollup/babel/terser tooling versions as stable solid. Compiler: @solidjs/babel-plugin 2.0.0-rc.14, the plugin @solidjs/vite-plugin uses. babel-preset-solid's newest pre-release (2.0.0-rc.2) emits $$click handlers while the rc.14 runtime reads _$$click, so row clicks did nothing (select and remove failed in the first smoke run); fixed by switching compilers. Bundle is ~60 kB min (solid 1: 11.5 kB) with sideEffects:false honored, so that is the RC's real size.
RESULTS.md generator: column labels 'solid-2 (RC)' and 'vue-vapor (RC)', a framework-versions line, notes for both pre-releases, and the published-factor row now matches krausest's entry by directory and names the version krausest measured when it differs (e.g. '1.133 (v1.9.3)'), with a sentence explaining it. Verified with --summary on smoke results.
Checks: tsc -p benchmarks/js-framework-benchmark, oxlint, oxfmt; smoke run of all 11 entries x all benchmarks (count 1) with no errors after the compiler fix.
Remaining: AC #3 needs the regenerated RESULTS.md from the quiet-machine run: pnpm bench:jsfb --count 10 --mem-count 3 (about 1.5-2.5 h). Re-check versions before it (decision-41).

Lux 2026-10-12: quiet-machine run (ef81f5b) on the pinned latest versions; RESULTS.md names each version and marks published factors measured on older ones.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
js-framework-benchmark runs the latest stable versions plus labelled Solid 2 RC and Vue Vapor RC entries; 2026-10-12 results committed.
<!-- SECTION:FINAL_SUMMARY:END -->
