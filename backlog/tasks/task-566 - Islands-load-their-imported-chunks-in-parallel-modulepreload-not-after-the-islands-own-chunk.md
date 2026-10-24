---
id: TASK-566
title: >-
  Islands load their imported chunks in parallel (modulepreload), not after the
  island's own chunk
status: In Progress
assignee:
  - Nova
created_date: '2026-10-24 16:45'
updated_date: '2026-10-24 18:32'
labels:
  - vite
  - islands
  - performance
dependencies: []
priority: medium
ordinal: 558000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the virtualizer trial (TASK-565, 2026-10-24): an island's imports only start loading once its own chunk has loaded. A shared chunk (the virtualizer, used by two islands) arrived last in the import chain, at 2.20 s instead of 1.88 s on slow 4G, so the tracker became usable 0.45 s later (2.55 s against 2.10 s), although its mount costs the same. Fix the loading order: preload each island's static import graph (modulepreload links in the HTML, or the island loader preloading the chunk's deps), without loading islands that the page does not hydrate yet beyond what client:visible/idle allow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a page whose island imports shared chunks, those chunks start loading in parallel with the island's own chunk (a build test checks the preload links or loader map)
- [x] #2 An alternating A/B on a real app shows the earlier interactive time, with no regression on pages without islands
- [x] #3 Docs describe how island chunks load
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova, 2026-10-24: cause and plan. client:load islands already got a modulepreload for their own chunk, but browsers do not preload a modulepreloaded module's imports, so the island's shared chunks were only requested once the loader had downloaded and run and the preload helper (__vitePreload deps of the island map) added them: a second wave after the loader. client:visible/idle islands already preload their chunk and its whole static graph together at trigger time (Vite's mapDeps in the loader's island map). Change: the build records each island chunk's (and the loader's) static import closure (chunkImports in the server entry; SPA layouts/pages left out, they have spaPreloads), and the server modulepreloads it with client:load and client:only islands and with the loader (nonce'd per request, 'self' in prerendered pages, base-prefixed). Working on the worktree branch worktree-agent-a834a61eb1381b391.

Nova, 2026-10-24: done on branch worktree-agent-a834a61eb1381b391, commit 5c5ccb9b (not merged, not pushed).

Cause: client:load islands already got a modulepreload for their own chunk, but a browser finds a module's imports only once it has loaded, and modulepreload does not fetch them: the chunks the island imports (the shared ones, the ?client scripts it imports) were requested only once the loader had loaded, run and called the preload helper (Vite's __vitePreload deps in the island map). client:visible/idle/media islands were already fine: at trigger time the helper adds the chunk and its whole static graph at once.

Change:
- Build (packages/vite/src/app/production/build.ts, plugin.ts): chunkImports in the server entry, the static import closure (base-prefixed URLs) of the loader and of each island chunk, the loader left out of the islands' lists; SPA layouts and pages are left out (they have spaPreloads). The SPA and client-entry closures now share the same helper.
- Server (packages/lumiose/src/server/island.ts, render.ts, frame.ts; app/server/app.ts, render.ts): client:load and client:only islands modulepreload their chunk and its closure, the loader its own closure; deduplicated per page (a streamed chunk skips what the shell sent), nonce'd under csp strict, in streamed chunks for islands inside Suspense. client:only now gets the hint too (it hydrates at once like client:load). Dev: unchanged apart from that (no chunk graph).
- Head order (app/server/handler.ts, server/render.ts ShellParts.assets): the shell's loader, client scripts and module preloads come after the page's stylesheets. The first A/B (preloads before the stylesheets) showed first paint +0.1-0.2 s on the tracker and detail page on the port runner's HTTP/1.1 proxy: Chrome's six connections per host were taken by JS, and the stylesheets waited one round trip (probe: CSS responseEnd 444 -> 593 ms). Strict-mode style rules stay where they were; renderToStream's head holds the same tags, the strict-mode styles now before the scripts. Pages without islands or client scripts render byte-identical HTML.

A/B (port at 82f4a12, Lumiose packed from 010428c5 vs this branch, scripts/matrix.ts builds in scratch copies, alternating; slow 4G 4x CPU):
- matrix (HTTP/1.1 proxy, 3 slow runs each): tracker shows / LCP / works 0.65 / 2.57 / 2.09 -> 0.52 / 2.47 / 1.58 s; list shows / interactive 0.65 / 4.11 -> 0.51 / 3.30 s; detail 0.56 / 0.84 / 1.11 -> 0.56 / 0.86 / 1.11 s. JS identical (37.5 / 22.3 / 32.9 kB, same files); HTML brotli list 31.5 -> 31.7 kB, detail and tracker within 0.1 kB; interactions unchanged.
- probe, 9 runs each, rotated (HTTP/1.1): tracker works 2.11 -> 1.58 s, first paint 0.55 -> 0.53; list interactive 4.12 -> 3.33, first paint 0.62 -> 0.51; detail 1.12 -> 1.13, first paint 0.58 -> 0.58.
- probe over an HTTP/2 proxy (same brotli): tracker works 1.65 -> 1.03 s, first paint 0.53 -> 0.59; list interactive 4.14 -> 4.19 (bound by its 114 kB data request), first paint 0.56 -> 0.63; detail 1.14 -> 1.17, first paint 0.59 -> 0.62. DevTools throttling shares the 1.6 Mbit/s among the requests in flight, so the earlier JS takes bandwidth from the stylesheets; a server that applies the browser's priorities would send the CSS first (not measured).
- The preloads-before-stylesheets variant, for the record (HTTP/1.1, 9 runs): tracker works 1.03 s, first paint 0.76.
- Pages without islands (/, /signin, /signup): identical HTML apart from the nonce and origin.

Checks: pnpm check (vitest 2574 passed, 2 skipped; cargo, size OK); islands-e2e 10/10; spa-router-e2e 38/38; ui-e2e Chromium 1030 passed (24 skipped); ssr-styles-e2e 10/10; ssg-spa-e2e 19/19 (1 skipped); examples build. Tests: build.test.ts (preload links = the island chunk's static closure incl. a chain format -> units, the loader's map lists the visible island's chunk and imports, nothing for it in the HTML, none on a page without islands, base /sub/, csp: no nonce in prerendered pages, the response nonce on every preload of a server page, stylesheet before preloads), island.test.ts (load/only vs visible, loader closure with nonce, streamed island without the shell's), server-renderer.test.ts (stylesheets before the loader and preloads, both documents).

Not Done yet: waits for the merge into main. For Lux: doc-2's island() row says "the modulepreload hint for load": now load and only, with the chunks the island imports. decision-9's "client:load islands get a modulepreload hint" likewise.
<!-- SECTION:NOTES:END -->
