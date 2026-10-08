---
id: decision-21
title: 'Project-level default rendering mode, server-first unless configured'
date: '2026-10-08 15:30'
status: accepted
---
## Context

Decision-4 made rendering server-first: routes without a `mode` render on the server and ship zero JS, and islands and SPA routes are opt-in. The user worried that this feels like an Astro clone, and asked about highly interactive SPAs such as an in-browser audio composer/mixer. On 2026-10-08 they chose to keep server-first as the default, as long as one line of configuration can turn the whole project into an SPA.

## Decision

- `lumen({ mode })` in `vite.config.ts` sets the project-wide default route mode: `"static"` (the default), `"server"` or `"spa"`, plus `ssr` for spa.
  - Example: `lumen({ mode: "spa", ssr: false })` makes the whole app a client-rendered SPA with the client router, built as static files.
- A route or layout `export const mode` still overrides the project default (inheritance per spec §7.1).
- Without the option, behaviour is unchanged: `static`, server-first, zero JS by default.
- `create-lumen` templates set the option explicitly for the kind of app chosen (spa, ssr, static), so projects state their default in config.
- **Server integration.** The app layer stays server-agnostic: it compiles to a web-standard `fetch(Request) => Response` handler with Lumen's own route matcher, and has no Hono/Fastify dependency. Users mount it in any fetch-compatible server (Hono, Bun, Deno, Workers), or in Node servers (Fastify, Express) through the node adapter's bridge. Pure SPA/static builds need no Lumen server at all.

## Consequences

- One config line turns Lumen into a client-first SPA framework, while content sites keep the zero-JS default.
- Typegen and the route manifest resolve modes from the project default first, then layouts, then routes.
- The docs present the three app kinds (SPA, SSR, static) side by side, so Lumen doesn't read as content-site-only.
