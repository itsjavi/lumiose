---
id: TASK-22
title: 'Implement request handling, middleware, endpoints and document'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 12:53'
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
- [x] #1 export default { fetch } entry; ctx { request, url, params, locals, cookies, env }; typed Locals; middleware chain; endpoints for every method
- [x] #2 cookies with signedCookie(); redirect/notFound/error helpers; env() with PUBLIC_ client env; default and custom document.stsx; _404/_error pages with status
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

Nova: app layer implemented in packages/lumen/src/app/server/ (control.ts, cookies.ts, context.ts, scope.ts, render.ts, document.ts, handler.ts, browser.ts, index.ts) + exports in app/public.ts / app/public.server.ts + LumenError/LUM4003/LUM5004 in app/diagnostics.ts.

- createRequestHandler({ manifest, loadModule, render, middleware?, document?, headAssets?, env?, dev?, prerender?, onError? }) -> { fetch } (closure, works unbound for export default { fetch }). Internal entry: app/server/index.ts (no package export yet).
- ctx { request, url, params, locals, cookies, env }; Locals declared once in app/server/context.ts and exported from both lumen entries (augment with declare module "lumen" { interface Locals {...} }). Beacon's env.d.ts also declares an empty Locals augmentation: redundant but merges fine (verified with tsc 7).
- Middleware: default export function or array (run in order); must return a Response; next() at most once. Runs for pages, endpoints and unmatched URLs.
- Endpoints: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS exports; HEAD falls back to GET without body; OPTIONS defaults to 204 + Allow; others 405 + Allow. Thrown error() -> text/plain with status; unexpected -> 500 (stack in dev).
- Pages: GET/HEAD render layouts (outermost first, { params, children } with children as a getter) + page ({ params }); page headers(ctx) export applied; OPTIONS 204, other methods 405 (TASK-23 adds POST for actions).
- redirect(to, status?) defaults to 302 for GET/HEAD and 303 otherwise; only 301/302/303/307/308 allowed; non-ASCII locations are encodeURI'd. notFound() -> 404; error(status 400-599, message?).
- Errors: 404s render the page's nearest _404 (or the _404 covering the URL when unmatched), then _error, then a built-in page; other errors render _error with { status, error } (unexpected errors masked as 500 outside dev, reported to onError). Error pages render inside their folder's layouts, retried without layouts if that fails, then the built-in fallback. Headers set by the failed page are dropped; middleware headers and cookies are kept.
- Request scope: AsyncLocalStorage; server-only accessors request(), url(), params<P>(), locals(), cookies(), response() (setStatus/setHeader), env(name), publicEnv(), signedCookie(). The browser entry exports same-signature stubs that throw LUM4003 (types resolve through index.ts and both entries must expose the same names).
- decision-19: the response status/headers seal when the shell resolves; cookies seal when the response is finalised. Later writes throw LUM5004.
- Cookies: RFC 6265 parse/serialize; defaults path=/, HttpOnly, SameSite=Lax, Secure unless dev on http; get() sees writes from the same request. signedCookie(name, { secret? }) = HMAC-SHA256 over name=value via WebCrypto, base64url, secret arrays rotate keys; the default secret is env LUMEN_SECRET.
- Document: default <!doctype html><html lang="en"><head><meta charset><meta viewport>{head}</head><body>{body}</body></html>; custom src/document.stsx default export gets { head, body } SSRNodes, is called directly inside the request scope, the doctype is prepended, and the Suspense stream is spliced in after the body.
- Render seam (render.ts): PageRenderer = (tree: PageTree, { request, signal, resolveAll }) => Promise<RenderedShell { head: string; body: string; stream: ReadableStream<string | Uint8Array> | null }>; composePageTree(tree, createComponent) builds the root thunk for lumen/server.

Validation: pnpm typecheck OK; pnpm lint OK (0 errors, no warnings in app/); pnpm test 223/223 (app/server: handler.test.ts 30 integration tests over fetch with in-memory manifests and mock modules on a temporary string renderer fixture in app/server/__fixtures__/string-renderer.ts; cookies.test.ts 10; public-api.test.ts 6, including a TS 7 tsc check of the Locals augmentation, Middleware/Endpoint typing and params<P>()).

Remaining for TASK-16 integration (task stays In Progress):
1. lumen/server must provide renderToStream(root: () => unknown, options?: { signal?: AbortSignal; resolveAll?: boolean }): Promise<{ head: string; body: string; stream: ReadableStream<string | Uint8Array> | null }>. It should resolve when the shell is ready and reject with the shell's first raw thrown value (so Redirect/HttpError instances survive). head is the collected, deduped <Head>/<Title>/<Meta> HTML. stream carries the boundary chunks to append inside <body>; it is null when resolveAll is set or nothing is pending. It runs in the caller's async context and reads request data through getRequestScope() from app/server/scope.ts (the accessors from TASK-16 AC #2 already live here, so do not duplicate them).
2. Add createServerRenderer(): PageRenderer = (tree, o) => renderToStream(composePageTree(tree, createComponent), o) in app/server/render.ts, and use it as the handler's default render.
3. End-to-end tests with real server-runtime components: Suspense streaming inside the document, <Title>/<Meta> in the default and custom document, ErrorBoundary in a boundary, and LUM5004 for redirect/head changes inside a boundary (Spark's check).
4. Confirm the custom document call path: a direct call vs createComponent for a context frame.
Follow-ups for other tasks: package export for createRequestHandler (TASK-24/26), Vite envPrefix PUBLIC_ (TASK-24), LUM5001 for request APIs while prerendering (TASK-26), spa/ssr=false shells (TASK-25), POST/actions on pages (TASK-23).
<!-- SECTION:NOTES:END -->
