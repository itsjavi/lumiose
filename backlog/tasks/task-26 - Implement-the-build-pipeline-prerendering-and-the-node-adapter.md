---
id: TASK-26
title: 'Implement the build pipeline, prerendering and the node adapter'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:52'
labels: []
milestone: m-3
dependencies:
  - TASK-22
  - TASK-19
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Production needs client and server builds plus prerendering for static routes, producing deployable output (spec §8 Build).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen build runs the client build, the server build, then prerenders static routes (staticPaths) and static GET endpoints; LUM5001 when a request API is used while prerendering
- [x] #2 Output layout dist/client (path/index.html, trailingSlash option, base, 404.html) and dist/server/entry.js
- [x] #3 @lumen/adapter-node serves the build; lumen preview works; fully static sites deploy with dist/client only
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Handler: base (Vite base, routes match below it), trailingSlash (ignore|always|never, 308 for page GET/HEAD), prerendering guard (request APIs → LUM5001 in route code; middleware unguarded) via an AsyncLocalStorage guard + guarded ctx for endpoints/headers(ctx).
2. Routes: endpoint method exports read statically; static endpoint with non-GET exports → LUM5005 (registry + docs).
3. lumen/build (src/app/production): build({ root }) with Vite 8 createBuilder: typegen (route errors stop the build), client env → dist/client (input virtual:lumen/islands with preserved exports, one chunk per island; public/), ssr env → dist/server/entry.js (virtual:lumen/server-entry: manifest, lazy route imports, middleware/document, island URLs, config; runtime imported dynamically so chunks never import the entry), then in-process prerender via entry.createHandler({ prerendering }).
4. Prerender: static pages (+staticPaths), static GET endpoints (files), redirects (meta refresh), 404.html when the root scope is static; path/index.html or path.html (never); problems collected into one PrerenderError.
5. @lumen/adapter-node: createStaticHandler (dist/client, base, trailingSlash, immutable assets, ETag/304, traversal-safe) + createHandler/createServer({ port, host, dir, origin, env }) falling back to entry.default.fetch through lumen/node (node-http.ts).
6. CLI: lumen build, lumen preview (resolves the project's @lumen/adapter-node, production .env).
7. Verify: unit/integration tests, bookshelf build + Playwright smoke via node server.ts.
8. After TASK-19: CSS manifest → stylesheet links in built pages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-23 (Nova): the request handler ignores route modes, so pages exporting action/actions serve POST in dev. For static (prerendered) pages with actions, the build must still route POSTs to the server entry (or require mode = "server" with a diagnostic). Decide and implement here. The handler's csrf option (default on, { allowedOrigins } or false) should be exposed through lumen({ … }) config / the adapter.

Lux (from Nova): reuse app/server/node-http.ts for adapter-node; apply Vite base to route matching; the dev server/build should write shadows (or leave that to lumen check), decide in this task.

Lux: may start before TASK-19 (CSS manifest, Photon): build the client→server→prerender pipeline, output layout, staticPaths, 404.html, static GET endpoints, LUM5001/LUM5005, adapter-node and preview. Integrate stylesheet links from the CSS manifest once TASK-19 is Done (the dependency stays for completion).

Lux (from Beacon, TASK-48): docs/reference/app.md example 2 now trips LUM5005 under your static-endpoint rule. Fix the rule or ask Beacon to adjust the example; whichever is right per decision-21/spec §8.

Nova (session nova-task26-20261008T155331Z), progress:
- Files: packages/lumen/src/app/production/{build,plugin,prerender,command,index}.ts (+ build.test.ts, command.test.ts; dir is not named build/ because the root .gitignore ignores build/), app/server/app.ts (createAppHandler, the entry's runtime), app/project.ts (shared app-file/config lookup + projectOptions), handler.ts (base, trailingSlash, prerendering), scope.ts (prerender guard), routes/meta.ts + manifest.ts (LUM5005), dev/plugin.ts + dev/server.ts (shared helpers; dev now passes base/trailingSlash/csrf), cli/main.ts (build, preview commands only), lumen package.json exports ./build and ./node; packages/adapter-node (new); examples/ssr-bookshelf (server.ts, playwright.config.ts, e2e/smoke.e2e.ts, scripts build/start/preview/test:e2e, deps @lumen/adapter-node + @playwright/test 1.63.0; pnpm-lock additions only, deps.lock taken/released). Docs: concepts/rendering-modes.md Build section; errors/LUM5001.md, LUM5005.md + registry line (these two docs and the registry line were swept into commits 10dedef/7256839).
- Decisions: (a) static pages with action/actions stay static: GET is prerendered, POST reaches the server entry (adapter statics answer GET/HEAD only); a fully static deploy then has no actions (documented). (b) Static endpoints may only export GET: LUM5005 from the route scanner (dev/check/build) and re-checked on real exports at prerender. (c) LUM5001 guards route code only (pages, layouts, error pages, static endpoints, headers(ctx)): request(), cookies(), locals(), response(), url().search/searchParams, ctx.request/cookies/locals; middleware runs unguarded (bookshelf's currentUser(ctx.cookies) works); violations are reported even if an ErrorBoundary swallows them. (d) Static routes reaching the server at runtime (unlisted params, POST) render on demand, fully resolved. (e) trailingSlash: ignore (default) → path/index.html, both URL forms; always → 308 to /path/; never → path.html + 308 to /path; endpoints untouched. (f) 404.html only when the root scope (root layout mode, else project default) is static, and no catch-all matches /__lumen/404. (g) Redirects in static pages → meta-refresh HTML. (h) Shadows stay with lumen check; build runs typegen. (i) lumen preview resolves @lumen/adapter-node from the project (no lumen↔adapter cycle) and passes the production-mode .env (loadEnv) as env. (j) Prerender origin is http://localhost (sitemaps should use an env var for the site URL).
- Evidence: pnpm typecheck clean (9 projects); pnpm test 78 files / 824 tests green; oxlint: only the pre-existing app/router/index.ts warning (TASK-25 placeholder); cargo test registry ok; docs gen-error-docs/gen-llms --check ok. Bookshelf: lumen build → dist/client/{about/index.html,404.html} + dist/server/entry.js; Playwright (chromium, node server.ts on :5191, fresh data/e2e.db) 6/6: streamed home, prerendered /about served statically (ETag, revalidate), books list→detail, /api/search JSON, 404 page, sign-in action (fail 400 field error, then session + sign-out). adapter-node tests on a real build: statics (immutable hashed assets, 304, HEAD, traversal/dotfiles), handler fallback, static-page POST → action, cross-site POST 403.
- Remaining (why In Progress): CSS links in built pages wait for TASK-19 (Photon, In Progress): integrate in plugin.ts serverEntryCode() (add a file → CSS hrefs map to the entry data) and createAppHandler (headAssets(files) → <link rel=stylesheet> for the union, in order). ssr=false SPA shells and SPA entries: TASK-25 (prerender currently skips non-static routes). Island loader script/entry: TASK-18 (client input is virtual:lumen/islands with preserveEntrySignatures exports-only; island chunk URLs already feed modulepreload).
- For Photon/Lux: lumen() should accept and expose api: { options: { mode, ssr, trailingSlash, csrf } } (decision-21); dev/build read it through app/project.ts projectOptions() (until then trailingSlash is only build({ trailingSlash }) / lumenDev({ trailingSlash })).

Photon (TASK-19 Done): virtual:lumen/css-manifest is ready — `import { stylesheets } from "virtual:lumen/css-manifest"` in the server entry; stylesheets([document, ...files]) returns the deduped hrefs (base included) to render as <link rel=stylesheet> in headAssets. Default export: project-relative module → hrefs. Empty in dev (keep dev/plugin.ts headAssets). Details in TASK-19 notes.

Nova (session nova-task71-20261008T162824Z): CSS links integrated with TASK-19's manifest. production/plugin.ts serverEntryCode() imports stylesheets from virtual:lumen/css-manifest into the entry's app object; server/app.ts BuiltApp.stylesheets + createAppHandler headAssets → <link rel="stylesheet"> for [document, ...route files] (layouts, then the page) in cascade order, base included, so prerendered pages and per-request responses both get them. build.test.ts: the fixture layout now imports app.css and has a style block; asserts two links in order in index.html, about/index.html and a server route response, both CSS assets' content, and /sub/ base links. Bookshelf: lumen build → about/index.html links /assets/styles-*.css. Remaining items listed earlier belong to TASK-25 (SPA shells) and TASK-18 (island loader entry).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen build builds the client (islands, CSS, public) and the server entry, then prerenders static routes (staticPaths, static GET endpoints, 404.html, redirect pages) through the built handler; base and trailingSlash apply; LUM5001/LUM5005 guard prerendering. dist/server/entry.js exports { fetch }, createHandler and config; @lumen/adapter-node serves dist/client statics then the handler; lumen preview runs it. Built pages link their stylesheets from the CSS manifest (TASK-19). Tests: build.test.ts (6), adapter-node tests, bookshelf Playwright smoke on the production build. SPA shells and the island loader entry continue in TASK-25 and TASK-18.
<!-- SECTION:FINAL_SUMMARY:END -->
