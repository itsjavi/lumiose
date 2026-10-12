# Netlify

> Deploy to Netlify with `@lumiose/adapter-netlify`: `dist/client` is the site, and the build's fetch handler runs as a Netlify Function for every path no static file answers.

Tested locally with `netlify serve`, not yet on Netlify itself: see the
[verification table](README.md#verification).

## Set it up

```sh
pnpm add -D @lumiose/adapter-netlify
```

```ts
// vite.config.ts
import { netlify } from "@lumiose/adapter-netlify";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ adapter: netlify() })],
});
```

```toml
# netlify.toml, next to package.json
[build]
  command = "lumiose build"
  publish = "dist/client"
```

Push to a site connected to the repository, or deploy from the command line with
`pnpm dlx netlify-cli deploy --build`. `netlify serve` runs the build and serves it locally.
`lumiose build` warns when the project has no `netlify.toml`.

**In a monorepo**, set the site's package directory to the app's directory: Netlify then runs the
command from the repository root, so name the package and the full publish path:

```toml
[build]
  command = "pnpm --filter my-app build"
  publish = "apps/my-app/dist/client"
```

## What the build writes

| Path                                        | What it is                                                                                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/client`                               | The site (`publish`). Netlify serves it first.                                                                                                                                                       |
| `dist/client/_headers`                      | `lumiose({ headers })` and Lumiose's default headers for the static files, plus a year of caching (`immutable`) for `/assets/*`, whose files Vite names by content hash.                             |
| `.netlify/v1/functions/lumiose-server.mjs`  | The server: a Netlify Function (web `Request`/`Response`) for every path below Vite's `base` that no static file answers (`preferStatic`). Netlify bundles it with its npm packages when it deploys. |
| `.netlify/v1/functions/lumiose-actions.mjs` | Only when prerendered pages have form actions: the same server for their `POST`s, which Netlify would otherwise answer from the static file (`405`).                                                 |

Netlify compresses responses itself: the build writes no `.br`/`.gz` copies. Add `.netlify/` to
`.gitignore`.

## The platform in your code

- `ctx.platform.clientAddress`: the function context's `ip`.
- `ctx.platform.waitUntil(promise)`: the context's `waitUntil`, for work after the response.
- `ctx.platform.env` is empty: variables are in `process.env`, `env("NAME")` and `ctx.env`.

## Good to know

- Static files skip the function, so middleware does not run for them. Headers they need belong in
  `lumiose({ headers })`.
- Streaming works: the shell of a page is sent first, `<Suspense>` content follows.
- `netlify serve` sends `cache-control: public, max-age=0` for static files whatever `_headers`
  says. On Netlify itself, `_headers` sets it, as Netlify documents (not verified yet).
- A site whose every route is prerendered needs no function: the build writes none, and Netlify
  serves `404.html` for unknown URLs.

## API

```ts
import { netlify } from "@lumiose/adapter-netlify";

function netlify(): Adapter; // for lumiose({ adapter })
```
