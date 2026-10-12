---
id: TASK-175
title: 'Deploy adapters: Cloudflare, Vercel and Netlify'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 12:12'
updated_date: '2026-10-12 19:31'
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
<!-- SECTION:NOTES:END -->
