---
id: TASK-306
title: 'Proposal: fully resolved responses for crawlers and a streaming timeout'
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-15 03:16'
updated_date: '2026-10-15 04:26'
labels:
  - proposal
  - needs-decision
milestone: m-10
dependencies: []
priority: low
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Raised in the TASK-293 review (2026-10-15). Lumiose has no hook to customise server rendering, and the user agreed not to add one as a file (no `render.server.ts`): `document.stsx` owns the HTML, middleware the headers and the response body, `csp: "strict"` the nonces, and `instrumentation.server.ts` the errors (decision-49). Two gaps remain, to design as small declarative options:

- **Fully resolved responses.** The render waits for every Suspense boundary only when prerendering (`resolveAll` in packages/lumiose/src/app/server/handler.ts). Crawlers and link-preview bots that do not run JavaScript get the shell with fallbacks and the streamed chunks after it. React Router's `entry.server` switches to `onAllReady` for bots. Candidate: a per-request switch that middleware can set (for example from the user agent).
- **Streaming timeout.** A slow boundary keeps the response open until the client goes away (the request's signal). React Router aborts pending boundaries after `streamTimeout`. Candidate: a `lumiose()` option, the boundary then rendering its error state.

Each new name needs the user's approval before it is recorded (AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A proposal with recommended shapes, alternatives and prior art is reviewed by the user
- [ ] #2 Approved shapes are recorded as a decision, and an implementation task is created
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal (Lux, 2026-10-15, drafted during the unattended M10/M11 run; waiting for the user's review). Today the page render passes `resolveAll` only when prerendering (`renderPage` in packages/lumiose/src/app/server/handler.ts), and a pending boundary streams until it settles or the request's signal aborts.

**1. Fully resolved responses: `response().setStreaming(false)` (recommended).**
- Middleware or a page calls it before the shell is sent; the render then resolves every `<Suspense>` boundary into the shell (the prerender path) and sends one complete document. Same family and timing rule as `setStatus()` and `setHeader()` (writable until the shell is sent, LUM5004 after).
- Crawlers are a recipe, not a built-in: middleware tests the user agent (for example with the `isbot` package) and calls it. Lumiose ships no user-agent list to maintain.
- Alternatives: (b) a `lumiose({ streaming: { bots: "resolve" } })` option with a built-in bot list (convenient, but Lumiose then maintains the list and its false positives); (c) `export const streaming = false` per page (static, cannot depend on the request); (d) a `?_resolve` query switch (cache-key and abuse problems).
- Prior art: React Router's `entry.server` switches `onShellReady` to `onAllReady` for bots; Next.js resolves everything for bots it detects (`htmlLimitedBots`); SvelteKit resolves streamed promises only in the client.

**2. Streaming timeout: `lumiose({ streamTimeout })` (recommended, React Router's name).**
- A duration (`"10s"` or milliseconds); default 30 seconds; `false` disables. When it expires, every boundary still pending rejects with a timeout error: the nearest `<ErrorBoundary>` renders its fallback into the stream, `onRequestError` receives it with phase `"stream"`, and the response ends.
- Prerendering ignores it (the build waits).
- Alternatives: (b) no default (today's behaviour: a hung data source holds the connection until the client goes away); (c) a per-request `response().setStreamTimeout()` (more API for a rare need; the project option can gain it later).
- Prior art: React Router's `streamTimeout` export in `entry.server` (default 5 s, renders the client-side fallback); Next.js has no per-boundary timeout.

**Questions for the user:** (1) `response().setStreaming(false)` as the switch; (2) `streamTimeout` with a 30 s default, rejecting into the nearest ErrorBoundary; (3) the crawler recipe stays a docs example (no built-in bot list).
<!-- SECTION:NOTES:END -->
