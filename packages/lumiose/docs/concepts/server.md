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

> **Status:** the request handler, middleware, endpoints, cookies, env and error pages are
> available, served by `lumiose dev` and by the build output (`lumiose preview`,
> [`@lumiose/adapter-node`](../reference/adapter-node.md)).

## API

| API                                                                      | Use                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `RequestContext<P>` (`ctx`)                                              | `{ request, url, params, route, locals, cookies, env, platform }`.     |
| `Middleware<P?>`                                                         | `(ctx, next) => Response \| Promise<Response>`; `P`: a folder's scope. |
| `request()`, `url()`, `params<P>()`, `route()`, `locals()`, `cookies()`  | Request APIs during a server render.                                   |
| `response()`                                                             | `{ status, setStatus, getHeader, setHeader }` until the shell is sent. |
| `redirect(to, status?)`, `notFound(message?)`, `error(status, message?)` | Throw to stop rendering.                                               |
| `isRedirect(e)`, `isHttpError(e)`                                        | Recognize those when you catch errors.                                 |
| `signedCookie(name, options?)`                                           | `{ get(cookies), set(cookies, value), delete(cookies) }`.              |
| `env(name)`, `publicEnv(source?)`                                        | Server env; the `PUBLIC_*` subset.                                     |
| `Locals`                                                                 | Interface to augment with your request data.                           |
| `Platform`, `PlatformEnv`                                                | `ctx.platform`; the interface to augment with your bindings.           |

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

## Common mistakes

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
