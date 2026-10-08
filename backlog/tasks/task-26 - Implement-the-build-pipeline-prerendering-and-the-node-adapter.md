---
id: TASK-26
title: 'Implement the build pipeline, prerendering and the node adapter'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:16'
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
<!-- SECTION:NOTES:END -->
