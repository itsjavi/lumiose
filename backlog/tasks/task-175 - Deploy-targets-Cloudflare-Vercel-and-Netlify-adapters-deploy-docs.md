---
id: TASK-175
title: 'Deploy adapters: Cloudflare, Vercel and Netlify'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-09 12:12'
updated_date: '2026-10-12 20:24'
labels:
  - adapter
  - docs
milestone: m-9
dependencies:
  - TASK-248
priority: high
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a 1.0 must-have (was 'do this last' on 2026-10-09). Thin packages over the web-standard fetch handler (TASK-248): @lumiose/adapter-cloudflare (Workers + static assets, nodejs_compat for AsyncLocalStorage), @lumiose/adapter-vercel (Build Output API v3), @lumiose/adapter-netlify (Functions with Web Request/Response). The user cannot try every platform by hand, so each adapter is verified with its platform's local emulator in e2e (wrangler/workerd, netlify dev, vercel build output), and the docs carry a verification table ('verified locally' / 'verified on the platform') that only claims what was tested; the user does one real free-tier deploy per platform when convenient. Docs-only targets (with code examples): Bun, Deno, Fly, Render, Railway, static hosts (GitHub Pages, Cloudflare Pages, S3/CloudFront, Netlify static), AWS Lambda snippet. Docker, VPS and Coolify: TASK-249.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Three adapter packages on the shared fetch handler, each with build-output tests and an e2e run in its platform's local emulator
- [ ] #2 A deploy guide page per target with copy-paste examples, and a verification table per target
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: PROPOSAL, not started (adapter package APIs are public API shape: needs the user's approval per AGENTS.md before implementing).
(A, recommended) adapters in the Vite config, as Astro and SvelteKit do: lumen({ adapter: cloudflare() }) / vercel({ runtime: 'nodejs' | 'edge' }) / netlify({ edge: false }); after prerendering and precompression, lumen build calls adapter.adapt({ clientDir, serverEntry, prerendered, config }) to write the target's output: Cloudflare = dist/_worker.js (fetch = entry.fetch, static files through the ASSETS binding) + wrangler.jsonc snippet with nodejs_compat (AsyncLocalStorage); Vercel = .vercel/output (Build Output API v3: static/, functions/index.func with the entry and a launcher, config.json routes with filesystem first); Netlify = .netlify/v1/functions/lumen.mjs (export default entry.fetch, config path '/*' with preferStatic) + dist/client as publish dir. adapter-node stays as is (createServer in server.ts). New internal piece: an Adapter interface { name, adapt(build) } in lumen/build.
(B) no config change: each package ships a post-build bin ("build": "lumen build && lumen-vercel") reading dist/. Less integrated, nothing new in lumen().
Runtime notes for edge targets: the server runtime imports node:async_hooks (AsyncLocalStorage: Workers nodejs_compat, Vercel Edge and Netlify Edge support it) and node:crypto (createNonce/createHash in csp.ts: would move to Web Crypto for edge targets); node:http/stream/tls are only in lumen/node (adapter-node/dev), not in the server entry.
Docs-only targets (Bun, Deno, Node hosts, static hosts, Lambda) need no API decision but a docs section: proposed docs/deploy/<target>.md pages plus a 'Deploy' section in docs/README.md (docs structure is Beacon's).

Blocked: waits for the user's adapter API choice (A: lumiose({ adapter }) recommended; B: post-build command).

Lux 2026-10-12: unblocked. User chose option A (lumiose({ adapter })), recorded in decision-45. Emulator e2e runs locally only (pnpm dlx, pinned); CI runs only the adapters' unit tests. Vercel: Node harness + config.json validation.

Nova 2026-10-12 (session nova-20261012T193257Z-t248): implementation.
- Adapter interface (internal, @lumiose/vite/build: Adapter, AdapterBuild): { name, staticFiles?: 'platform', adapt(build) }. lumiose({ adapter }) validated in options.ts; build() calls adapt() after prerendering. staticFiles 'platform' = no .br/.gz copies and a server entry without its static layer (no node:fs).
- PrerenderedFile.actions marks prerendered pages with form actions: platforms answer POSTs to static files themselves (Cloudflare 405 seen in wrangler dev; Netlify 405 in netlify serve), so the adapters route them to the server.
- _headers: one block per path (Cloudflare keeps only the last block of a path: the defaults were lost in wrangler dev).
- @lumiose/adapter-cloudflare: dist/_worker.js (env, ctx.waitUntil, CF-Connecting-IP), /assets/* immutable in _headers, action pages in dist/client/.assetsignore (the Worker renders them), starter wrangler config in a warning when none exists.
- @lumiose/adapter-netlify: .netlify/v1/functions/lumiose-server.mjs (path /*, preferStatic; context.ip, context.waitUntil) + lumiose-actions.mjs (action pages, method POST/PUT/PATCH/DELETE), /assets/* immutable in _headers, netlify.toml hint.
- @lumiose/adapter-vercel: .vercel/output (Build Output v3): static/ (no _headers), config.json routes (header routes, hashed-asset caching, methods routes for action pages, filesystem, function), overrides for prerendered pages without the slash; nodejs = (req, res) handler bundling lumiose/node next to entry.js, traced with @vercel/nft 1.11.0 (pinned) and copied with pnpm symlinks; edge = one module bundled by Vite (webworker, edge-light/worker conditions), only Edge-provided node: modules allowed (else a build error).
- Generated entry defaults NODE_ENV through a variable (wrangler's define warned on the assignment).
- examples/ssr-deploy: one app (prerendered page with island, streamed server page, endpoints, form action on a prerendered page, not-found, csp strict, an npm dependency) + LOCAL ONLY e2e scripts: e2e:cloudflare (wrangler@4.142.0 dev), e2e:netlify (netlify-cli@27.10.0 serve), e2e:vercel [--edge] (config validation + Node harness, function copied out of the repo), e2e:runtimes (adapter-node, bun@1.4.2, deno@2.9.6). All via pnpm dlx, not dependencies; not in CI.
- Results 2026-10-12: Cloudflare 10/10 (streaming, nonce CSP, env var binding, waitUntil); Netlify 10/10 with caveats (netlify serve sends max-age=0 whatever _headers says: rule checked in the file; waitUntil not observable across invocations); Vercel Node.js and Edge 10/10 in the harness; Node, Bun, Deno 10/10.
- Note: netlify-cli appends .netlify to the root .gitignore on every run; the e2e script restores the file. Suggest Lux add .netlify/ to the root .gitignore.
<!-- SECTION:NOTES:END -->
