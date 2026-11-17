# Server

> Middleware, endpoints, form actions and server renders all get the request context: URL, params, cookies, locals and the response.

## Concept

### Middleware

`src/middleware.ts` runs for every request: use it for sessions, auth and headers. It gets
`ctx = { request, url, params, route, locals, cookies, env, platform }`. Put request data on
`ctx.locals`, typed by augmenting `Locals`.

```ts check file=middleware.ts
import { signedCookie, type Middleware } from "lumiose";

const session = signedCookie("session");

declare module "lumiose" {
  interface Locals {
    userId: string | null;
  }
}

const middleware: Middleware = async (ctx, next) => {
  const userId = await session.get(ctx.cookies);
  ctx.locals.userId = userId ?? null;
  const res = await next();
  res.headers.set("x-frame-options", "DENY");
  return res;
};

export default middleware;
```

> **Details:** `ctx.route`, `ctx.platform` (bindings, `waitUntil`, `clientAddress`) and an array
> of middleware: [Request context and middleware](../reference/app.md#request-context-and-middleware).
> Signed cookies are tamper-proof, not encrypted; cookie defaults and secrets:
> [Responses, cookies and env](../reference/app.md#responses-cookies-and-env).

### Folder middleware

A `middleware.ts` in a route folder runs for every page, form action and endpoint in that folder
and below it. That makes it the place for a section's auth: a layout guard does not cover the
folder's actions or endpoints.

```ts check file=routes/account/middleware.ts
import type { Middleware } from "lumiose";

const requireUser: Middleware<"/account"> = (ctx, next) => {
  if (ctx.locals.userId === null) {
    const login = new URL("/login", ctx.url);
    return Response.redirect(login, 303);
  }
  return next();
};

export default requireUser;
```

> **Details:** the order of the chain, errors, SPA routes, and prerendered routes, which folder
> middleware cannot guard ([LUM5008](../errors/LUM5008.md)):
> [Request context and middleware](../reference/app.md#request-context-and-middleware).

### Request APIs in a render

During a server render the same values come from functions scoped to the request: `request()`,
`url()`, `params()`, `route()`, `locals()`, `cookies()`, `response()` and `env(name)`.
`redirect()`, `notFound()` and `error()` throw to stop rendering.

```tsx check file=routes/account/page.tsx
import { locals, redirect, response } from "lumiose";

export const mode = "server";

export default function Account() {
  const { userId } = locals();
  if (userId === null) redirect("/login");
  response().setHeader("cache-control", "private, no-store");

  return <h1>Signed in as {userId}</h1>;
}
```

> **Details:** status and headers are writable until the shell is sent
> ([LUM5004](../errors/LUM5004.md)). Redirect statuses, `env()` and `PUBLIC_*`, and server-only
> modules (`*.server.ts`, `src/server/`):
> [Responses, cookies and env](../reference/app.md#responses-cookies-and-env).

### Crawlers get one resolved document

Crawlers that do not run JavaScript index what the HTML holds: with streaming, the fallbacks, and
the content only inside `<template>` elements at the end. Lumiose ships no list of crawlers: test
the user agent in middleware, for example with
[`isbot`](https://www.npmjs.com/package/isbot), and turn streaming off for them.

```ts
// src/middleware.ts
import { isbot } from "isbot";
import { response, type Middleware } from "lumiose";

const middleware: Middleware = (ctx, next) => {
  const agent = ctx.request.headers.get("user-agent");
  if (isbot(agent)) response().setStreaming(false);
  return next();
};

export default middleware;
```

> **Details:** everyone else still gets the shell first. The response waits up to
> `lumiose({ streamTimeout })` (30 seconds by default), then the boundaries still pending fail
> ([LUM5009](../errors/LUM5009.md)). A shared cache that stores such pages should vary on the
> user agent, or store neither version.

### Instrumentation

`src/instrumentation.server.ts` is where error reporting and tracing start. `register()` runs
once per server instance, `onRequestError` receives every unexpected error of a request, and
`instrumentations` wrap the phases of a request to time them.

```ts check file=instrumentation.server.ts
import type { RequestErrorInfo, ServerInstrumentation } from "lumiose";

export async function register() {
  // Before the first request: start an SDK here.
}

export function onRequestError(error: unknown, info: RequestErrorInfo) {
  const route = info.route ?? "(no route)";
  console.error(route, info.phase, info.digest, error);
}

export const instrumentations: ServerInstrumentation[] = [
  {
    request: async (call, info) => {
      const start = performance.now();
      const result = await call();
      const ms = Math.round(performance.now() - start);
      console.log(info.route ?? "-", result.status, ms);
    },
  },
];
```

> **Details:** who loads the file, which errors arrive, and every phase with its `info`:
> [The instrumentation file](../reference/app.md#the-instrumentation-file). Spans per phase:
> [Tracing with OpenTelemetry](../guides/opentelemetry.md). The browser counterpart is
> `src/instrumentation.client.ts` ([Islands](islands.md#concept)).

## API

| API                                                                      | Use                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `RequestContext<P>` (`ctx`)                                              | `{ request, url, params, route, locals, cookies, env, platform }`.                   |
| `Middleware<P?>`                                                         | `(ctx, next) => Response \| Promise<Response>`; `P`: a folder's scope.               |
| `request()`, `url()`, `params<P>()`, `route()`, `locals()`, `cookies()`  | Request APIs during a server render.                                                 |
| `response()`                                                             | `{ status, setStatus, getHeader, setHeader, setStreaming }` until the shell is sent. |
| `redirect(to, status?)`, `notFound(message?)`, `error(status, message?)` | Throw to stop rendering.                                                             |
| `isRedirect(e)`, `isHttpError(e)`                                        | Recognize those when you catch errors.                                               |
| `signedCookie(name, options?)`                                           | `{ get(cookies), set(cookies, value), delete(cookies) }`.                            |
| `env(name)`, `publicEnv(source?)`                                        | Server env; the `PUBLIC_*` subset.                                                   |
| `Locals`                                                                 | Interface to augment with your request data.                                         |
| `Platform`, `PlatformEnv`                                                | `ctx.platform`; the interface for your bindings.                                     |
| `register`, `onRequestError`, `instrumentations`                         | Exports of `src/instrumentation.server.ts`.                                          |
| `RequestErrorInfo`, `ServerInstrumentation`                              | `onRequestError`'s `info`; one observer.                                             |

Signatures: [app layer](../reference/app.md).

## Example

An endpoint gets the same `ctx`. This one answers with the signed-in user's id, or 401.

```ts check file=routes/api/whoami/route.ts
import type { Endpoint } from "lumiose";

export const GET: Endpoint<"/api/whoami"> = (ctx) => {
  const { userId } = ctx.locals;
  if (userId === null) {
    return new Response("Sign in first", { status: 401 });
  }
  return Response.json({ userId });
};
```

## Common mistakes

- **`try`/`catch` around `next()` to report errors.** Error pages and streamed boundaries never
  throw there: use `onRequestError`.
- **Changing the request in an instrumentation wrapper.** Wrappers only observe.
- **Guarding a section in a layout.** Put the check in the folder's `middleware.ts`.
- **Guarding prerendered routes with folder middleware** (`LUM5008`).
- **Request APIs in a `static` route** (`LUM5001`). Set `mode = "server"`.
- **Headers or status after the shell** (`LUM5004`).
- **Secrets from `import.meta.env`.** Use `env("NAME")` in server-only modules.
- **Catching `redirect()` by accident.** Rethrow when `isRedirect(e) || isHttpError(e)`.
- **Request data in module-scope variables** (`LUM4008`). Use `locals`.

The long forms: [Common server mistakes](../reference/app.md#common-server-mistakes).

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4008](../errors/LUM4008.md): module-scope signal written during SSR.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file, such as `src/routes/middleware.ts`.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM5008](../errors/LUM5008.md): folder middleware covering prerendered routes.
- [LUM5009](../errors/LUM5009.md): boundary still pending when `streamTimeout` expired.

See also: [Data and actions](data-and-actions.md), [Routing](routing.md), [reference: app layer](../reference/app.md).
