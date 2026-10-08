# Rendering modes

> Each route picks a mode: `static` (built HTML, the default), `server` (rendered per request, shell first, then streamed `<Suspense>` boundaries) or `spa` (a client-routed subtree). All three use the same components.

## Concept

| Mode               | HTML                                                               | JS shipped        | Navigation               |
| ------------------ | ------------------------------------------------------------------ | ----------------- | ------------------------ |
| `static` (default) | At build time, for each path from `staticPaths()`                  | Islands only      | MPA (+ View Transitions) |
| `server`           | Per request: the shell, then streamed boundaries                   | Islands only      | MPA                      |
| `spa`              | Server-rendered and hydrated, or a client shell with `ssr = false` | The whole subtree | Client router            |

A route sets `export const mode = "server"` (a string literal); pages inherit the mode of their
nearest layout that sets one. `export const ssr = false` applies to `spa` routes: the build emits a
static shell and the page renders in the browser.

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

**SPA mode.** An `spa` subtree is a single root island. Its props come from serializable route
data; `request`, `cookies` and `locals` are not passed in. SPA code calls endpoints instead.

**Build (`lumen build`).** 1. client build (islands, SPA, CSS, manifests), 2. server build, 3. prerender of every `static` route and static `GET` endpoint. Output: `dist/client` (assets and
prerendered `path/index.html`, plus `404.html`) and `dist/server/entry.js` (`export default {
fetch }`), which adapters such as `@lumen/adapter-node` deploy.

> **Status:** route modes are read and inherited, and `renderToStream` implements the shell-first
> model with out-of-order streaming. `lumen dev`, `lumen build`, prerendering (`staticPaths`), SPA
> mode and hydration are in progress.

## API

| API                                                 | Use                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `export const mode = "static" \| "server" \| "spa"` | The route's mode (inherited from layouts).                                          |
| `export const ssr = false`                          | `spa` routes: render in the browser only.                                           |
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
