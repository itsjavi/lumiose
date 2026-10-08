---
id: TASK-22
title: 'Implement request handling, middleware, endpoints and document'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 12:43'
labels: []
milestone: m-3
dependencies:
  - TASK-21
  - TASK-16
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server and static routes need a web-standard fetch handler that composes middleware, endpoints, pages, layouts and error pages, with correct status and redirects (decisions 18-19).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 export default { fetch } entry; ctx { request, url, params, locals, cookies, env }; typed Locals; middleware chain; endpoints for every method
- [ ] #2 cookies with signedCookie(); redirect/notFound/error helpers; env() with PUBLIC_ client env; default and custom document.stsx; _404/_error pages with status
- [ ] #3 Integration tests over the fetch handler
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. app/server/control.ts (isomorphic): Redirect/HttpError classes, redirect(to, status?) (default 302 for GET/HEAD, 303 otherwise, resolved by the handler), notFound(), error(status, message); LUM5004 runtime error helper in app/diagnostics.ts.
2. app/server/cookies.ts: RFC 6265 parse/serialize, createCookies(request, { secureDefault }) with get/getAll/set/delete (defaults path=/, httpOnly, sameSite=lax, secure in prod), signedCookie(name, { secret }) with HMAC-SHA256 via WebCrypto (secret from env LUMEN_SECRET, key rotation via secret arrays).
3. app/server/context.ts: types Locals (augmentable), RequestContext { request, url, params, locals, cookies, env }, Middleware, EndpointHandler, ResponseContext; app/server/scope.ts: AsyncLocalStorage request scope + server-only accessors request()/url()/params()/locals()/cookies()/response()/env(); publicEnv().
4. app/server/render.ts: PageRenderer interface (PageTree -> Promise<{ head, body, stream? }>) + composePageTree(tree, createComponent) for the TASK-16 adapter; app/server/document.ts: default document, custom src/document.stsx via { head, body } SSRNodes, stream assembly.
5. app/server/handler.ts: createRequestHandler({ manifest, loadModule, render, middleware, document, headAssets, env, dev, onError }) -> { fetch }: match, ctx, middleware chain (function or array), endpoints (all methods, HEAD fallback, OPTIONS, 405 + Allow), pages through layouts, _404/_error with { status, error }, control-flow handling, cookies/headers finalisation, status/headers sealed after the shell.
6. Exports: server APIs in app/public.server.ts; types + isomorphic helpers + throwing server-only stubs in app/public.ts (types resolve to the browser entry).
7. Vitest integration tests over fetch with in-memory manifests and mock modules using a temporary string renderer fixture; tsc check for Locals augmentation. Run pnpm typecheck/test/lint.
8. When TASK-16 is Done: adapter from Spark's renderToStream to PageRenderer + end-to-end tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: may start before TASK-16. Build the fetch handler, middleware, endpoints, cookies, redirects and document against a small render interface; integrate renderToStream and add the end-to-end tests once TASK-16 is Done (the dependency stays for completion).

Nova: started (session nova-task22-20261008T124332Z). Building against a local PageRenderer interface until TASK-16 is Done.
<!-- SECTION:NOTES:END -->
