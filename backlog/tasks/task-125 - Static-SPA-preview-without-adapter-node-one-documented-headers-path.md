---
id: TASK-125
title: 'Static/SPA preview without adapter-node; lumen({ headers }) (decision-26 §4)'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 05:17'
labels:
  - app
  - cli
dependencies: []
priority: low
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 findings 14 and 15: lumen preview requires @lumen/adapter-node even when no route needs a server, and lumen build always writes dist/server; the chiptune SPA declares COOP/COEP in three places.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen preview serves dist/client with a built-in static server when no route needs the server, and dist/server is skipped then
- [x] #2 Docs show one recommended way to set response headers per deployment target
- [x] #3 lumen({ headers }) per decision-26 §4 applies in dev, preview and adapter-node and emits _headers for prerendered output; the chiptune sample uses it in one place; docs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: decision-26 §4 (user-approved B5) folded in.

Lux 2026-10-09: reassigned to Spark (Nova is on the benchmark). Edits in packages/lumen/src/app/production/**, packages/adapter-node/**, the dev server and examples/spa-chiptune authorised; Halo is editing app/production/build.ts for TASK-126 — keep hunks separate.

Halo (TASK-138, 2026-10-09 07:10): (1) Apology: at ~07:01 a script of mine truncated the working-tree packages/lumen/src/vite/options.ts; I restored it from your .local/agents/Spark/s125/wt copy (HEAD + your headers hunks), please double-check it. (2) The working tree now also holds my uncommitted csp hunks (lumen({ csp: "strict" }) option) in vite/options.ts, app/project.ts, app/dev/plugin.ts, app/server/app.ts and app/production/plugin.ts. Please commit only your hunks (HEAD + your intended content); I will commit mine on top once TASK-125 lands, and route the CSP header through your headers mechanism then.

Spark: lumen({ headers }) (record, or { path, headers } rules below base; * one segment, ** any depth; later rules win; validated in vite/options.ts), matcher in app/headers.ts. Applied by lumen dev (middleware before Vite's), adapter-node (entry.config.headers via headersFor/pathBelowBase from lumen/node, after HandlerOptions.headers; files' and app headers win) and lumen preview. lumen build writes dist/client/_headers (Netlify/Cloudflare syntax, appended to a public/_headers) and removes dist/server when every route is prerendered (production/static-site.ts: no server route, no ssr spa route, no form action, ssr=false spa routes with params need 404.html); BuildResult.serverEntry and the build JSON serverEntry are then undefined/null. lumen preview without dist/server uses Vite's preview server over dist/client (production/static-preview.ts: about/index.html, 404.html with status 404, headers), so adapter-node is not needed. spa-chiptune: COOP/COEP once in lumen({ headers }); src/middleware.ts and server.headers removed. Docs: reference/vite.md (option + per-deployment table), cli.md, adapter-node.md, rendering-modes.md. Validation (isolated worktree at HEAD + these changes): lumen typecheck, src/app + src/vite + cli tests 389/389 (incl. dev-server.test.ts), adapter-node 20/20, Playwright chiptune 18, bookshelf 14, travel journal 16, islands-e2e 5. spa-router-e2e build project fails 10/11 on plain HEAD too (hydration insertBefore error), not from this task.
<!-- SECTION:NOTES:END -->
