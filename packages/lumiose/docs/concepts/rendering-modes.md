# Rendering modes

> Each route picks a mode: `static` (built HTML, the default), `server` (rendered per request, shell first, then streamed `<Suspense>` boundaries) or `spa` (a client-routed subtree, rendered per request, prerendered at build time or in the browser). All three use the same components.

## Concept

| Mode               | HTML                                                                                                                | JS shipped        | Navigation                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------- |
| `static` (default) | At build time, for each path from `staticPaths()`                                                                   | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `server`           | Per request: the shell, then streamed boundaries                                                                    | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `spa`              | Server-rendered (per request, or at build time with `prerender`) and hydrated, or a client shell with `ssr = false` | The whole subtree | Client router (`<Link prefetch>`)       |

A route sets `export const mode = "server"` (a string literal); pages inherit the mode of their
nearest layout that sets one, else the project default set in `vite.config.ts` with
`lumiose({ mode: "server" })` (`"static"` when unset). `export const ssr = false` applies to `spa`
routes: the build emits a static shell and the page renders in the browser. `lumiose({ ssr: false })`
makes that the default for every `spa` route, so `lumiose({ mode: "spa", ssr: false })` turns the
whole project into a client-rendered SPA built as static files. `export const prerender = true`
renders an `spa` page at build time instead of per request, and `lumiose({ prerender: true })` makes
that the default for every `spa` page (see [Prerendered SPA routes](#prerendered-spa-routes)).

**Shell first, then stream (server mode).**

1. **Shell.** The response starts once everything **outside** `<Suspense>` has resolved, including
   async components without a boundary. Until then you can still set the status, headers and
   cookies, call `redirect()`, `notFound()` or `error()`, and add `<Title>`/`<Meta>`/`<Head>`.
   A failure renders `_error` with the right status.
2. **Stream.** `<Suspense>` boundaries then stream in as they resolve, out of order, and replace
   their fallbacks (with native `<template for>` updates or a ~300 B `$swap` script). An error
   renders the boundary's `<ErrorBoundary>` in place. A head or status change inside a streamed
   boundary is `LUM5004`.
3. **SSG and prerender** resolve everything: no fallbacks and no swap scripts.

So: put slow, optional content inside `<Suspense>` to send the page sooner; leave essential
content (and anything that decides the status) outside.

**Hydration.** Only islands and SPA subtrees hydrate. The compiled code has a single DOM walk;
importing `lumiose/dom/hydrate` (done by the island loader and SPA entries) makes it claim existing
server nodes instead of creating them, so bundles without hydration carry no hydration code.
Markers are comments, used only for blocks, branches, text separators and async ranges.

**SPA mode.** An `spa` subtree starts at the outermost `spa` layout of a page (or at the page
itself) and renders as a single root island: layouts above it render on the server only. Its props
come from serializable route data; `request`, `cookies` and `locals` are not passed in. SPA code
calls endpoints instead. Pages with an SPA load the SPA entry (the client route table, a lazy
chunk per SPA layout and page, and the island loader) and navigate with
[`lumiose/router`](../reference/router.md). In a build, the page also modulepreloads the chunks of
its SPA layouts and page (and their imports), so a deep link fetches them alongside the entry
instead of after it has run. When nothing in a build hydrates (every SPA page is
`ssr = false` and the app has no islands), the SPA entry starts the router without the island
loader, and the build ships no hydration code.

- **`ssr` (the default):** the server renders the island and the browser hydrates it, replaying
  the server's awaited data.
- **`ssr = false`:** the server sends a shell (the document, the layouts above the SPA and an
  empty island) without loading the SPA's modules, so they may use browser APIs at module scope;
  the browser renders the island. Such pages cannot export `action` or `headers`: use endpoints.
- `_404` and `_error` pages below an `spa` layout render inside the SPA too.

### Prerendered SPA routes

`export const prerender = true` on an `spa` page renders it in the build's prerender step, as a
`static` page is rendered: the build writes real HTML for it, which the SPA entry hydrates, and later
navigation is client-side as usual. Search engines, link previews and visitors without JavaScript
see the content, and a static host can serve the page.

- **Opt in per page or for the project.** `export const prerender = true` on a page, or
  `lumiose({ prerender: true })` for every `spa` page. A page opts out of the project default with
  `export const prerender = false`, and is then rendered per request. `prerender` is read from
  pages only, as a literal `true` or `false`; in a layout, an endpoint or a `static`/`server` route
  it has no effect (a `LUM5002` warning).
- **Params.** A page with params lists its paths with `staticPaths()`, as a `static` page does;
  without it the build stops. The build writes one HTML file per path. On a static host, any other
  URL gets `404.html`, which renders the root `_404` inside the SPA.
- **No request.** The page renders at build time, so request APIs (`cookies()`, `request()`,
  `locals()`, `response()`, `url().searchParams`) stop the build with `LUM5001`. Read them in the
  browser, or call an endpoint.
- **Browser-only code.** The page, its `spa` layouts and everything they import now load on the
  server at build time, which an `ssr = false` page never did. Move browser APIs (`window`,
  `document`, `localStorage`, `AudioContext`, `requestAnimationFrame`) out of module scope and out
  of component setup: read them in `onMount()`, an effect or an event handler, which run only in
  the browser. Create browser objects lazily, on first use. The compiler warns about browser
  globals at module scope (`LUM4004`).
- **Not with `ssr = false`.** `ssr = false` renders the page only in the browser. Setting
  `prerender = true` on such a page is `LUM5006`, and `lumiose({ prerender: true, ssr: false })` is
  rejected. Under `lumiose({ prerender: true })` alone, a page with `ssr = false` stays a shell.

To move a client-rendered SPA (`ssr = false`) to prerendering: remove `ssr = false`, make its
modules safe to load on the server (above), add `staticPaths()` to pages with params, then set
`prerender = true` (or `lumiose({ prerender: true })`). `lumiose dev` renders the pages per request,
fully resolved as the build does, so hydration problems show up there first.

**Build (`lumiose build`).** 1. client build (islands, SPA, CSS, assets, `public/`), 2. server
build, 3. prerender of every `static` route and every `spa` page with `prerender` (each
`staticPaths()` entry for routes with params) and every static `GET` endpoint, in-process through the built handler and fully resolved (no fallbacks
or swap scripts), 4. precompression: a `.br` and a `.gz` copy next to every text file of
`dist/client` of at least 1 kB, which `@lumiose/adapter-node` (and most static hosts and CDNs) serve
to browsers that accept them. Output:

- `dist/client`: assets and prerendered files. Assets include those only server-rendered code
  imports (`import photo from "./photo.png"` in a route, a relative `<img src>` in a `.md`
  import), written once under `assets/` with the fingerprinted URL the HTML uses. Prerendered
  files are `path/index.html` (`path.html` with
  `lumiose({ trailingSlash: "never" })`, prerendered `spa` pages included), endpoint files such as
  `sitemap.xml`, the shell of each
  `ssr = false` page without params, and `404.html` from the root `_404` when the root scope is
  static or `spa`. In an `ssr = false` SPA, `404.html` is the shell: a static host that serves it
  for unknown URLs gets deep links to every route. Vite's `base` applies to URLs, not to file
  paths.
- `dist/server/entry.js`: `export default { fetch }`, plus `createHandler({ env })` and `config`.
  The server output bundles your server code, linked workspace packages and the Lumiose runtime
  (npm dependencies stay external, as Vite does for SSR), minified with function and class names
  kept, so production stack traces still name the functions.

A route (`static`, or `spa` with `prerender`) that reads the request while it prerenders (`cookies()`, `locals()`, `request()`,
`response()`, `url().searchParams`) stops the build with [LUM5001](../errors/LUM5001.md); a static
endpoint can only export `GET` ([LUM5005](../errors/LUM5005.md)). Middleware still runs. A form
post to a prerendered page reaches its `action` on the server. Serve the build with
`@lumiose/adapter-node` (`createServer({ port })`: `dist/client` with caching headers, then the
handler) or `lumiose preview`. A site whose every route is prerendered (no `server` route, no `spa`
route rendered per request, no form action; `ssr = false` routes with params need a `404.html`
shell) builds no `dist/server`: deploy `dist/client` to any static host, and `lumiose preview` serves
it without the adapter. Set response headers once with `lumiose({ headers })`
([@lumiose/vite](../reference/vite.md#lumiose)).

> **Status:** `lumiose dev`, `lumiose build`, prerendering,
> [`@lumiose/adapter-node`](../reference/adapter-node.md), CSS links in built pages, the island
> loader (hydration), SPA mode (one root island, `ssr = false` shells, prerendered pages) and the
> SPA router are available.

## API

| API                                                     | Use                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `export const mode = "static" \| "server" \| "spa"`     | The route's mode (inherited from layouts).                                                 |
| `export const ssr = false`                              | `spa` routes: render in the browser only.                                                  |
| `export const prerender = true`                         | `spa` pages: render at build time into HTML that hydrates (`false` opts out).              |
| `lumiose({ mode, ssr, prerender })` in `vite.config.ts` | The project defaults for routes and layouts that do not set them.                          |
| `export async function staticPaths()`                   | `static` routes and prerendered `spa` pages with params: `[{ params: { slug: "a" } }, …]`. |
| `export function headers(ctx)`                          | Response headers for the page.                                                             |
| `<Suspense fallback>`                                   | Marks content that may stream after the shell.                                             |
| `renderToStream(root, options?)`                        | The server renderer behind it all; see [reference: server](../reference/server.md).        |

## Example

```stsx check file=routes/stats.stsx
// src/routes/stats.stsx: the shell (title, heading) is sent first; the slow chart streams in
import { Suspense, Title } from "lumiose";

export const mode = "server";

async function SlowChart() {
  const points = await new Promise<number[]>((resolve) => setTimeout(() => resolve([3, 1, 4]), 500));
  return <p>Points: {points.join(", ")}</p>;
}

export default function Stats() {
  return (
    <main>
      <Title>Stats</Title>
      <h1>Stats</h1>
      <Suspense fallback={<p>Loading chart…</p>}>
        <SlowChart />
      </Suspense>
    </main>
  );
}
```

```tsx check file=routes/docs/[slug].tsx
// src/routes/docs/[slug].tsx: prerendered for each slug
import type { PageProps } from "lumiose";

const pages = { intro: "Introduction", setup: "Setup" } as const;

export async function staticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { slug } }));
}

export default function Doc({ params }: PageProps<"/docs/[slug]">) {
  return <h1>{pages[params.slug as keyof typeof pages]}</h1>;
}
```

```stsx check file=routes/tracks/[id].stsx
// src/routes/tracks/[id].stsx: prerendered for each id, then hydrated into the SPA
import { onMount, signal } from "lumiose";
import { params } from "lumiose/router";

export const mode = "spa"; // or from a layout, or lumiose({ mode: "spa" })
export const prerender = true;

export function staticPaths() {
  return ["1", "2", "3"].map((id) => ({ params: { id } }));
}

export default function Track() {
  const volume = signal(1);
  // Browser-only: runs after hydration, never at build time.
  onMount(() => volume.set(Number(localStorage.getItem("volume") ?? 1)));
  return <h1>Track {params().id} (volume {volume()})</h1>;
}
```

## Common mistakes

- **Request APIs in a `static` route.** `cookies()`, `request()`, `locals()` and actions need
  `mode = "server"` (`LUM5001`).
- **Setting status or `<Title>` inside `<Suspense>`.** It arrives after the shell was sent
  (`LUM5004`). Decide them outside the boundary.
- **Wrapping the whole page in `<Suspense>`.** The shell is then just the fallback, and the status
  cannot change. Wrap only slow, optional parts.
- **Expecting `spa` routes to receive `cookies` or `locals` as props.** They are not serializable
  into the SPA (`LUM4002`); call an endpoint.
- **Computing `mode` at runtime.** `mode` must be a string literal (`LUM5002`).
- **Browser APIs at module scope or in component setup of a prerendered `spa` page.** The build
  renders it on the server; read them in `onMount()` or an event handler (`LUM4004`).
- **`prerender = true` on an `ssr = false` page.** The page cannot be both (`LUM5006`).

## Related diagnostics

- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM5006](../errors/LUM5006.md): prerendered page that renders only in the browser.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.

See also: [Islands](islands.md), [Async components](async.md), [Head and document](head.md).
