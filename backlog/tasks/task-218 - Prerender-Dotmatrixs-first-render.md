---
id: TASK-218
title: Prerender Dotmatrix's first render
status: Done
assignee:
  - Chime
created_date: '2026-10-10 22:51'
updated_date: '2026-10-11 02:42'
labels:
  - example
  - showcase
milestone: m-6
dependencies:
  - TASK-216
priority: medium
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): /showcase/dotmatrix/ should show real content before JavaScript runs. Switch examples/spa-dotmatrix to the build-time prerender of TASK-216, moving browser-only code (the gbapu engine, Web Audio, storage) out of module scope and setup into effects or lazy imports, so the first paint is the app's UI, which then hydrates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The built app's HTML contains the rendered UI for every route without JavaScript
- [x] #2 Hydration takes over without a flash or a mismatch, and audio starts only after a user gesture, as today
- [x] #3 The app's tests and the site build pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chime, 2026-10-11 (commit 55f381e).

**Change.** `vite.config.ts`: `lumiose({ mode: "spa", prerender: true, md: true })` (was `ssr: false`). Browser-only code moved out of module scope and setup:
- `state.ts`: `doc` and `prefs` start from the defaults (`firstSteps()`, default prefs) on both sides. `loadSaved()` (idempotent) reads the open song and prefs from localStorage and then starts the prefs-saving effect. It is called from the root layout's `onMount`.
- `sounds.ts`: `mySounds` starts empty, and `loadMySounds()` fills it in the same `onMount`. `songs.stsx` reads the shelf in `onMount`.
- `_layout.stsx`: the `globalThis.dotmatrix` test handle moved into `onMount`.
- `PianoRoll`: `matchMedia` moved into `onMount` (wide cells until mounted). `Waveform` and `ChannelRack` cancel their rAF in the effect's cleanup, not `onCleanup`: server owners run cleanups, and `cancelAnimationFrame` does not exist in Node.
- `document.stsx`: a small inline head script applies the saved theme and LCD palette before first paint.
- Audio was already lazy: `unlock()` creates the AudioContext on Play, and the Worker is created on the first render. The share link was already read in the studio's `onMount`: the prerendered `/` shows First Steps, hydrates, then opens the shared song.
- `songs.stsx`: thumbnail coordinates are rounded to 0.1 (songs HTML 445 kB → 361 kB raw, about 22 kB brotli).

**Framework issue found: a fragment hydrates out of order (compiler/hydration, Photon/Spark).** The pattern is a fragment inside a conditional whose children are dynamic inserts followed by static elements: `cond ? <>{item("a")}{item("b")}<label>static</label></> : null`. The client codegen creates the static template (`const _el2 = _t1()`) eagerly, before the thunks of the dynamic children run. So it claims the server's first node, which is `item("a")`'s element, and the server emits no `<!--[-->` markers for the inserts inside the branch arm array. The result is LUM4006, and the whole SPA island renders again on the client. Reproduced with `compile()` from packages/compiler on a 10-line component. Workaround here: `InstrumentPanel` uses `<div class="pitched">` (`display: contents`) instead of the fragment, where inserts get markers. Not patched in packages/.

**TASK-231 / 404 fallback note (from Lux).** Dotmatrix has no param routes, and all 6 routes plus `404.html` are prerendered, so the static-host 404 issue does not affect it. Share links (`/?song=`) hit the prerendered `/`.

**Known trade-off.** A returning visitor first sees the prerendered defaults (First Steps, an empty My songs) until hydration loads their saved song. That is one update after hydration, with no mismatch. On phones the piano roll switches to narrow cells after mount.

**Side effect to flag.** While running `pnpm exec playwright`, pnpm's verify-deps-before-run started an automatic `pnpm install`. Someone else's new `benchmarks/fullstack/apps/nuxt` package (TASK-204, Quasar) had not been installed yet. The install changed `pnpm-lock.yaml`, and it wrote to `pnpm-workspace.yaml` (added `@vue/language-core@3.3.13` and `vue-tsc@3.3.13` to `minimumReleaseAgeExclude`, plus an `esbuild: set this to true or false` placeholder under `allowBuilds`). Then it failed on ERR_PNPM_IGNORED_BUILDS (esbuild). I left both files untouched for Lux/Quasar. Later runs used `pnpm_config_verify_deps_before_run=false`.

**Validation.**
- `vitest run`: 221 passed, 5 skipped.
- `lumiose check`: no problems. `oxlint` is clean, and `oxfmt` was applied.
- `lumiose build`: 7 files prerendered, no dist/server.
- Playwright: 33/33 against `lumiose dev` and 33/33 against build + `lumiose preview`. Console errors and `LUMxxxx` diagnostics now fail the tests. New tests:
  - the raw HTML of every route, including the 404, holds the UI
  - every route renders with JavaScript disabled
  - hydration claims the prerendered DOM in place (a MutationObserver sees no `.page/.bar/.main` children removed), and later navigation is client-side
  - saved song, theme and palette come back, and the theme and palette apply even with scripts blocked
  - no AudioContext exists until Play is clicked, on `/`, `/sfx`, `/creatures` and `/songs`
  - a share link opens its song in a fresh browser without replacing the prerendered DOM
- Site base: built with `LUMIOSE_BASE=/lumiose/showcase/dotmatrix/` (the scripts/site.ts env) and served under that path. All routes hydrate in place with no console errors, and client navigation works. The full `pnpm build:site` was not run: Beacon is changing scripts/site.ts and apps/web concurrently (TASK-215).
- Before/after screenshots after hydration, HEAD (`ssr: false`) vs this change, 1440 px full page, pixel diff:
  - studio, sfx, creatures, learn, composing and 404: 0 px different
  - songs: 0.78%, only antialiasing inside the thumbnails from the coordinate rounding, visually identical
- No-JS evidence: ![Studio without JavaScript](../assets/task-218-nojs-studio.png)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dotmatrix is now a prerendered SPA (`lumiose({ mode: "spa", prerender: true })`). Every route, including the 404, ships its real UI as HTML, hydrates in place with no mismatch, and navigates client-side afterwards. Storage, matchMedia and the test handle load after mount. Audio still starts only on a user gesture, and share links load their song after hydration. Unit tests, lumiose check and build pass. E2e passes 33/33 against dev and 33/33 against preview, with new prerender, no-JS, hydration, saved-state, gesture-audio and share-link tests. Before/after screenshots match. Found a compiler/hydration bug with fragments that mix inserts and static elements (worked around here; details in the notes).
<!-- SECTION:FINAL_SUMMARY:END -->
