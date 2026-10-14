# Cloudflare Workers

> Deploy to Cloudflare Workers with `@lumiose/adapter-cloudflare`: the app runs as a Worker, the static files as assets.

Tested locally in `wrangler dev` (workerd), not yet on Cloudflare itself: see the
[verification table](README.md#verification).

## Set it up

```sh
pnpm add -D @lumiose/adapter-cloudflare wrangler
```

```ts
// vite.config.ts
import { cloudflare } from "@lumiose/adapter-cloudflare";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ adapter: cloudflare() })],
});
```

```jsonc
// wrangler.jsonc, next to package.json
{
  "name": "my-app",
  "main": "dist/_worker.js",
  "compatibility_date": "2026-09-01",
  // AsyncLocalStorage, which Lumiose's request APIs use, and process.env for your variables.
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "dist/client" },
}
```

Then build and deploy:

```sh
pnpm lumiose build
pnpm wrangler deploy      # or `wrangler dev` to try the build locally first
```

`lumiose build` warns, with a config to copy, when the project has no `wrangler.jsonc`,
`wrangler.json` or `wrangler.toml`. A site whose every route is prerendered builds no Worker: drop
`main`, and Cloudflare serves the assets alone.

## What the build writes

| File                        | What it is                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/_worker.js`           | The Worker: `dist/server/entry.js`'s `fetch`, called with `ctx.platform` (below). Wrangler bundles it, with the npm packages your server code imports, when it deploys.                                                                                                                              |
| `dist/client`               | The static assets. Cloudflare serves a request that matches a file without running the Worker.                                                                                                                                                                                                       |
| `dist/client/_headers`      | `lumiose({ headers })` and Lumiose's default headers for the static files, plus a year of caching (`immutable`) for `/assets/*`, whose files Vite names by content hash, except files you put in `public/assets/` (`! cache-control`). The Worker's responses get the same headers from the handler. |
| `dist/client/.assetsignore` | Only when prerendered pages have form actions: their HTML is left out of the assets, because Cloudflare answers a `POST` to a static file itself (`405`). The Worker renders those pages, fully resolved, and runs their actions.                                                                    |

Cloudflare compresses responses itself, so the build writes no `.br`/`.gz` copies, and the server
build leaves out its own static file layer (no `node:fs`).

## The platform in your code

Middleware, endpoints and actions get Cloudflare's arguments as `ctx.platform`:

- `ctx.platform.env`: the Worker's bindings (KV, D1, R2, Durable Objects, variables, secrets).
- `ctx.platform.waitUntil(promise)`: `ctx.waitUntil()`, for work after the response.
- `ctx.platform.clientAddress`: the `CF-Connecting-IP` header.

Type your bindings by augmenting `PlatformEnv` (with `@cloudflare/workers-types` or the types
`wrangler types` generates):

```ts
// src/routes/api/notes/route.ts
import type { Endpoint } from "lumiose";

declare module "lumiose" {
  interface PlatformEnv {
    DB: D1Database;
  }
}

export const mode = "server";

export const GET: Endpoint<"/api/notes"> = async (ctx) => {
  const { results } = await ctx.platform.env.DB.prepare("select * from notes").all();
  return Response.json(results);
};
```

Server components read them through middleware: copy what they need to `ctx.locals`.
Variables and secrets are also in `process.env` with `nodejs_compat` (compatibility dates from
2025-04-01), so `env("NAME")` and `ctx.env.NAME` work as on Node.

## Trailing slashes

Cloudflare's assets follow `assets.html_handling`. Match it to `lumiose({ trailingSlash })`:

| `trailingSlash`      | `html_handling`                   | `/about`                       |
| -------------------- | --------------------------------- | ------------------------------ |
| `"ignore"` (default) | `"auto-trailing-slash"` (default) | redirects to `/about/` (`307`) |
| `"always"`           | `"force-trailing-slash"`          | redirects to `/about/`         |
| `"never"`            | `"drop-trailing-slash"`           | serves `about.html`            |

With `"ignore"`, Lumiose serves both forms itself, but Cloudflare redirects `/about` before the
Worker runs.

## Good to know

- Static files skip the Worker, so middleware does not run for them. Headers they need belong in
  `lumiose({ headers })`.
- Streaming works: the shell of a page is sent first, `<Suspense>` content follows.
- Unknown URLs reach the Worker, which renders your `not-found` page. Without a Worker (a static
  site), set `"not_found_handling": "404-page"` in `assets` to serve `404.html`.
- The Worker's npm packages must run on Workers: with `nodejs_compat`, many Node.js APIs do, but
  not everything (native modules, the file system of a server).

## API

```ts
import { cloudflare } from "@lumiose/adapter-cloudflare";

function cloudflare(): Adapter; // for lumiose({ adapter })
```
