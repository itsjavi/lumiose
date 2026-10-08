# Rendering modes

> Each route picks a mode: `static` (built HTML, the default), `server` (rendered per request, shell first, then streamed `<Suspense>` boundaries) or `spa` (a client-routed subtree). All three use the same components.

## Concept

| Mode               | HTML                                                               | JS shipped        | Navigation                              |
| ------------------ | ------------------------------------------------------------------ | ----------------- | --------------------------------------- |
| `static` (default) | At build time, for each path from `staticPaths()`                  | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `server`           | Per request: the shell, then streamed boundaries                   | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `spa`              | Server-rendered and hydrated, or a client shell with `ssr = false` | The whole subtree | Client router (`<Link prefetch>`)       |

A route sets `export const mode = "server"` (a string literal); pages inherit the mode of their
nearest layout that sets one, else the project default set in `vite.config.ts` with
`lumen({ mode: "server" })` (`"static"` when unset). `export const ssr = false` applies to `spa`
routes: the build emits a static shell and the page renders in the browser. `lumen({ ssr: false })`
makes that the default for every `spa` route, so `lumen({ mode: "spa", ssr: false })` turns the
whole project into a client-rendered SPA built as static files.

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
importing `lumen/dom/hydrate` (done by the island loader and SPA entries) makes it claim existing
server nodes instead of creating them, so bundles without hydration carry no hydration code.
Markers are comments, used only for blocks, branches, text separators and async ranges.

**SPA mode.** An `spa` subtree starts at the outermost `spa` layout of a page (or at the page
itself) and renders as a single root island: layouts above it render on the server only. Its props
come from serializable route data; `request`, `cookies` and `locals` are not passed in. SPA code
calls endpoints instead. Pages with an SPA load the SPA entry (the client route table, a lazy
chunk per SPA layout and page, and the island loader) and navigate with
[`lumen/router`](../reference/router.md).

- **`ssr` (the default):** the server renders the island and the browser hydrates it, replaying
  the server's awaited data.
- **`ssr = false`:** the server sends a shell (the document, the layouts above the SPA and an
  empty island) without loading the SPA's modules, so they may use browser APIs at module scope;
  the browser renders the island. Such pages cannot export `action` or `headers`: use endpoints.
- `_404` and `_error` pages below an `spa` layout render inside the SPA too.

**Build (`lumen build`).** 1. client build (islands, SPA, CSS, assets, `public/`), 2. server
build, 3. prerender of every `static` route (each `staticPaths()` entry for routes with params) and
every static `GET` endpoint, in-process through the built handler and fully resolved (no fallbacks
or swap scripts). Output:

- `dist/client`: assets and prerendered files: `path/index.html` (`path.html` with
  `lumen({ trailingSlash: "never" })`), endpoint files such as `sitemap.xml`, the shell of each
  `ssr = false` page without params, and `404.html` from the root `_404` when the root scope is
  static or `spa`. In an `ssr = false` SPA, `404.html` is the shell: a static host that serves it
  for unknown URLs gets deep links to every route. Vite's `base` applies to URLs, not to file
  paths.
- `dist/server/entry.js`: `export default { fetch }`, plus `createHandler({ env })` and `config`.

A route that reads the request while it prerenders (`cookies()`, `locals()`, `request()`,
`response()`, `url().searchParams`) stops the build with [LUM5001](../errors/LUM5001.md); a static
endpoint can only export `GET` ([LUM5005](../errors/LUM5005.md)). Middleware still runs. A form
post to a prerendered page reaches its `action` on the server. Serve the build with
`@lumen/adapter-node` (`createServer({ port })`: `dist/client` with caching headers, then the
handler) or `lumen preview`; a site whose routes are all static deploys with `dist/client` alone.

> **Status:** `lumen dev`, `lumen build`, prerendering,
> [`@lumen/adapter-node`](../reference/adapter-node.md), CSS links in built pages, the island
> loader (hydration), SPA mode (one root island, `ssr = false` shells) and the SPA router are
> available.

## API

| API                                                 | Use                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `export const mode = "static" \| "server" \| "spa"` | The route's mode (inherited from layouts).                                          |
| `export const ssr = false`                          | `spa` routes: render in the browser only.                                           |
| `lumen({ mode, ssr })` in `vite.config.ts`          | The project defaults for routes and layouts that do not set them.                   |
| `export async function staticPaths()`               | `static` routes with params: `[{ params: { slug: "a" } }, …]`.                      |
| `export function headers(ctx)`                      | Response headers for the page.                                                      |
| `<Suspense fallback>`                               | Marks content that may stream after the shell.                                      |
| `renderToStream(root, options?)`                    | The server renderer behind it all; see [reference: server](../reference/server.md). |

## Example

```stsx check file=routes/stats.stsx
// src/routes/stats.stsx: the shell (title, heading) is sent first; the slow chart streams in
import { Suspense, Title } from "lumen";

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
import type { RouteProps } from "lumen";

const pages = { intro: "Introduction", setup: "Setup" } as const;

export async function staticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { slug } }));
}

export default function Doc({ params }: RouteProps<"/docs/[slug]">) {
  return <h1>{pages[params.slug as keyof typeof pages]}</h1>;
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

## Related diagnostics

- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.

See also: [Islands](islands.md), [Async components](async.md), [Head and document](head.md).
