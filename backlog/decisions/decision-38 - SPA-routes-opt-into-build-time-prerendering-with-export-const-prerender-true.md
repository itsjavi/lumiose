---
id: decision-38
title: SPA routes opt into build-time prerendering with export const prerender = true
date: '2026-10-10 22:50'
status: accepted
---
## Context

A `spa` route renders in one of two ways today (decision-4, concepts/rendering-modes):

- **Per request on the server,** which needs a server. The build then emits `dist/server`.
- **As an empty shell** with `ssr = false`, rendered in the browser.

Neither gives a static host a real first paint. The showcase apps (the chiptune tracker and Dotmatrix) are `ssr = false` SPAs, so search engines and visitors without JavaScript see an empty page. Static routes are already prerendered by `lumiose build`. SPA routes have no equivalent.

## Decision

Approved by the user on 2026-10-11, as a DX decision.

- **Opt in per route or project-wide.**
  - `export const prerender = true` on a `spa` route renders it in the build's prerender step, with `staticPaths()` for routes with params.
  - `lumiose({ prerender: true })` makes it the default for every `spa` route.
  - The name follows SvelteKit's and Astro's `prerender` (decision-32: established vocabulary).
- **A prerendered SPA page is real HTML.** It hydrates into the client router, and later navigation is client-side as usual.
- **`ssr = false` keeps its meaning:** render in the browser only. Combining it with `prerender = true` is a diagnostic, as is a prerendered route that reads the request.
- **A build whose routes are all static or prerendered emits no `dist/server`** and deploys to any static host.

Two alternatives were rejected:

- Prerendering automatically whenever there is no server. It changes render time silently as the rest of the app changes.
- A third `ssr: "build"` value. It overloads `ssr` with timing.

## Consequences

- TASK-216 (Nova) implements it: the prerender step, typegen, diagnostics and docs.
- TASK-217 (chiptune tracker, Spark) and TASK-218 (Dotmatrix, Chime) adopt it. They move browser-only code out of module scope and setup.
- concepts/rendering-modes and `llms.txt` gain the option.
