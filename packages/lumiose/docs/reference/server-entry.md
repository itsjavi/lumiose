# Server build (`dist/server/entry.js`)

> What `lumiose build` writes for servers: one web-standard fetch handler for pages, endpoints, actions and static files.

Concepts: [Rendering modes](../concepts/rendering-modes.md) (the build), [Server](../concepts/server.md)
(the request context). For Node, use [`@lumiose/adapter-node`](adapter-node.md).

## default export

```ts
declare const handler: {
  fetch(request: Request, platform?: Partial<Platform>): Promise<Response>;
};
export default handler;
```

A request goes through, in order:

1. **Static files** (`GET` and `HEAD` below Vite's `base`): the files of `dist/client`, with the
   same rules as `@lumiose/adapter-node`: prerendered pages by URL (`/about` serves
   `about/index.html`, or `about.html` with `trailingSlash: "never"`, and the `"always"`/`"never"`
   policies redirect with `308`), the `.br`/`.gz` copies the build wrote for clients that accept
   them (`Vary: Accept-Encoding`), a year of caching (`immutable`) for content-hashed assets and
   revalidation (`ETag`, `Last-Modified`, `304`) for everything else. Dot files (other than
   `.well-known`), `..` and `_headers` are never served. The directory is read with `node:fs` and
   indexed on the first request: files added later are not served until a restart.
2. **The app**: endpoints, form actions and pages, rendered shell first and streamed
   (`<Suspense>`). The request's `signal` aborts the render when the client goes away. Bodies are
   bounded by `lumiose({ limits })` (`413`).
3. **Headers**: `lumiose({ headers })` for the path, and Lumiose's defaults
   (`X-Content-Type-Options`, `Referrer-Policy`), go on every response that does not set them
   itself.

It does not compress the app's responses on the fly (static files use their precompressed
copies): put a CDN or proxy that compresses in front. On Node, `@lumiose/adapter-node` compresses.

The function works detached (`const { fetch } = handler`). Builds made with a deploy adapter
(Cloudflare, Vercel, Netlify) leave the static files to the platform, which serves `dist/client`
before calling the function.

## platform

```ts
interface Platform {
  /** The platform's bindings (Cloudflare's env); {} where there are none. */
  readonly env: PlatformEnv;
  /** Keeps the host running `promise` after the response; elsewhere it just runs. */
  waitUntil(promise: Promise<unknown>): void;
  /** The client's IP address as the host sees it (a proxy's, behind one). */
  readonly clientAddress: string | undefined;
}
interface PlatformEnv {} // augment: declare module "lumiose" { interface PlatformEnv { … } }
```

The second argument becomes `ctx.platform` in middleware, endpoints and actions
([Server](../concepts/server.md)). Every field has a fallback: `env` is `{}`, `waitUntil` lets the
promise run and reports a rejection like any server error, `clientAddress` is `undefined`.
Server environment variables stay in `ctx.env` and `env(name)`.

What each host passes:

| Host                                   | `env`         | `waitUntil`     | `clientAddress`             |
| -------------------------------------- | ------------- | --------------- | --------------------------- |
| `@lumiose/adapter-node`, `lumiose dev` | `{}`          | fallback        | the socket's remote address |
| Bun (`Bun.serve` passes its server)    | `{}`          | fallback        | `server.requestIP(request)` |
| Deno (`deno serve` passes its info)    | `{}`          | fallback        | `info.remoteAddr.hostname`  |
| workerd (`fetch(request, env, ctx)`)   | the bindings  | `ctx.waitUntil` | `CF-Connecting-IP`          |
| Your own server                        | what you pass | what you pass   | what you pass               |

Behind a reverse proxy, `clientAddress` is the proxy's: read the header your proxy sets
(`X-Forwarded-For`, `X-Real-IP`) in middleware if you trust it.

Type your platform's bindings by augmenting `PlatformEnv`:

```ts
// src/env.d.ts
declare module "lumiose" {
  interface PlatformEnv {
    DB: D1Database; // Cloudflare D1, typed by @cloudflare/workers-types
  }
}
export {};
```

## createHandler

```ts
export function createHandler(options?: {
  /** ctx.env and env(). Default: process.env. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Unexpected errors. Default: console.error. */
  onError?: (error: unknown, request: Request) => void;
}): { fetch(request: Request, platform?: Partial<Platform>): Promise<Response> };
```

The app alone: no static files and no `lumiose({ headers })`. `@lumiose/adapter-node` uses it
behind its own static file server.

## config

```ts
export const config: {
  base: string; // Vite's base, with slashes: "/" or "/docs/"
  trailingSlash: "ignore" | "always" | "never";
  assetsDir: string; // "assets": content-hashed files
  headers?: HeadersOption; // lumiose({ headers })
};
```

What servers of `dist/client` need to know about the build.

## Run it

Build first (`lumiose build`), then start the entry from the project directory, so that the npm
dependencies it imports resolve from `node_modules`.

**Bun** starts a server for a module whose default export has `fetch`
(`PORT`, default 3000):

```sh
NODE_ENV=production PORT=3000 bun dist/server/entry.js
```

**Deno** serves it with `deno serve` (`--port`, default 8000). It reads `dist/client` and the
environment:

```sh
deno serve --allow-net --allow-read --allow-env --port 3000 dist/server/entry.js
```

**Node**: use [`@lumiose/adapter-node`](adapter-node.md) (`createServer()`), which adds on-the-fly
compression and Node's streaming. Any server that takes a fetch handler works too:

```ts
// server.ts, with Hono's Node server: `node server.ts`
import { serve } from "@hono/node-server";
import handler from "./dist/server/entry.js";

serve({ fetch: (request) => handler.fetch(request), port: 3000 });
```

For Cloudflare, Vercel, Netlify, static hosts and the rest, see the
[deploy guides](../deploy/README.md).

## Example

Using the platform in an endpoint: record a visit after the response, without delaying it.

```ts check
import type { Endpoint } from "lumiose";

export const POST: Endpoint = (ctx) => {
  const visitor = ctx.platform.clientAddress ?? "unknown";
  ctx.platform.waitUntil(
    fetch("https://analytics.example.com/hit", { method: "POST", body: visitor }),
  );
  return new Response(null, { status: 204 });
};
```
