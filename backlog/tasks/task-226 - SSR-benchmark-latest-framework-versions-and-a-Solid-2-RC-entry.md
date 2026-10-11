---
id: TASK-226
title: 'SSR benchmark: latest framework versions and a Solid 2 RC entry'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-11 01:43'
updated_date: '2026-10-11 02:03'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-41 (user 2026-10-11): benchmarks/ssr uses solid-js 1.9.16 (latest 1.9.17); the others are current (React 19.3.0, Svelte 5.57.2, Vue 3.5.43). Bump to the latest stable, and add a 'Solid 2 (RC)' implementation on solid-js@next (2.0.0-rc.14) with its matching compiler, labelled as a pre-release. Check that every implementation still passes scripts/run.ts's output checks. The full run waits for the quiet-machine measurement wave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every implementation is on its latest stable version, pinned, with versions in RESULTS.md
- [ ] #2 A Solid 2 (RC) implementation renders the same page, passes the output checks, and is labelled as a pre-release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-11): versions bumped and Solid 2 (RC) added; left In Progress until the quiet-machine run regenerates RESULTS.md (AC #1's versions in RESULTS.md come from that run; bench.ts reads them from node_modules).
- package.json pins every framework exactly at its latest stable: solid-js 1.9.17 (was 1.9.16), react/react-dom 19.3.0, svelte 5.57.2, vue 3.5.43 (were ^ ranges). babel-preset-solid stays 1.9.16: it is the latest release (there is no 1.9.17).
- Solid 2 (RC): solid-js-2 = npm:solid-js@2.0.0-rc.14, @solidjs/web 2.0.0-rc.14 and @solidjs/compiler 2.0.0-rc.14 (the Oxc compiler that @solidjs/vite-plugin uses by default; babel-preset-solid stopped at 2.0.0-rc.2). It compiles the same src/solid/Page.jsx with generate: 'ssr', not hydratable. Because @solidjs/web imports solid-js, which resolves to 1.9 in this package (pnpm reports the unmet peer), build.ts bundles dist/solid-2/render.js with Vite, resolving solid-js and its subpaths to the 2.0 package (production builds, not minified). bench.ts lists it as 'Solid 2 (RC)', marked pre-release, with that method note and a versions note (decision-41).
- Smoke only: every implementation passes scripts/run.ts's output checks (lumiose, solid, solid-hydratable, solid-2, svelte, vue, react), and bench.ts --rounds 1 --runs 1 wrote its table to scratch (Solid 2 RC 2.0.0-rc.14 about 0.7x Solid 1.9.17 on a busy machine; not a measurement). RESULTS.md not regenerated.
- pnpm-lock.yaml changed (new deps); left uncommitted for Lux with the other lockfile changes.
<!-- SECTION:NOTES:END -->
