---
id: TASK-248
title: 'Adapter core: one web-standard fetch handler shared by every adapter'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 19:50'
labels:
  - adapter
milestone: m-9
dependencies: []
priority: high
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prerequisite for the deploy adapters (TASK-175): expose the built app as fetch(Request) => Response (static assets, streaming, AbortSignal, request context) so Node, Cloudflare, Vercel, Netlify, Bun and Deno adapters are thin wrappers. adapter-node moves onto it without behavior changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A documented fetch-style handler serves a build: pages, endpoints, actions, streaming and static assets
- [ ] #2 @lumiose/adapter-node uses it; the fullstack conformance suite still passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: shape approved in decision-45: the server entry exports default { fetch(request, platform?) }; platform extras as ctx.platform.

Nova 2026-10-12 (session nova-20261012T193257Z-t248): implemented.
- Runtime: RequestHandler.fetch(request, platform?) -> ctx.platform (types Platform + PlatformEnv, augmentable like Locals: naming choice, flagged to Lux). Fallbacks: env {}, waitUntil runs the promise and reports a rejection to onError, clientAddress undefined. In-process requests share the parent's platform. Prerendering keeps ctx.platform readable.
- serve.ts serveBuild(): the entry's default export = static files of dist/client (static-fs.ts, node:fs/promises, indexed lazily on the first GET/HEAD; Node, Bun, Deno) -> app -> lumiose({ headers }) + defaults where the response lacks them. Recognizes the runtimes' second argument: Bun server (requestIP), Deno info (remoteAddr), workerd (request, env, ctx).
- static-files.ts: the URL rules (staticPath, matchStaticFile, cacheControl, MIME, ETag, 304, accepted encodings) now shared by adapter-node and the fetch handler (exported through lumiose/node). adapter-node static.ts/compress.ts use them; no behavior change (its tests unchanged and green).
- Entry: createHandler() stays the app alone (adapter-node, prerender); adapter-node now uses entry.createHandler() (+ clientAddress from the socket) instead of entry.default, since default now has its own static layer. lumiose dev passes clientAddress too.
- Docs: new reference/server-entry.md (handler, platform table per host, createHandler, config, Run it: Bun, Deno, Node/Hono), ctx.platform in concepts/server.md and reference/app.md, rendering-modes.md and adapter-node.md updated, README index line.
- Manual runs (scratch app, working tree): bun 1.4.2 'bun dist/server/entry.js' and deno 2.9.6 (pnpm dlx) 'deno serve --allow-net --allow-read --allow-env': statics with ETag/cache-control, streamed Suspense, endpoint with ctx.platform.clientAddress, POST, 404, default headers. Hono @hono/node-server 2.1.1 example in the docs ran too.
<!-- SECTION:NOTES:END -->
