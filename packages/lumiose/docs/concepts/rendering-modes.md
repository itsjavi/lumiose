# Rendering modes

> Each route renders as static HTML, on the server per request, or as a client-routed SPA, with the same components, mixed freely in one app.

## Concept

### Static by default, with `staticPaths()`

A route is `static` unless it says otherwise: this page is built once for each path that
`staticPaths()` returns. `export const mode = "server"` (a string literal) changes the mode.

```tsx check file=routes/docs/[slug]/page.tsx
import type { PageProps } from "lumiose";

const pages = { intro: "Introduction", setup: "Setup" } as const;

export async function staticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { slug } }));
}

export default function Doc({ params }: PageProps<"/docs/[slug]">) {
  return <h1>{pages[params.slug as keyof typeof pages]}</h1>;
}
```

| Mode               | HTML                                                                                                                | JS shipped        | Navigation                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------- |
| `static` (default) | At build time, for each path from `staticPaths()`                                                                   | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `server`           | Per request: the shell, then streamed boundaries                                                                    | Islands only      | MPA (prefetch, opt-in View Transitions) |
| `spa`              | Server-rendered (per request, or at build time with `prerender`) and hydrated, or a client shell with `ssr = false` | The whole subtree | Client router (`<Link prefetch>`)       |

> **Details:** a page inherits the mode of its nearest layout that sets one, else the project
> default, `lumiose({ mode })`. `ssr` and `prerender` work the same way:
> [Setting the mode](../reference/rendering.md#setting-the-mode).

### Choosing a mode

Pick the mode per route, by what the page needs:

1. Start with `static`.
2. A page needs an interactive part: add an [island](islands.md). That is not a reason to change
   the mode.
3. A page reads the session, cookies or search params, or must be fresh: `server`.
4. A whole area behaves like an app: `spa`. Add `prerender` when its pages are the same for every
   reader, and use `ssr = false` only for code that cannot run on the server.

`lumiose routes` lists every route with its resolved mode. Typical pages, costs and a sample app
for each mode: [Choosing a mode](../reference/rendering.md#choosing-a-mode).

### Granularity and combining

The project sets defaults, a layout sets them for the pages below it, and a page's own exports
win. Components choose the finer features: `client:*` makes an island, `<Suspense>` marks a part
that may arrive later. `static` and `server` pages share layouts, and an `spa` subtree can sit
under server-rendered layouts.

What combines with each mode (islands, `<Suspense>`, request APIs), and the rules across levels:
[Granularity and combining](../reference/rendering.md#granularity-and-combining).

### How pages render

A `server` page sends its shell once everything outside `<Suspense>` has resolved. Boundaries
then stream in as they resolve and replace their fallbacks. So keep essential content, and
anything that decides the status or the head, outside.

```stsx check file=routes/stats/page.stsx
import { Suspense, Title } from "lumiose";

export const mode = "server";

async function SlowChart() {
  const points = await new Promise<number[]>((resolve) => {
    setTimeout(() => resolve([3, 1, 4]), 500);
  });
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

> **Details:** `static` and prerendered pages resolve everything: no fallbacks. The stream
> timeout, `response().setStreaming(false)` for one resolved document, hydration and how an `spa`
> subtree runs: [How pages render](../reference/rendering.md#how-pages-render).

### Prerendered SPA routes

`export const prerender = true` renders an `spa` page at build time into HTML that the SPA
hydrates. A layout sets it for every `spa` page below; a page opts out with `false`.

```stsx
// src/routes/layout.stsx: every page below is prerendered…
export const mode = "spa";
export const prerender = true;
```

```stsx
// src/routes/account/page.stsx: …except this one
export const prerender = false;
```

> **Details:** params, deep links to paths that were not built, browser-only code and moving
> from `ssr = false`: [Prerendered SPA routes](../reference/rendering.md#prerendered-spa-routes).
> It excludes `ssr = false` ([LUM5006](../errors/LUM5006.md)).

### Close to partial prerendering

No mode serves a prebuilt shell and fills its holes per request: a page is either built or
rendered on every request. Two patterns get close: `server` with `<Suspense>`, and `static` with
islands that call an endpoint. Their trade-offs, and the bookshelf sample that shows each:
[Close to partial prerendering](../reference/rendering.md#close-to-partial-prerendering).

### Compared with Astro islands

Lumiose islands follow Astro's idea and its `client:*` directive names. The differences (island
markup, replayed events, shared state, deferred server parts, navigation) are in
[Compared with Astro islands](../reference/rendering.md#compared-with-astro-islands).

### Build

`lumiose build` writes assets and prerendered files to `dist/client` and the server to
`dist/server/entry.js`. A site whose every route is prerendered builds no `dist/server`. The
steps, the output and how to serve it: [Build](../reference/rendering.md#build).

## API

| API                                                 | Use                                                       |
| --------------------------------------------------- | --------------------------------------------------------- |
| `export const mode = "static" \| "server" \| "spa"` | The route's mode (inherited from layouts).                |
| `export const ssr = false`                          | `spa` routes: render in the browser only.                 |
| `export const prerender = true`                     | `spa` pages: render at build time, then hydrate.          |
| `lumiose({ mode, ssr, prerender })`                 | The project defaults, in `vite.config.ts`.                |
| `export async function staticPaths()`               | Paths of a built route: `[{ params: { slug: "a" } }]`.    |
| `export function headers(ctx)`                      | Response headers for the page.                            |
| `<Suspense fallback>`                               | Marks content that may stream after the shell.            |
| `response().setStreaming(false)`                    | One resolved document for this response.                  |
| `lumiose({ streamTimeout })`                        | How long a render waits (`"30s"`; `false`: no limit).     |
| `renderToStream(root, options?)`                    | The server renderer: [reference](../reference/server.md). |

## Example

A prerendered `spa` page: built for each id, then hydrated. Browser-only code runs in `onMount`.

```stsx check file=routes/tracks/[id]/page.stsx
import { onMount, signal } from "lumiose";
import { params } from "lumiose/router";

export const mode = "spa"; // or from a layout
export const prerender = true;

export function staticPaths() {
  return ["1", "2", "3"].map((id) => ({ params: { id } }));
}

export default function Track() {
  const volume = signal(1);
  // Runs after hydration, never at build time.
  onMount(() => {
    volume.set(Number(localStorage.getItem("volume") ?? 1));
  });
  return (
    <h1>
      Track {params().id} (volume {volume()})
    </h1>
  );
}
```

## Common mistakes

- **Request APIs in a `static` route** (`LUM5001`). They need `mode = "server"`.
- **Status or `<Title>` inside `<Suspense>`** (`LUM5004`). Decide them outside the boundary.
- **The whole page in `<Suspense>`.** The shell is then just the fallback.
- **Streamed fallbacks for crawlers.** Turn streaming off for them
  ([recipe](server.md#crawlers-get-one-resolved-document)).
- **No `streamTimeout`** with a data source that never answers (`LUM5009`).
- **`cookies` or `locals` as props of an `spa` route** (`LUM4002`). Call an endpoint.
- **A computed `mode`.** It must be a string literal (`LUM5002`).
- **Browser APIs at module scope of a prerendered `spa` page** (`LUM4004`).
- **`prerender = true` with `ssr = false`** (`LUM5006`).

The long forms: [Common mistakes](../reference/rendering.md#common-mistakes).

## Related diagnostics

- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.
- [LUM5006](../errors/LUM5006.md): prerendered page that renders only in the browser.
- [LUM5009](../errors/LUM5009.md): boundary still pending when `streamTimeout` expired.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.

See also: [Islands](islands.md), [Async components](async.md), [Head and document](head.md).
