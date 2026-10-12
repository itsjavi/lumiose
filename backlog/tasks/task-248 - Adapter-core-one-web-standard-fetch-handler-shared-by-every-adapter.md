---
id: TASK-248
title: 'Adapter core: one web-standard fetch handler shared by every adapter'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 19:55'
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
- [x] #1 A documented fetch-style handler serves a build: pages, endpoints, actions, streaming and static assets
- [x] #2 @lumiose/adapter-node uses it; the fullstack conformance suite still passes
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

Nova 2026-10-12: MISTAKE to report: commit c68a476 picked up another agent's pending hunk in packages/lumiose/src/app/public.ts (exports renderToStream/renderToString from ./server/browser.ts). Its other half (browser.ts +21, public.server.ts +1) is still uncommitted in the working tree, so lumiose's browser entry does not build at c68a476 until its owner commits those two files. A fix commit through git plumbing was refused by the permission classifier; I did not edit the owner's working file. Conformance is run in a worktree with that hunk removed locally.

Nova 2026-10-12: evidence. Isolated worktree at c68a476 (with the foreign public.ts hunk removed locally): fullstack conformance 'pnpm --filter @bench/harness conformance --only lumiose' 15/15 pass (adapter-node on the new entry); adapter-node 29/29, lumiose src/app 374/374, vite production 38/38; typecheck, oxlint, oxfmt clean; full vitest 1601 pass, 1 fail = compiler scan.test version check of the copied stale native binding (0.1.0 vs 0.2.0, unrelated). Runtime size unchanged (server-only code).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The server build's entry exports default { fetch(request, platform?) } (serveBuild in app/server/serve.ts): static files of dist/client via node:fs (indexed lazily; same URL, cache, precompressed and trailingSlash rules as adapter-node, now shared in app/server/static-files.ts), then the app (pages streamed, endpoints, actions, AbortSignal), with lumiose({ headers }) + default headers. ctx.platform { env, waitUntil, clientAddress } with fallbacks, typed by Platform/PlatformEnv; Bun, Deno and workerd second arguments recognized. adapter-node uses the entry's createHandler() + clientAddress, no behavior change; lumiose dev passes clientAddress. Docs: reference/server-entry.md (+ Bun/Deno/Hono run instructions, verified locally), ctx.platform in server/app docs. Verified: unit tests, conformance 15/15, manual Bun 1.4.2 and Deno 2.9.6 runs.
<!-- SECTION:FINAL_SUMMARY:END -->
