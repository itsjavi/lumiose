---
id: TASK-217
title: Prerender the chiptune tracker's first render
status: Done
assignee:
  - Spark
created_date: '2026-10-10 22:50'
updated_date: '2026-10-11 02:31'
labels:
  - example
  - showcase
milestone: m-6
dependencies:
  - TASK-216
priority: medium
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): /showcase/chiptune-tracker/ should show real content before JavaScript runs. Switch examples/spa-chiptune to the build-time prerender of TASK-216, moving browser-only code (AudioWorklet, Web Audio, storage) out of module scope and setup into effects or lazy imports, so the first paint is the app's UI, which then hydrates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The built app's HTML contains the rendered UI for every route without JavaScript
- [x] #2 Hydration takes over without a flash or a mismatch, and audio starts only after a user gesture, as today
- [x] #3 The app's tests and the site build pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): vite.config.ts now uses lumiose({ mode: 'spa', prerender: true }) (ssr: false removed). Build-time state = the demo song (new stable library id 'demo') and default prefs; nothing touches the browser at module scope or setup: prefs and the library start at defaults/empty, storage reads/writes wait for restoreSession() (state.ts, once, from the root layout's onMount after hydration; saveNow is a no-op before it so the build-time demo never overwrites the browser's copy), isolate() and the globalThis.chiptune handle moved into onMount, SettingsView reads crossOriginIsolated in onMount. Routes: songs/[id] has staticPaths() -> demo only (the library lives in the browser) and pins its id for the session restore; / renders the tracker (prerendered) and, once mounted, restores the session and replaces the URL with /songs/<open song> (was a render-time redirect, which would prerender as a meta-refresh page); nav maps / to the tracker tab.
Framework gap (reported to Lux, not patched): with a prerendered spa root, 404.html is the prerendered _404 (status 404, hydrated as an error page), and the root _404's own 'export const ssr = false' / 'prerender = false' are ignored for it; lumiose dev also renders the _404 for unknown song ids. So a reload of a non-demo song URL showed the 404 page. Workaround in the app: _404's onMount re-navigates (replace) to the same URL when the route is /songs/[id] and the song is saved in this browser. Visible effect: a brief 404 view before the song on such reloads (first visits and the demo are unaffected). Removable once 404.html can stay a client shell (or the router re-routes a hydrated 404 whose URL matches a route).
Behavior notes: a first visit hydrates without any visible change; a returning visitor's song, theme and library appear right after hydration (browser data the build cannot know); reloading /songs/demo on Pages-like hosts gets the directory's trailing slash (as /settings/ already did).
Checks: lumiose check; vitest 10/10; playwright (dev + preview) 26/26 incl. new tests/prerender.spec.ts (no-JS HTML of /, /songs/demo, /songs, /instruments, /settings and a 404; hydration keeps the prerendered header node, no console errors, AUDIO OFF until a gesture; a saved non-demo song opens from its URL after reload and / resumes it); pages config (build:site + preview:site) 2/2 after pointing it at the new /showcase/chiptune-tracker/ URL (TASK-215 had moved it) and allowing the trailing slash; manual deep-link check on the site preview; oxlint, oxfmt. README and document comment updated.
Screenshot (no JavaScript): backlog/assets/task-217-no-js.png
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The chiptune tracker is a prerendered SPA: every route's built HTML shows the full UI (header, view, mixer), the browser hydrates it without a mismatch, and the saved session (song, prefs, library) is applied after hydration; audio still waits for a gesture. Only the demo song's page is prerendered (songs live in the browser); other song URLs work through a _404 client re-route, a workaround for 404.html being the prerendered _404 (framework gap reported). Tests, the Pages site e2e and the build pass.
<!-- SECTION:FINAL_SUMMARY:END -->
