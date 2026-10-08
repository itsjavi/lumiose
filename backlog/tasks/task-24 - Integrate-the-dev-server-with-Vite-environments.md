---
id: TASK-24
title: Integrate the dev server with Vite environments
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:44'
labels: []
milestone: m-3
dependencies:
  - TASK-22
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen dev must serve SSR, static and SPA routes from source with HMR, using the Vite 8 Environment API (client + ssr).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen dev serves all route modes with SSR in the ssr environment and islands/SPA in the client environment
- [x] #2 HMR works for components, styles and routes; error overlay shows LUM diagnostics
- [x] #3 Verified in a browser on a sample route set
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. App-side Vite plugin lumenDev() in packages/lumen/src/app/dev (lumen/dev export): load the request handler + server runtime through the ssr module runner so compiled code, lumen and the handler share one module instance; connect middleware after Vite's (Node ↔ web Request/Response bridge, streaming).
2. Route manifest + typegen at startup and on route/middleware/document add/remove/change; structural changes reload the browser.
3. HMR: invalidate the changed module and its importers in the runner (re-imported on the next request); full reload for server-graph edits, css-update when only stylesheets changed.
4. Errors: render errors and compiler diagnostics open Vite's overlay on the page (code frame from the source-mapped stack); manifest errors (LUM5002/5003) on every page.
5. createDevServer({ root, port }) + devCommand; minimal 'dev' case in cli/main.ts.
6. Bookshelf pages (home with Suspense, books list, book detail, login action, about static, search endpoint, 404) and browser verification; Vitest end-to-end test on a fixture app.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (decision-21): support lumen({ mode, ssr }) as the project default mode in the manifest and dev server.

Nova (TASK-24):
- Files: packages/lumen/src/app/dev/{plugin,server,command,errors,index}.ts (+ dev-server.test.ts, errors.test.ts); app/server/node-http.ts (+ test; Node http ↔ web Request/Response, reusable by adapter-node in TASK-26); handler.ts: prerender may be a function of the page route; app/server/index.ts exports createServerRenderer; routes/manifest.ts: defaultMode/defaultSsr (decision-21); package.json export ./dev; cli/main.ts: 'dev' in COMMANDS + --port/--host (lazy import of app/dev/command.ts).
- Design: the dev server imports app/server/index.ts through ssr.runner.import (absolute path), never natively: a native import would create a second instance of scope.ts/frame.ts and request APIs would not see the request. Route modules load via runner.import('/'+file). Static routes render resolved (prerender: route.mode === 'static'), as the build will. ctx.env = loadEnv(mode, envDir, '') (.env files + process env). islandUrl maps root-relative ids to Vite's import URLs (/src/X.stsx?import for non-JS extensions) so preloads/loader hit the same module instance as static imports.
- HMR: hotUpdate (ssr env, order post) returns [] and invalidates the file + importers in runner.evaluatedModules (Vite's own ssr full reload clears everything and eagerly re-imports entries, which logged errors for deleted route files and reloaded DB modules). Client gets full-reload, or css-update when every changed ssr module is a stylesheet (Vite's client env also updates <link>s it saw). Route add/remove: watcher 'all' -> typegen(root) rescan -> new handler + full-reload when the manifest key changed.
- Errors: onError records per request (AsyncLocalStorage, so in-process fetches and streamed boundaries count); HTML responses get an <script type=module> that opens Vite's ErrorOverlay appended at the end of the body stream (works for errors after the shell). Compiler errors keep lumen/vite's loc/frame/plugin; runtime errors get loc + code frame from the first project stack frame (paths with route-group parentheses handled). Stacks are source-mapped by Node for runner modules unless something overrides Error.prepareStackTrace (Vitest does; the test restores Node's formatting for that request).
- Handoffs: Photon — (1) decision-21: lumenDev reads the project default from the lumen plugin's `api.options.mode/ssr`; please expose `api: { options }` on the 'lumen' plugin once lumen({ mode, ssr }) exists. (2) TASK-45/19: dev links every stylesheet module reachable from the rendered route files in the ssr graph (<link rel=stylesheet data-vite-dev-id>); .stsx style modules join automatically if compiled server code imports them; for CSS-only edits, drop the .stsx JS module from the ssr hotUpdate modules (order before post) and the dev plugin sends css-update instead of a reload. Spark/TASK-18: add the island loader client entry to headAssets() in app/dev/plugin.ts (one line) once it exists. TASK-25: spa routes with ssr=false are still server-rendered by the handler; the client shell needs a handler option (dev + build). Beacon/TASK-28: dev wired minimally (COMMANDS, --port, --host); spec §9.1 says the dev server writes shadow files — not done (lumen check/LS do it).
- Limitations: Vite base other than '/' is not applied to route matching; user plugins' transformIndexHtml is not applied to SSR pages.
- Evidence: Vitest dev-server.test.ts 11 tests on a real Vite 8 server (static resolved vs server streamed chunks, head assets, client env serves .stsx?import as lumen/dom code, islands with records + ?import preload, endpoint, action 200/400, render error overlay + frame, edit -> re-render + full-reload, compile error LUM1001 overlay, CSS-only -> css-update, route add/remove + typegen, LUM5003 overlay); errors.test.ts 4; node-http.test.ts 4 (body, set-cookie, streaming flush, abort+cancel on disconnect); manifest default-mode test. Browser (Playwright Chromium) on examples/ssr-bookshelf via `lumen dev`: Suspense fallback then streamed recommendations, books filter form, detail, static /about, login fail(400) + success redirect + cookie session + sign out, component edit auto-reload, CSS edit hot swap without reload, compile + runtime error overlays with frames, route add/remove without restart. Screenshots: backlog/assets/task-24-dev-home-suspense-fallback.png, task-24-dev-home-signed-in.png, task-24-dev-overlay-compile-error.png, task-24-dev-overlay-runtime-error.png. pnpm typecheck clean, pnpm test 72 files green (before the last additions; re-run below), oxlint clean for my files.

Nova: final validation — pnpm typecheck clean; pnpm test 762 tests, all mine green (repeated 4x; one run hit Beacon's in-progress vscode/test/workspace.test.ts, unrelated); oxlint clean for my files; oxfmt applied to my files. AC#1 scope: static/server/spa(ssr) routes render in the ssr env; island and SPA modules are served by the client env (.stsx?import compiled for lumen/dom, islandUrl + preloads verified). spa routes with ssr=false (client shell) need the SPA entry/router: tracked in TASK-25 (note added). AC#2: component and route HMR, plain-CSS hot swap and LUM overlays verified; .stsx style blocks plug in via TASK-45 (hook above).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen dev runs Vite 8 with the client and ssr environments: lumen/dev's createDevServer({ root, port }) (and `lumen dev`) serves file routes through the request handler loaded in the ssr module runner, bridging Node to web Request/Response with streamed responses. Routes are rescanned (with typegen) on add/remove/change; edits invalidate the changed server modules and reload the page (stylesheet-only edits swap in place); render errors, compiler LUM diagnostics and route manifest errors open Vite's overlay with code frames. Static routes render resolved like the build; project default mode (decision-21) is supported in the manifest and dev plugin. Verified with an end-to-end Vitest suite and in Chromium on examples/ssr-bookshelf, which gained its first real pages (home with streamed recommendations, books list/detail, login action, about, search endpoint, 404).
<!-- SECTION:FINAL_SUMMARY:END -->
