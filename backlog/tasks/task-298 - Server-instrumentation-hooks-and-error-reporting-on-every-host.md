---
id: TASK-298
title: Server instrumentation hooks and error reporting on every host
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
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

Outcome (shape approved in the design task): one project-level server hook module, loaded by `lumiose dev`, `lumiose preview`, the Node adapter and the deploy adapters, that receives unexpected errors with their request and route, and can wrap each phase of a request for tracing. It maps onto OpenTelemetry spans without Lumiose depending on OpenTelemetry, and costs nothing when unused.

Prior art: React Router's instrumentations, Next.js instrumentation.ts (register, onRequestError), SvelteKit instrumentation.server.ts.

Code: packages/lumiose/src/app/server, packages/vite/src/app (dev, production), packages/adapter-node and the deploy adapters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One hook receives unexpected server errors with the request and matched route in dev, preview, the Node adapter and each deploy adapter
- [ ] #2 Request, middleware, action, endpoint, shell render and streamed boundary phases can be wrapped, with the route and status available
- [ ] #3 An example or guide shows OpenTelemetry tracing through the hook
- [ ] #4 Without a hook, server rendering is not slower in an in-process A/B (pnpm --filter @lumiose/bench-ssr ab)
- [ ] #5 Tests cover each phase and error reporting per host
- [ ] #6 concepts/server.md, reference/server-entry.md, reference/adapter-node.md and the Coming from guides are updated
<!-- AC:END -->
