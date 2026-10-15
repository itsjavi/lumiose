---
id: TASK-298
title: Server instrumentation hooks and error reporting on every host
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:06'
labels:
  - observability
milestone: m-10
dependencies:
  - TASK-293
priority: medium
ordinal: 300000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server observability today is middleware that wraps `next()` and the `onError` option of the build's `createHandler()`. `@lumiose/adapter-node`'s HandlerOptions has no `onError`, `lumiose dev` and the deploy adapters share no hook, and nothing reports the phases inside a request (middleware, action or endpoint, shell render, streamed boundaries). Error reporting and tracing therefore differ by host and stop at the HTTP layer.

Approved shape (decision-49): an optional `src/instrumentation.server.ts` (also `.js`, `.mjs`; server-only by its `.server.` segment), loaded by `lumiose dev`, `lumiose preview`, `dist/server/entry.js` and the deploy adapters, not while prerendering. `register()` runs once per server instance before the first request. `onRequestError(error, info)` receives unexpected errors on every host, dev included (also `ErrorBoundary`-caught errors with their `digest`, streamed-boundary errors and rejected `waitUntil()` work), with `info = { request, route, params, phase, digest }`. `instrumentations` are observers wrapping `request`, `middleware`, `action`, `endpoint`, `render` and `stream`; `call` never throws and wrappers cannot change results. The handler's `onError` option stays, and `@lumiose/adapter-node` gains it.

Prior art: React Router's instrumentations, Next.js instrumentation.ts (register, onRequestError), SvelteKit instrumentation.server.ts.

Code: packages/lumiose/src/app/server, packages/vite/src/app (dev, production), packages/adapter-node and the deploy adapters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One hook receives unexpected server errors with the request and matched route in dev, preview, the Node adapter and each deploy adapter
- [x] #2 Request, middleware, action, endpoint, shell render and streamed boundary phases can be wrapped, with the route and status available
- [x] #3 An example or guide shows OpenTelemetry tracing through the hook
- [x] #4 Without a hook, server rendering is not slower in an in-process A/B (pnpm --filter @lumiose/bench-ssr ab)
- [x] #5 Tests cover each phase and error reporting per host
- [x] #6 concepts/server.md, reference/server-entry.md, reference/adapter-node.md and the Coming from guides are updated
- [x] #7 register() runs once per server instance before the first request, and ErrorBoundary-caught errors reach onRequestError in dev too
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 1).

Nova (2026-10-15), implementation:
- `packages/lumiose/src/app/server/instrumentation.ts`: types (`RequestErrorInfo`, `ServerInstrumentation`, exported from lumiose; `RequestPhase`, `InstrumentationResult` internal), `loadInstrumentation()` (validates exports; `register()` once per module instance via a WeakMap: per server instance, per isolate, again in dev after an edit) and `observe()` (wrappers outermost first; the phase runs once whatever a wrapper does; `call()` memoized, never rejects; wrapper errors logged).
- Handler: option `instrumentation` (project-relative file, ignored while prerendering), loaded on the first request, which waits for register(); a load or register error is logged and requests go on. Central `report(error, ctx, phase, digest)`: host `onError` first, then `onRequestError({ request, route, params, phase, digest })`; what onRequestError throws is logged. Phases: middleware (errors escaping the chain, incl. locale checks), action (enhanced and plain), endpoint, render (page, error page, ErrorBoundary in the shell), stream (streamed boundaries, ErrorBoundary inside them, stream errors), waitUntil (fallback, and the host waitUntil wrapped only when onRequestError exists, still rejecting for the host).
- Wrappers: request (in `fetch()`, top-level only; info.route from a second match, only with request wrappers; result adds `response: { status }`), middleware (per file, `file`), action (`name`: key in actions or "default"), endpoint (`method`), render (until the shell), stream (each streamed boundary, via a renderer `onBoundary` hook; fire-and-forget).
- Server renderer (packages/lumiose/src/server): internal ShellOptions `onError(error, streamed)`, `onCaughtError(error, { digest, streamed })` (every ErrorBoundary catch, dev included; default keeps today: sanitized ones to onError) and `onBoundary(settled)`. Public `renderToStream` onError unchanged (one argument).
- Hosts: dev plugin finds src/instrumentation.server.{ts,js,mjs} (project.ts INSTRUMENTATION_SERVER_FILES), rescans on add/unlink and drops the cached handler on edits; build bundles it into dist/server/entry.js (`app.instrumentation`); adapters need no code (createAppHandler); `@lumiose/adapter-node` gains `onError`.
- Names chosen (for review): wrapper info fields `file`, `name` ("default" for `export const action`, as SvelteKit), `method`; the request result field `response: { status }` (doc-8 said the result "adds status and route": `status` is taken by the outcome, and the route is in `info` before the call). Handler option `instrumentation` (internal).
- A/B: `pnpm --filter @lumiose/bench-ssr ab main .` (renderer): working tree +0.0% vs main (quartiles -0.3% to +0.5%; control -0.6% to +1.0%; load 7-11 on 10 CPUs). The bench renders with renderToString only, so the request handler (TASK-294 + TASK-298) was also A/B-tested in one process (scratch script: main, a second copy of main as control, this branch; 120 alternating rounds of /, /books/7 and /api with root middleware): this branch -0.9% and -0.8% vs control -1.7% and -0.2%: within noise. An earlier version was 2-4% slower; fixed by keeping the async depth (request wrapper in fetch(), non-async dispatch, one-file middleware without Promise.all).
- Tests: app/server/instrumentation.test.ts (register once/concurrency/errors/prerendering, each phase of onRequestError incl. ErrorBoundary digest in prod and dev, streamed boundaries, waitUntil with and without host, onRequestError throwing, every wrapper with route and status, nesting order, skip/repeat/throw, in-process requests), public-api type test, dev-server (register, errors, caught errors, re-register after edit), build (entry, not while prerendering), adapter-node (onError + hook), Cloudflare, Vercel (node and edge), Netlify.
- Docs: concepts/server.md (### Instrumentation, API rows, checked example, OpenTelemetry example, mistakes), reference/server-entry.md, reference/adapter-node.md, reference/app.md (types), llms regenerated. Coming from: the in-flight React Router/Next.js guides (Beacon, not in main) describe instrumentation as missing: hand-over in the run notes for Lux/Beacon.
- Checks: vitest lumiose, vite, adapters, cli, apps/web: 1340 passed; typecheck lumiose/vite/cli/adapters clean; oxlint clean on touched files; docs:check green; size caps OK.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/instrumentation.server.ts works on every host (dev, preview, dist/server/entry.js, Node, Cloudflare, Vercel, Netlify; not while prerendering): register() once per server instance before the first request; onRequestError(error, { request, route, params, phase, digest }) for unexpected errors of middleware, actions, endpoints, renders, streamed boundaries, waitUntil and ErrorBoundary catches (dev included); instrumentations wrap request, middleware, action, endpoint, render and stream as observers. @lumiose/adapter-node gains onError. No measurable cost without the file (SSR ab +0.0%, handler A/B within noise).
<!-- SECTION:FINAL_SUMMARY:END -->
