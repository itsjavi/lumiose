# Server

> Middleware, endpoints, form actions and server renders all get the request context: URL, params, cookies, locals and the response.

## Concept

**Request context.** Middleware, endpoints and actions receive
`ctx = { request, url, params, route, locals, cookies, env, platform }`, where `route` is the
matched pattern (`"/users/[id]"`; `undefined` in `src/middleware.ts` for a URL no route matches).
During a server render, the same values are
available through functions scoped to the current request (they work after `await` too):
`request()`, `url()`, `params()`, `route()` (the matched pattern), `locals()`, `cookies()`,
`response()` and `env(name)`.

**Platform.** `ctx.platform` is what the host adds to a request: `env` (the platform's bindings,
such as Cloudflare's KV or D1; `{}` elsewhere), `waitUntil(promise)` (work that continues after the
response) and `clientAddress` (the client's IP as the host sees it). Each has a fallback, so the
same code runs on every host ([server build](../reference/server-entry.md#platform)). Type the
bindings by augmenting `PlatformEnv`. A server component that needs them gets them from middleware,
through `locals`.

**Middleware.** `src/middleware.ts` default-exports `(ctx, next) => Promise<Response>` (or an array,
run in order) and runs for every request. Use it for sessions, auth and headers. Put request data on
`ctx.locals`, and type it by augmenting `Locals`:

```ts
declare module "lumiose" {
  interface Locals {
    user: { id: string; name: string } | null;
  }
}
```

**Folder middleware.** A `middleware.ts` (or `.js`) in a route folder has the same default export and
runs for every page, form action and `route.ts` endpoint in that folder and below it. That makes it
the place for a section's auth: a layout guard (`locals()` plus `redirect()`) covers the folder's
pages, but not their actions or endpoints. Group folders count: `(account)/middleware.ts` covers
every route in the group without a URL segment.

- **Order.** The trailing-slash redirect and the cross-site check answer first. Then
  `src/middleware.ts`, and inside its `next()` the route's locale checks (`/es/admin` runs the
  `/admin` middleware), the folder middleware from the outermost folder to the innermost, and the
  route. Responses unwind in reverse. URLs that match no route run `src/middleware.ts` only.
- **Errors.** What folder middleware throws (`redirect()`, `error()`, any error) renders the
  route's error page outside the chain, as for `src/middleware.ts`.
- **Types.** `Middleware<"/admin">` takes the folder's URL scope (the pattern `LayoutProps` takes):
  `ctx.params` holds the folder's params and `ctx.route` the patterns below it.
- **SPA routes.** Client navigations between `spa` pages do not reach the server. The middleware
  runs for the document request and for the actions and endpoints below the folder, which is what
  protects an SPA's data.
- **Prerendered routes.** Like `src/middleware.ts`, folder middleware runs whenever the app handles
  a route: per request for server routes, for every route in `lumiose dev`, and at build time for
  prerendered pages, whose files production serves without the app. It cannot guard those, so
  `lumiose check` and the build warn ([`LUM5008`](../errors/LUM5008.md)).
- `src/routes/middleware.ts` is an error ([`LUM5002`](../errors/LUM5002.md)): the app's middleware
  is `src/middleware.ts`. `lumiose routes` prints each route's middleware chain.

**Control flow.** `redirect(to, status?)`, `notFound()` and `error(status, message?)` throw; the
framework turns them into a redirect or the nearest `not-found`/`error` page. Without a status,
`redirect()` uses 302 for GET/HEAD and 303 for other methods.

**Cookies.** `cookies.get/getAll/set/delete`. Defaults: `path=/`, `httpOnly`, `sameSite=lax`, and
`secure` on HTTPS and in production. `signedCookie(name)` signs values with HMAC-SHA256 (secret:
`LUMIOSE_SECRET`, or rotate with an array of secrets); signing protects integrity, not
confidentiality. Secrets must be at least 32 bytes: a shorter one throws in production and warns
in development, unless you pass `{ allowWeakSecret: true }`. Generate one with
`openssl rand -base64 32`.

**Status and headers.** `response().setStatus()` and `setHeader()` change the page response, and
a page may export `headers(ctx)`. They are writable **until the shell is sent** (see
[Rendering modes](rendering-modes.md)); a change inside a streamed `<Suspense>` boundary is
`LUM5004`.

**Env.** `env("NAME")` reads server env variables (the adapter's env, else `process.env`) in
server-only code. Only `import.meta.env.PUBLIC_*` reaches client code (`@lumiose/vite` sets Vite's
`envPrefix` to `"PUBLIC_"` unless the config sets its own); `publicEnv()` returns that subset.

**Server-only code** lives in `*.server.ts` modules and under `src/server/`. Importing it from code
that reaches the browser is `LUM4003`, also through a web worker, `new URL("…", import.meta.url)`
or a `?raw`/`?url` import. `lumiose dev` does not serve these files over HTTP either: they are added
to Vite's `server.fs.deny` unless the config sets its own list (the server still loads them).

### Instrumentation

`src/instrumentation.server.ts` (also `.js` or `.mjs`; server-only by its `.server.` segment) is
where error reporting and tracing start. `lumiose dev`, `lumiose preview`, the server build
(`dist/server/entry.js` on any host) and the deploy adapters load it; prerendering at build time
does not, since errors there fail the build. Its three exports are optional:

- **`register()`** runs once per server instance (per isolate on workers), before the first
  request, which waits for it: start an SDK here. `lumiose dev` runs it again after an edit of the
  file. What it throws is logged, and the server goes on.
- **`onRequestError(error, info)`** receives the unexpected errors of a request on every host,
  `lumiose dev` included: those that render the `error` page or answer 500, errors of streamed
  `<Suspense>` boundaries, rejected `ctx.platform.waitUntil()` work, and errors an
  `<ErrorBoundary>` caught, with the `digest` its fallback shows outside dev. `redirect()`,
  `notFound()` and `error(status)` are not errors. `info` is `{ request, route, params, phase,
  digest }`, with `phase` one of `"middleware"` (also the route's locale checks), `"action"`,
  `"endpoint"`, `"render"`, `"stream"` or `"waitUntil"`. The handler's `onError` (the host's log,
  `console.error` by default) still gets each error first, except those an `<ErrorBoundary>`
  caught in dev.
- **`instrumentations`**, an array of observers with optional wrappers per phase: `request` (a
  request until its response is ready to send, `call()`'s result adds `response.status`),
  `middleware` (each middleware file, `info.file`), `action` (`info.name`: the key in `actions`,
  or `"default"`), `endpoint` (`info.method`), `render` (a page or error page until its shell is
  ready) and `stream` (each streamed boundary). A wrapper gets `call` and `info`
  (`{ request, route, params }` plus those): call `call()` where the phase runs and await it to
  time it. It never throws and resolves to `{ status: "success" }` or `{ status: "error", error }`.
  A wrapper only observes: the phase runs once, also when the wrapper never calls `call()`, its
  result is the phase's own, and what a wrapper throws is logged. The first observer is the
  outermost. Static files are served before the app and are not observed; a `fetchJSON()` the
  render handles in-process gets its phases observed, not a `request` of its own.

Without the file nothing loads; with it, a phase without wrappers costs one check.

> **Status:** the request handler, middleware, endpoints, cookies, env, error pages and
> instrumentation are available, served by `lumiose dev` and by the build output
> (`lumiose preview`, [`@lumiose/adapter-node`](../reference/adapter-node.md), the deploy adapters).

## API

| API                                                                               | Use                                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `RequestContext<P>` (`ctx`)                                                       | `{ request, url, params, route, locals, cookies, env, platform }`.     |
| `Middleware<P?>`                                                                  | `(ctx, next) => Response \| Promise<Response>`; `P`: a folder's scope. |
| `request()`, `url()`, `params<P>()`, `route()`, `locals()`, `cookies()`           | Request APIs during a server render.                                   |
| `response()`                                                                      | `{ status, setStatus, getHeader, setHeader }` until the shell is sent. |
| `redirect(to, status?)`, `notFound(message?)`, `error(status, message?)`          | Throw to stop rendering.                                               |
| `isRedirect(e)`, `isHttpError(e)`                                                 | Recognize those when you catch errors.                                 |
| `signedCookie(name, options?)`                                                    | `{ get(cookies), set(cookies, value), delete(cookies) }`.              |
| `env(name)`, `publicEnv(source?)`                                                 | Server env; the `PUBLIC_*` subset.                                     |
| `Locals`                                                                          | Interface to augment with your request data.                           |
| `Platform`, `PlatformEnv`                                                         | `ctx.platform`; the interface to augment with your bindings.           |
| `src/instrumentation.server.ts`: `register`, `onRequestError`, `instrumentations` | Observes the server ([Instrumentation](#instrumentation)).             |
| `RequestErrorInfo`, `ServerInstrumentation`                                       | `onRequestError`'s `info`; one observer of `instrumentations`.         |

## Example

```ts check file=middleware.ts
// src/middleware.ts
import { signedCookie, type Middleware } from "lumiose";

const session = signedCookie("session");

declare module "lumiose" {
  interface Locals {
    userId: string | null;
  }
}

const middleware: Middleware = async (ctx, next) => {
  ctx.locals.userId = (await session.get(ctx.cookies)) ?? null;
  const res = await next();
  res.headers.set("x-frame-options", "DENY");
  return res;
};

export default middleware;
```

```ts check file=routes/account/middleware.ts
// src/routes/account/middleware.ts: every page, action and endpoint under /account
import type { Middleware } from "lumiose";

const requireUser: Middleware<"/account"> = (ctx, next) => {
  if (ctx.locals.userId === null) return Response.redirect(new URL("/login", ctx.url), 303);
  return next();
};

export default requireUser;
```

```tsx check file=routes/account/page.tsx
// src/routes/account/page.tsx
import { locals, redirect, response } from "lumiose";

export const mode = "server";

export default function Account() {
  const { userId } = locals();
  if (userId === null) redirect("/login");
  response().setHeader("cache-control", "private, no-store");

  return <h1>Signed in as {userId}</h1>;
}
```

```ts check file=instrumentation.server.ts
// src/instrumentation.server.ts
import type { RequestErrorInfo, ServerInstrumentation } from "lumiose";

export async function register() {
  // Once per server instance, before the first request: start an SDK here.
}

export function onRequestError(error: unknown, info: RequestErrorInfo) {
  const where = `${info.request.method} ${info.route ?? "(no route)"} [${info.phase}]`;
  console.error(where, info.digest ?? "", error);
}

export const instrumentations: ServerInstrumentation[] = [
  {
    request: async (call, info) => {
      const start = performance.now();
      const result = await call();
      const status = result.status === "success" ? result.response?.status : "failed";
      const ms = Math.round(performance.now() - start);
      console.log(`${info.request.method} ${info.route ?? "-"} ${status} ${ms} ms`);
    },
  },
];
```

Tracing with [OpenTelemetry](https://opentelemetry.io/docs/languages/js/): install
`@opentelemetry/api` and an SDK (`@opentelemetry/sdk-node` with an exporter), start the SDK in
`register()`, and open a span per phase. Spans nest as the phases do: middleware inside the request,
the action, endpoint or render inside the middleware. Instrumenting other libraries automatically
(database drivers, `fetch`) still needs `node --import`, as OpenTelemetry documents.

```ts
// src/instrumentation.server.ts
import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import type { ServerInstrumentation } from "lumiose";

export async function register() {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  new NodeSDK({ serviceName: "my-app" }).start(); // exporters from OTEL_* env variables
}

const tracer = trace.getTracer("my-app");

/** A span around one phase, failed when the phase failed. */
const span =
  (name: string, attributes: Attributes) =>
  (call: () => Promise<{ status: "success" | "error"; error?: unknown }>) =>
    tracer.startActiveSpan(name, { attributes }, async (s) => {
      const result = await call();
      if (result.status === "error") {
        s.recordException(result.error as Error);
        s.setStatus({ code: SpanStatusCode.ERROR });
      }
      s.end();
    });

export const instrumentations: ServerInstrumentation[] = [
  {
    request: (call, info) =>
      tracer.startActiveSpan(`${info.request.method} ${info.route ?? ""}`, async (s) => {
        s.setAttributes({
          "http.request.method": info.request.method,
          "http.route": info.route ?? "",
        });
        const result = await call();
        if (result.status === "success" && result.response !== undefined) {
          s.setAttribute("http.response.status_code", result.response.status);
          if (result.response.status >= 500) s.setStatus({ code: SpanStatusCode.ERROR });
        }
        s.end();
      }),
    middleware: (call, info) => span("middleware", { "code.file.path": info.file })(call),
    action: (call, info) => span(`action ${info.name}`, { "http.route": info.route ?? "" })(call),
    endpoint: (call, info) =>
      span(`${info.method} handler`, { "http.route": info.route ?? "" })(call),
    render: (call, info) => span("render", { "http.route": info.route ?? "" })(call),
    stream: (call, info) => span("stream", { "http.route": info.route ?? "" })(call),
  },
];
```

## Common mistakes

- **Reporting errors from middleware with `try`/`catch` around `next()`.** The error page, the
  `500` of an endpoint and streamed boundaries never throw there. Use `onRequestError` in
  `src/instrumentation.server.ts`.
- **Changing the request in an instrumentation wrapper.** Wrappers observe: they cannot change
  arguments, results or the response. Use middleware for that.

- **Guarding a section in a layout.** A layout's `redirect()` does not cover the folder's form
  actions or endpoints. Put the check in the folder's `middleware.ts`.
- **Guarding prerendered routes with folder middleware.** It runs at build time only for them
  (`LUM5008`). Set `export const mode = "server"` on the routes it protects.
- **Reading request APIs in a `static` route.** `cookies()`, `request()` and friends throw
  `LUM5001` while prerendering. Set `export const mode = "server"`.
- **Setting headers or status after the shell.** Inside a streamed `<Suspense>` boundary it is too
  late (`LUM5004`). Do it before the boundary, in the page body outside `<Suspense>`, in
  `headers(ctx)` or in middleware.
- **Reading secrets with `import.meta.env`.** Only `PUBLIC_*` values exist there. Use `env("NAME")`
  in server-only modules.
- **Catching `redirect()` by accident.** It throws. In a `try`/`catch`, rethrow when
  `isRedirect(error) || isHttpError(error)`.
- **Storing request data in module-scope variables.** Modules are shared by every request. Use
  `locals`, context or component state (`LUM4008`).
- **Expecting signed cookies to hide data.** They are tamper-proof, not encrypted.

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4008](../errors/LUM4008.md): module-scope signal written during SSR.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file, such as `src/routes/middleware.ts`.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM5008](../errors/LUM5008.md): folder middleware covering prerendered routes.

See also: [Data and actions](data-and-actions.md), [Routing](routing.md), [reference: app layer](../reference/app.md).
