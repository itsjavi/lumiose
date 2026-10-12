---
id: decision-45
title: 'Deploy adapters live in the Vite config, on one fetch handler'
date: '2026-10-12 19:30'
status: accepted
---
## Context

Cloudflare, Vercel and Netlify are 1.0 must-haves (TASK-175), and Bun, Deno and other hosts are documented targets. Today only `@lumiose/adapter-node` serves a build, through a Node request listener. Each platform wants a different output layout, but all of them (and Bun, Deno and workerd) can run a web-standard `fetch(Request) => Response`. Nova proposed two adapter APIs on 2026-10-09 (TASK-175 notes); the user can't test every platform by hand.

## Decision

Approved by the user on 2026-10-12.

- **One fetch handler (TASK-248).** The server build's entry exports `export default { fetch(request, platform?) }`, the module-worker shape that Bun, Deno and workerd run as is. It serves pages, endpoints, actions, streaming and static assets. Platform extras (`env`, `waitUntil`, `clientAddress`) reach handlers as `ctx.platform`. `@lumiose/adapter-node` wraps it without behavior changes.
- **Adapters in the Vite config** (option A): `lumiose({ adapter: cloudflare() })`, `vercel({ runtime: "nodejs" | "edge" })` (default `"nodejs"`), `netlify()`. After prerendering, `lumiose build` calls the adapter to write the platform's output. Without an adapter the output is today's Node build, served by `createServer()`.
- **WebSockets (TASK-251):** no new adapter-node API. `createServer()` already returns the `node:http` server, so the guide attaches `ws` through `server.on("upgrade", …)`.
- **Verification:** each adapter is checked in its platform's local emulator (wrangler/workerd, netlify dev; Vercel has no local runner for Build Output v3, so a Node harness for the generated function plus validation of `config.json`). These e2e runs are local only: CI runs the adapters' unit tests, never the emulators (user, 2026-10-12). The emulator CLIs run pinned through `pnpm dlx`, not as dev dependencies, so CI does not install them. The docs' verification table claims only what was tested.

## Consequences

- Edge targets need the server runtime off Node-only APIs on the request path (`node:crypto` in CSP nonces moves to Web Crypto); `AsyncLocalStorage` stays, through `nodejs_compat` on Workers.
- A new internal `Adapter` interface in the Vite plugin's build step.
- The user does one real free-tier deploy per platform when convenient, then the table can say "verified on the platform".
