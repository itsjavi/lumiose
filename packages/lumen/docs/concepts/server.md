# Server

> Server code gets the request context everywhere: `ctx` in middleware, endpoints and actions, and `request()`, `url()`, `params()`, `route()`, `locals()`, `cookies()` and `response()` anywhere during a server render.

## Concept

**Request context.** Middleware, endpoints and actions receive
`ctx = { request, url, params, locals, cookies, env }`. During a server render, the same values are
available through functions scoped to the current request (they work after `await` too):
`request()`, `url()`, `params()`, `route()` (the matched pattern), `locals()`, `cookies()`,
`response()` and `env(name)`.

**Middleware.** `src/middleware.ts` default-exports `(ctx, next) => Promise<Response>` (or an array,
run in order). Use it for sessions, auth and headers. Put request data on `ctx.locals`, and type it
by augmenting `Locals`:

```ts
declare module "lumen" {
  interface Locals {
    user: { id: string; name: string } | null;
  }
}
```

**Control flow.** `redirect(to, status?)`, `notFound()` and `error(status, message?)` throw; the
framework turns them into a redirect or the nearest `_404`/`_error` page. Without a status,
`redirect()` uses 302 for GET/HEAD and 303 for other methods.

**Cookies.** `cookies.get/getAll/set/delete`. Defaults: `path=/`, `httpOnly`, `sameSite=lax`, and
`secure` on HTTPS and in production. `signedCookie(name)` signs values with HMAC-SHA256 (secret:
`LUMEN_SECRET`, or rotate with an array of secrets); signing protects integrity, not
confidentiality. Secrets must be at least 32 bytes: a shorter one throws in production and warns
in development, unless you pass `{ allowWeakSecret: true }`. Generate one with
`openssl rand -base64 32`.

**Status and headers.** `response().setStatus()` and `setHeader()` change the page response, and
a page may export `headers(ctx)`. They are writable **until the shell is sent** (see
[Rendering modes](rendering-modes.md)); a change inside a streamed `<Suspense>` boundary is
`LUM5004`.

**Env.** `env("NAME")` reads server env variables (the adapter's env, else `process.env`) in
server-only code. Only `import.meta.env.PUBLIC_*` reaches client code; `publicEnv()` returns that
subset.

**Server-only code** lives in `*.server.ts` modules and under `src/server/`. Importing it from code
that reaches the browser is `LUM4003`.

> **Status:** the request handler, middleware, endpoints, cookies, env and error pages are
> available, served by `lumen dev` and by the build output (`lumen preview`,
> [`@lumen/adapter-node`](../reference/adapter-node.md)).

## API

| API                                                                      | Use                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `RequestContext<P>` (`ctx`)                                              | `{ request, url, params, locals, cookies, env }`.                      |
| `Middleware`                                                             | `(ctx, next) => Response \| Promise<Response>`.                        |
| `request()`, `url()`, `params<P>()`, `route()`, `locals()`, `cookies()`  | Request APIs during a server render.                                   |
| `response()`                                                             | `{ status, setStatus, getHeader, setHeader }` until the shell is sent. |
| `redirect(to, status?)`, `notFound(message?)`, `error(status, message?)` | Throw to stop rendering.                                               |
| `isRedirect(e)`, `isHttpError(e)`                                        | Recognize those when you catch errors.                                 |
| `signedCookie(name, options?)`                                           | `{ get(cookies), set(cookies, value), delete(cookies) }`.              |
| `env(name)`, `publicEnv(source?)`                                        | Server env; the `PUBLIC_*` subset.                                     |
| `Locals`                                                                 | Interface to augment with your request data.                           |

## Example

```ts check file=middleware.ts
// src/middleware.ts
import { signedCookie, type Middleware } from "lumen";

const session = signedCookie("session");

declare module "lumen" {
  interface Locals {
    userId: string | null;
  }
}

const middleware: Middleware = async (ctx, next) => {
  ctx.locals.userId = (await session.get(ctx.cookies)) ?? null;
  if (ctx.url.pathname.startsWith("/account") && ctx.locals.userId === null) {
    return Response.redirect(new URL("/login", ctx.url), 303);
  }
  const res = await next();
  res.headers.set("x-frame-options", "DENY");
  return res;
};

export default middleware;
```

```tsx check file=routes/account.tsx
// src/routes/account.tsx
import { locals, redirect, response } from "lumen";

export const mode = "server";

export default function Account() {
  const { userId } = locals();
  if (userId === null) redirect("/login");
  response().setHeader("cache-control", "private, no-store");

  return <h1>Signed in as {userId}</h1>;
}
```

## Common mistakes

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
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.

See also: [Data and actions](data-and-actions.md), [Routing](routing.md), [reference: app layer](../reference/app.md).
