# Vercel

> Deploy to Vercel with `@lumiose/adapter-vercel`: the static files plus the app as a Node.js or Edge function.

> **Status:** Tested locally with a harness for the Build Output API, not yet on Vercel itself:
> Vercel has no local runner for `.vercel/output` ([verification table](README.md#verification)).

## 1. Configure

Add the adapter to the Vite config, and `.vercel/` to `.gitignore`.

```sh
pnpm add -D @lumiose/adapter-vercel
```

```ts
// vite.config.ts
import { vercel } from "@lumiose/adapter-vercel";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // or vercel({ runtime: "edge" })
  plugins: [lumiose({ adapter: vercel() })],
});
```

## 2. Build

```sh
pnpm lumiose build
```

```text
.vercel/output/config.json
.vercel/output/static/
.vercel/output/functions/__lumiose.func/
```

The build writes the `.vercel/output` directory that Vercel deploys. What each part is:
[What the build writes](#what-the-build-writes).

## 3. Deploy

```sh
pnpm dlx vercel deploy --prebuilt
```

This deploys the output as it is. To let Vercel build on each push instead, set the project's
**Framework Preset** to "Other" and its **Build Command** to `lumiose build` (or `pnpm build`).

## 4. Verify

```sh
curl -sI https://my-app.vercel.app/ | head -n 1
```

```text
HTTP/2 200
```

Use the URL that `vercel deploy` prints.

## What the build writes

| Path                                      | What it is                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.vercel/output/static/`                  | `dist/client` (below Vite's `base`), without `_headers`. Served first.                                                                                                                                                                              |
| `.vercel/output/functions/__lumiose.func` | The server, for every path no static file answers. Not written when every route is prerendered.                                                                                                                                                     |
| `.vercel/output/config.json`              | The routes: `lumiose({ headers })` and Lumiose's default headers, a year of caching (`immutable`) for the files the build named by content hash (not `public/assets/` files), form posts to prerendered pages, the static files, then the function. |

Prerendered pages also answer at their URL without the trailing slash (`/about` serves
`about/index.html` with `trailingSlash: "ignore"`, `about.html` with `"never"`), so the usual links
hit the static files. Vercel compresses responses itself: the build writes no `.br`/`.gz` copies.

## Node.js or Edge

`vercel({ runtime })` picks where the function runs:

- `"nodejs"` (default): a Node.js function (the build's Node.js major version, 22 at least),
  with response streaming. The function directory holds the server build and the npm packages it
  imports, found with `@vercel/nft`; native modules are copied as they are, so build on Linux
  (Vercel's build does) when your dependencies have native binaries. The project and its
  `node_modules` must be on one drive: the build stops with an error when the traced files share
  no common directory.
- `"edge"`: one bundled module for Vercel's Edge runtime. npm packages are bundled with their
  `edge-light` and `worker` builds. The Edge runtime has no file system and only some Node.js
  modules (`async_hooks`, `buffer`, `events`, `util`, `assert`): the build stops with an error
  naming any other module your server code imports.

## The platform in your code

- `ctx.platform.clientAddress`: the `X-Real-IP` header that Vercel sets.
- `ctx.platform.waitUntil(promise)`: Vercel's `waitUntil` (the Edge function's context, or the
  request context of a Node.js function), for work after the response.
- `ctx.platform.env` is empty: variables are in `process.env`, `env("NAME")` and `ctx.env`.

Request URLs use the public origin from `X-Forwarded-Proto` and `X-Forwarded-Host`, which
Vercel's proxy sets, so the cross-site check of form posts compares the right origins.

## Notes

- Static files skip the function, so middleware does not run for them. Headers they need belong in
  `lumiose({ headers })`.
- Vercel applies the header routes to the function's responses too. When the app sets a header
  that `lumiose({ headers })` also sets for that path, which value wins on Vercel is not verified
  yet; the handler itself keeps the app's.
- A `""` value, which removes a header in `lumiose({ headers })`, can only remove it everywhere
  (`/**`) on Vercel: routes cannot unset headers for some paths.

## API

```ts
import { vercel } from "@lumiose/adapter-vercel";

function vercel(options?: { runtime?: "nodejs" | "edge" }): Adapter; // default "nodejs"
```
