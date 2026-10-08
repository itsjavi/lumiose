---
id: decision-4
title: Server-first rendering with islands and per-route SPA mode
date: '2026-10-08 10:02'
status: accepted
---
## Context

Lumen must support client-side rendering (CSR), server-side rendering (SSR) and static site generation (SSG). Shipping and hydrating the whole component tree, as most app frameworks do, costs JavaScript and time-to-interactive on content-heavy pages. Astro islands and Remix 3 (`clientEntry` + `Frame`) show that server-first rendering with explicit client boundaries gives the best defaults. Some apps still want a full SPA experience.

Alternatives considered:
- App-first SSR with full hydration (SolidStart, SvelteKit). Simpler for apps, but ships more JavaScript by default.
- Qwik-like resumability. Best time-to-interactive on paper, but the most complex compiler and runtime, and an unfamiliar DX.

## Decision

- **Server-first by default.** Under SSR and SSG, components render to HTML on the server and ship no JavaScript.
- **Islands.** Interactivity is opted into at explicit client boundaries, which hydrate independently with a chosen strategy (for example on load, when idle, or when visible). Island props must be serializable.
- **Per-route SPA mode.** A route can opt into SPA mode with or without SSR, in which case its whole tree is client-rendered or hydrated and navigation is client-side.
- **SSG is SSR at build time.** Static and server routes can coexist in one app.
- The server layer uses web standards: a `fetch(Request) => Response` handler with deployment adapters.
- The exact boundary syntax, hydration markers and island boot protocol are specified in the architecture spec, informed by the TASK-1 research.

## Consequences

- Most pages ship close to zero JavaScript. Interactive parts pay only for their own code.
- The bundler must build separate server and client module graphs. Server-only code must be prevented from leaking into island bundles, using the bundler environments and a `.server` module convention.
- Island props that are not serializable must produce clear dev-time and `lumen check` errors.
- One hydration mechanism must serve both islands and whole-app SPA hydration, where an SPA is effectively one root island.

