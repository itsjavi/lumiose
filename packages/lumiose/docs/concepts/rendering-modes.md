# Rendering modes

> Each route renders as static HTML, on the server per request, or as a client-routed SPA, with the same components, mixed freely in one app.

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
renders an `spa` page (or, in a layout, every `spa` page below it) at build time instead of per
request, and `lumiose({ prerender: true })` makes that the default for every `spa` page (see
[Prerendered SPA routes](#prerendered-spa-routes)).

### Choosing a mode

Pick the mode by what the page needs, per route, not once for the whole app:

| Mode                  | For                                                                                                        | Typical pages                                                                     | Costs                                                                                                           | Sample app                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `static`              | Content that is the same for every visitor and known at build time                                         | Docs, marketing, blog posts, catalogs                                             | Rendered once per build. Any static host (a form `action` still needs a server for the POST). JS: islands only. | [ssg-travel-journal](https://github.com/itsjavi/lumiose/tree/main/examples/ssg-travel-journal), this website                                                             |
| `server`              | Pages that depend on the reader or the request, or must be fresh                                           | Account pages, dashboards, `?q=` search results, forms that re-render with errors | Rendered on every request: a server or a serverless function. JS: islands only.                                 | [ssr-auth](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-auth), [ssr-bookshelf](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-bookshelf)         |
| `spa`                 | App-like areas (client navigation, layout state kept across pages) whose first view depends on the request | Signed-in app areas                                                               | Rendered on every request, then the whole subtree ships and hydrates.                                           | [spa-router-e2e](https://github.com/itsjavi/lumiose/tree/main/examples/spa-router-e2e) (test app)                                                                        |
| `spa` + `prerender`   | App-like areas whose pages are the same for everyone and should work without JS and be indexed             | Public app pages, music tools, galleries                                          | Rendered once per build; any static host. The whole subtree ships and hydrates.                                 | [spa-chiptune](https://github.com/itsjavi/lumiose/tree/main/examples/spa-chiptune), [spa-dotmatrix](https://github.com/itsjavi/lumiose/tree/main/examples/spa-dotmatrix) |
| `spa` + `ssr = false` | Code that cannot run on the server, where an empty first view is acceptable                                | Editors, canvas or audio tools, admin screens behind a sign-in                    | A static shell; nothing renders until the JS has loaded. No `action` or `headers` exports: use endpoints.       | `/csr` in [spa-router-e2e](https://github.com/itsjavi/lumiose/tree/main/examples/spa-router-e2e)                                                                         |

A rule of thumb, in order:

1. Start with `static`.
2. A page needs an interactive part: add an [island](islands.md) (`client:*`) to that part. That is
   not a reason to change the mode.
3. A page reads the reader's session, cookies or search params, or must be fresh: `server`.
4. A whole area behaves like an app: `spa`. Add `prerender` when its pages are the same for every
   reader, and use `ssr = false` only for code that cannot run on the server.

`lumiose routes` lists every route with its resolved mode ([CLI](../reference/cli.md#lumiose-routes)).

### Granularity and combining

Modes are chosen per route, and the finer features per component:

- **Project:** `lumiose({ mode, ssr, prerender })` sets the defaults.
- **Layout:** `export const mode`, `ssr` and `prerender` in a layout apply to every page below it;
  the nearest layout that sets one wins.
- **Page:** the page's own exports win. Endpoints (`route.ts`) take a mode too: `static` endpoints
  are written at build time and only take `GET` ([LUM5005](../errors/LUM5005.md)).
- **Component:** a `client:*` directive makes one usage of a component an island; `<Suspense>`
  marks the part of a page that may arrive after the rest.

What combines with each mode:

| Mode                  | Islands (`client:*`)                                                                     | `<Suspense>`                                      | Request APIs (`cookies()`, `locals()`, `url().searchParams`)    |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `static`              | Yes                                                                                      | Resolved at build time: no fallback, no streaming | No ([LUM5001](../errors/LUM5001.md))                            |
| `server`              | Yes                                                                                      | Streams after the shell                           | Yes                                                             |
| `spa`                 | Not needed: the whole subtree hydrates; a `client:*` inside renders as a plain component | Streams after the shell, then hydrates            | Not in SPA code, which also runs in the browser: call endpoints |
| `spa` + `prerender`   | Not needed                                                                               | Resolved at build time                            | No ([LUM5001](../errors/LUM5001.md))                            |
| `spa` + `ssr = false` | Not needed                                                                               | Shows its fallback, then renders in the browser   | No: the page renders in the browser; call endpoints             |

And across levels:

- **`static` and `server` pages share layouts.** A layout renders with the page: at build time for a
  `static` page, per request for a `server` page.
- **An `spa` subtree under server-rendered layouts.** The SPA starts at the outermost `spa` layout of
  the page (or at the page). Layouts above it render on the server only (per request, or at build
  time with `prerender`) and never hydrate.
- **A page can leave an `spa` area.** A page with its own `mode = "static"` or `"server"` below an
  `spa` layout is not part of the SPA: its layouts render on the server only, and links to it are
  document navigations.
- **A `static` page with a form `action`.** The `GET` is the built file; the `POST` runs the action
  on the server and renders the page with its result.
- **`prerender` and `ssr = false` exclude each other,** also when one comes from a layout or the
  project ([LUM5006](../errors/LUM5006.md)).

[ssr-bookshelf](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-bookshelf) mixes modes in
one app: `/about` and `/genres` are `static` with an account-menu island, the catalog and account
pages are `server`, and `/api/me` and `/api/search` are `server` endpoints.

### Close to partial prerendering

Partial prerendering (PPR, part of Cache Components in Next.js 16) builds a page's static shell
once, sends it at once on every request, and streams the request-dependent holes, each a
`<Suspense>` boundary, into the same response. **Lumiose has no mode that serves a prebuilt shell
and fills its holes per request:** a page is either built (`static`, `spa` with `prerender`) or
rendered on every request (`server`, `spa`). Two patterns get close:

- **`server` + `<Suspense>`.** Everything outside the boundaries is the shell; it renders per
  request and is sent as soon as it resolves, and the slow or per-reader parts stream into the same
  response. No extra request and no client JS beyond the swap script. Trade-offs: the shell renders
  on every request (no CDN-cached shell), so keep it free of slow work. A streamed boundary is
  applied by a ~300 B `$swap` script, or natively by browsers that apply `<template for>`
  (declarative partial updates); without either, the reader keeps seeing the fallback. So keep
  essential content and forms out of streamed boundaries. A boundary whose content renders
  synchronously is not streamed at all: it is folded into the shell.
- **`static` + islands.** The page is built once and served by any static host or CDN; the
  per-reader parts are islands that call an endpoint after load (`client:idle` and
  `fetchJSON("/api/me")`). Trade-offs: those parts need JS and a second request, appear after
  hydration (give their fallback a stable size), and never appear without JS.

Good candidates: pages whose main content is the same for everyone, with small per-reader or fresh
parts (a product or book page with an account menu, a reading-list button and reviews), and slow,
optional widgets. Poor candidates: pages that are mostly per reader (use plain `server`), content
that decides the status or the head (it must be in the shell, [LUM5004](../errors/LUM5004.md)), and
forms that must work without JavaScript inside a hole whose data is slow.

The bookshelf sample shows each pattern:

- `/about` and `/genres`: `static` + the account menu, a `client:idle` island over `/api/me`.
- `/` (home): `server` + a `<Suspense>` around the recommendations, which really stream.
- `/books/[isbn]`: shell + holes. The shell reads only the route param: the book's metadata and
  description. The header's account area, the reading-list toggle, "Your review", the rating
  summary and histogram, and the reviews list are each a `<Suspense>` hole that runs its own
  queries and reads `locals()` or `url()` itself when it needs the reader or the query string, with
  a fallback of stable size. Their data is synchronous (`node:sqlite`), so every hole resolves
  inside the shell: nothing streams, and every form works without JavaScript. Async data in a hole
  would stream it, as on the home page. The split marks which parts a prebuilt shell could hold.

### Compared with Astro islands

Lumiose islands follow Astro's idea: pages are server HTML with no JS by default, and a `client:*`
directive at the usage site makes one component instance an island, with the same directive names
(`client:load`, `client:idle`, `client:visible`, `client:media`, `client:only`) and serializable
props. The differences (Astro 7.3, checked against its docs and source in October 2026):

| Topic                 | Astro                                                                                                                                                      | Lumiose                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components            | `.astro` server components plus islands from React, Preact, Svelte, Vue or Solid, mixable on one page                                                      | One component model on the server and in the browser, so `client:only` needs no framework name                                                                                           |
| Island markup         | An `<astro-island>` custom element around each island, with its component URL and props as attributes                                                      | Comment markers (`<!--l:ID-->…<!--/l:ID-->`) plus JSON records: no wrapper element, so flex, grid and child selectors see the island's own elements                                      |
| Directive options     | `client:idle={{timeout}}`, `client:visible={{rootMargin}}`                                                                                                 | `client:idle` hydrates at the latest after 2 s; `client:visible="200px"`                                                                                                                 |
| Early events          | Not replayed                                                                                                                                               | Clicks, input, submits and key presses before hydration are replayed                                                                                                                     |
| Data                  | Passed to the island as props                                                                                                                              | Islands may also `await` data; the values are recorded during SSR and replayed during hydration, and cached awaits are sent once per page                                                |
| Shared state          | Nano Stores (client side)                                                                                                                                  | Scoped state (`defineState`, [Sharing state](state.md)): one instance per page, seeded on the server and sent with the page                                                              |
| Deferred server parts | `server:defer` server islands: a script fetches each one in a separate request after load (encrypted props, a `fallback` slot); works on prerendered pages | No `server:defer`. A `server` page streams the part in the same response with `<Suspense>` ([above](#close-to-partial-prerendering)); a built page uses a client island over an endpoint |
| App navigation        | `<ClientRouter />` swaps documents on navigation, with `transition:persist`                                                                                | `spa` subtrees with a client router ([`lumiose/router`](../reference/router.md)) and layouts that persist; MPA pages use prefetch and, opt-in, native cross-document View Transitions    |

### How pages render

**Shell first, then stream (server mode).**

1. **Shell.** The response starts once everything **outside** `<Suspense>` has resolved, including
   async components without a boundary. Until then you can still set the status, headers and
   cookies, call `redirect()`, `notFound()` or `error()`, and add `<Title>`/`<Meta>`/`<Head>`.
   A failure renders the `error` page with the right status.
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
loader, and the build ships no hydration code. With
[`src/instrumentation.client.ts`](islands.md#concept), the SPA root and the router start once its
top-level code ran, on every page load (not on client navigations).

- **`ssr` (the default):** the server renders the island and the browser hydrates it, replaying
  the server's awaited data.
- **`ssr = false`:** the server sends a shell (the document, the layouts above the SPA and an
  empty island) without loading the SPA's modules, so they may use browser APIs at module scope;
  the browser renders the island. Such pages cannot export `action` or `headers`: use endpoints.
- `not-found` and `error` pages below an `spa` layout render inside the SPA too.

### Prerendered SPA routes

`export const prerender = true` on an `spa` page renders it in the build's prerender step, as a
`static` page is rendered: the build writes real HTML for it, which the SPA entry hydrates, and later
navigation is client-side as usual. Search engines, link previews and visitors without JavaScript
see the content, and a static host can serve the page.

- **Opt in per page, per layout or for the project.** `export const prerender = true` on a page;
  on a layout, for every `spa` page below it; or `lumiose({ prerender: true })` for every `spa`
  page. It is inherited like `mode` and `ssr`: the page's own export wins, then the nearest layout
  that sets it, then the project default. A page opts out with `export const prerender = false`,
  and is then rendered per request; a layout's `prerender = false` turns the default off for its
  subtree. `prerender` must be a literal `true` or `false`. In an endpoint, or in a layout or page
  whose mode is `static` or `server`, it has no effect (a `LUM5002` warning).

  ```stsx
  // src/routes/layout.stsx: every page below is prerendered…
  export const mode = "spa";
  export const prerender = true;
  ```

  ```stsx
  // src/routes/account/page.stsx: …except this one, which reads cookies per request
  export const prerender = false;
  ```

- **Params.** A page with params lists its paths with `staticPaths()`, as a `static` page does;
  without it the build stops. The build writes one HTML file per path. On a static host, any other
  URL gets `404.html`, which renders the root `not-found` page inside the SPA.
- **Deep links to paths that were not prerendered.** When `404.html` loads at the URL of an SPA page
  with params (a song saved in the browser, a record created after the build), the router renders
  that page in the browser instead of the `not-found` page. The page decides with the browser's
  data, and `notFound()` brings the `not-found` page back. A small inline script in `404.html` hides the document until
  the router has rendered, so the 404 does not flash (at most 8 s, should the SPA not start). A URL
  that matches no page keeps the `not-found` page, with status 404, and so does every URL without
  JavaScript. `lumiose dev` and a server build do the same when such a page calls `notFound()`
  while it renders on the server, which has no browser data. `ssr = false` pages with params
  behave the same way. This needs a root `not-found` page: without one, `404.html` is a plain error
  page without the SPA.
- **No request.** The page renders at build time, so request APIs (`cookies()`, `request()`,
  `locals()`, `response()`, `url().searchParams`) stop the build with `LUM5001`. Read them in the
  browser, or call an endpoint.
- **Browser-only code.** The page, its `spa` layouts and everything they import now load on the
  server at build time, which an `ssr = false` page never did. Move browser APIs (`window`,
  `document`, `localStorage`, `AudioContext`, `requestAnimationFrame`) out of module scope and out
  of component setup: read them in `onMount()`, an effect or an event handler, which run only in
  the browser. Create browser objects lazily, on first use. The compiler warns about browser
  globals at module scope (`LUM4004`).
- **Not with `ssr = false`.** `ssr = false` renders the page only in the browser. A page whose
  `prerender = true` (its own or a layout's) meets `ssr = false` (its own, a layout's or the
  project's) is `LUM5006`: give a browser-only page under a prerendering layout
  `export const prerender = false`. `lumiose({ prerender: true, ssr: false })` is rejected. Under
  `lumiose({ prerender: true })` alone, a page with `ssr = false` stays a shell.

To move a client-rendered SPA (`ssr = false`) to prerendering: remove `ssr = false`, make its
modules safe to load on the server (above), add `staticPaths()` to pages with params, then set
`prerender = true` on the SPA's layout (or `lumiose({ prerender: true })`). `lumiose dev` renders the pages per request,
fully resolved as the build does, so hydration problems show up there first.

### Build

`lumiose build` runs: 1. client build (islands, SPA, CSS, assets, `public/`), 2. server
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
  `ssr = false` page without params, and `404.html` from the root `not-found` page when the root scope is
  static or `spa`. In an `ssr = false` SPA, `404.html` is the shell: a static host that serves it
  for unknown URLs gets deep links to every route. Vite's `base` applies to URLs, not to file
  paths.
- `dist/server/entry.js`: `export default { fetch(request, platform?) }`, which serves the
  static files of `dist/client`, then the app ([server build](../reference/server-entry.md)), plus
  `createHandler({ env })` (the app alone) and `config`.
  The server output bundles your server code, linked workspace packages and the Lumiose runtime
  (npm dependencies stay external, as Vite does for SSR), minified with function and class names
  kept, so production stack traces still name the functions.

A route (`static`, or `spa` with `prerender`) that reads the request while it prerenders (`cookies()`, `locals()`, `request()`,
`response()`, `url().searchParams`) stops the build with [LUM5001](../errors/LUM5001.md); a static
endpoint can only export `GET` ([LUM5005](../errors/LUM5005.md)). Middleware still runs. A form
post to a prerendered page reaches its `action` on the server. Serve the build with
`@lumiose/adapter-node` (`createServer({ port })`: `dist/client` with caching headers, then the
handler) or `lumiose preview`, run `dist/server/entry.js` with Bun or Deno, or deploy it to
Cloudflare, Vercel or Netlify with an adapter ([Deploy](../deploy/README.md)). A site whose every route is prerendered (no `server` route, no `spa`
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
| `export const prerender = true`                         | `spa` pages: render at build time into HTML that hydrates (inherited from layouts).        |
| `lumiose({ mode, ssr, prerender })` in `vite.config.ts` | The project defaults for routes and layouts that do not set them.                          |
| `export async function staticPaths()`                   | `static` routes and prerendered `spa` pages with params: `[{ params: { slug: "a" } }, …]`. |
| `export function headers(ctx)`                          | Response headers for the page.                                                             |
| `<Suspense fallback>`                                   | Marks content that may stream after the shell.                                             |
| `renderToStream(root, options?)`                        | The server renderer behind it all; see [reference: server](../reference/server.md).        |

## Example

```stsx check file=routes/stats/page.stsx
// src/routes/stats/page.stsx: the shell (title, heading) is sent first; the slow chart streams in
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

```tsx check file=routes/docs/[slug]/page.tsx
// src/routes/docs/[slug]/page.tsx: prerendered for each slug
import type { PageProps } from "lumiose";

const pages = { intro: "Introduction", setup: "Setup" } as const;

export async function staticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { slug } }));
}

export default function Doc({ params }: PageProps<"/docs/[slug]">) {
  return <h1>{pages[params.slug as keyof typeof pages]}</h1>;
}
```

```stsx check file=routes/tracks/[id]/page.stsx
// src/routes/tracks/[id]/page.stsx: prerendered for each id, then hydrated into the SPA
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
- **`prerender = true` on an `ssr = false` page.** The page cannot be both (`LUM5006`), also when
  one of them comes from a layout.

## Related diagnostics

- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM5006](../errors/LUM5006.md): prerendered page that renders only in the browser.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.

See also: [Islands](islands.md), [Async components](async.md), [Head and document](head.md).
