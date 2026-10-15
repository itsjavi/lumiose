---
id: decision-58
title: Fully resolved responses and a streaming timeout
date: '2026-10-15 07:41'
status: accepted
---
## Context

Lumiose has no hook to customise server rendering, and the user chose not to add one as a file (no `render.server.ts`): `document.stsx` owns the HTML, middleware the headers and response body, `csp: "strict"` the nonces, and `instrumentation.server.ts` the errors (decision-49). Two gaps remained (TASK-306): the render waits for every `<Suspense>` boundary only when prerendering, so crawlers that do not run JavaScript get fallbacks and out-of-order chunks; and a boundary that never settles holds the response open until the client goes away. React Router switches its `entry.server` to `onAllReady` for bots and aborts after `streamTimeout`.

## Decision

User decision, 2026-10-15.

- **`response().setStreaming(false)`**, callable in middleware or a page until the shell is sent (like `setStatus()` and `setHeader()`, LUM5004 after), makes the render resolve every boundary and send one complete document.
- **Crawlers are a docs recipe:** middleware tests the user agent (for example with the `isbot` package) and calls it. Lumiose ships no bot list.
- **`lumiose({ streamTimeout })`** (React Router's name) takes a duration (`"30s"` or milliseconds), defaults to 30 seconds, and `false` disables it. When it expires, every pending boundary rejects with a timeout error: the nearest `<ErrorBoundary>` renders into the stream, `onRequestError` receives it with phase `"stream"`, and the response ends. Prerendering ignores it.
- Rejected: a built-in bot option, a per-page `export const streaming`, a query-string switch, no default timeout, a 10 s default.

## Consequences

- Implemented in TASK-340.
