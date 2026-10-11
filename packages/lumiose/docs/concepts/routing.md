# Routing

> Routes are files under `src/routes`: pages (`.stsx`/`.tsx`), endpoints (`.ts`), nested `_layout` files and `_404`/`_error` pages. Route patterns and params are typed by `lumiose typegen`.

## Concept

```
src/
  routes/
    _layout.stsx            root layout; nested _layout.stsx per folder
    index.stsx              /
    about.stsx              /about
    blog/index.stsx         /blog
    blog/[slug].stsx        /blog/:slug
    docs/[...path].stsx     /docs/*  (rest param, may be empty)
    (marketing)/pricing.stsx  /pricing  (a group folder adds no URL segment)
    api/posts.ts            endpoint: export GET / POST / … = (ctx) => Response
    sitemap.xml.ts          endpoint at /sitemap.xml
    _404.stsx  _error.stsx  error pages, nearest one wins
  document.stsx             optional: owns <html>, <head> and <body>
  middleware.ts             optional: export default (ctx, next) => Promise<Response>
```

- **Matching priority:** static segments beat `[param]`, which beats `[...rest]`. Two files for
  the same pattern are `LUM5003`.
- Only `_layout`, `_404` and `_error` may start with `_`; keep shared modules out of `src/routes`
  (`LUM5002`).
- **Layouts** wrap every page below their folder and receive `{ params, children }`. `children`
  is the page (the outlet).
- **Pages** export a `default` component (it may be `async`), which receives `{ params }`. Other
  page exports: `mode`, `ssr`, `staticPaths`, `action`/`actions`, `headers` and `limits` (see
  [Rendering modes](rendering-modes.md), [Data and actions](data-and-actions.md) and
  [Security](security.md)). Endpoints may export `limits` too.
- **Error pages:** `_404` renders unmatched URLs and `notFound()`; `_error` renders thrown errors
  and `error(status)`. Both receive `{ status, error }`. Outside dev, unexpected errors are masked
  as 500. An error page renders inside the layouts of its folder, like a page there: the root
  `_404` gets the root `_layout` (header, navigation), so it only renders its own content. If a
  layout itself fails, the error page renders without layouts. To give errors a different frame,
  move the regular pages into a group with their own layout (`(app)/_layout.stsx`) and keep the
  error page outside it.

**Typed routes.** `lumiose typegen` (run by `lumiose check` and the dev server) writes
`.lumiose/types/routes.d.ts`, which augments `RouteMap` (pages and endpoints) and `LayoutMap`
(layouts). Every route-bound type then takes the route pattern as a string literal, checked
against that table: an unknown or stale pattern is a type error, and editors complete it.

- `href("/blog/[slug]", { slug })` builds a URL and type-checks the pattern and params; the URL
  includes Vite's `base` and follows `trailingSlash` ([reference](../reference/app.md#href));
- `PageProps<"/blog/[slug]">` types a page's props, `LayoutProps<"/blog">` a layout's
  (`{ params, children }`, with the params of the layout's URL scope; route groups such as `(app)`
  add nothing to it), and `params<"/blog/[slug]">()` the params anywhere on the server;
- `RequestContext<P>`, `ActionContext<P>` and `Endpoint<P>` type `ctx.params` of middleware
  helpers, actions and endpoints (see [Data and actions](data-and-actions.md)).

**Navigation.** Routes are MPA by default: links load the next document. Two `lumiose()` options in
`vite.config.ts` make these navigations smooth ([reference](../reference/vite.md#lumiose)); both are
progressive, so browsers without support navigate normally:

- **Prefetch** (`prefetch`, default `"hover"`). Pages get `<script type="speculationrules">` that
  prefetches same-origin links: when the pointer rests on a link (`"hover"`), early, as the browser
  sees fit (`"viewport"`), or never (`"none"`). Links to endpoints are never prefetched, since a GET
  endpoint may act (`/logout`). `spa` pages get no rules: there `<Link prefetch>` decides per link.
- **Per link**, `<Link prefetch>` from `lumiose/router` overrides the default on MPA pages too. There
  it renders a plain `<a>` (no JavaScript, no router) with a `data-l-prefetch` marker, and the
  rules prefetch it at its own level: `"none"` opts the link out, `"viewport"` prefetches it early,
  `"hover"` on hover. `<Link>` without `prefetch`, like a plain `<a>`, follows the default. The
  server `<Link>` tells the page it rendered a marker as it renders; a hand-written
  `data-l-prefetch` attribute on a plain `<a>` does not change the page's rules.
- **View Transitions** (`viewTransitions: true`, off by default). Every page opts into
  cross-document View Transitions (`@view-transition { navigation: auto }`), except for readers who
  prefer reduced motion: the old page cross-fades into the new one. An element morphs into its
  counterpart on the next page when both have the same CSS `view-transition-name`, unique on each
  page: in a style block (`.site-header { view-transition-name: site-header; }`) or per item with
  ``style={{ "view-transition-name": `cover-${post.slug}` }}``. Style the animation with the
  `::view-transition-*` pseudo-elements in a global style block.

```ts
// vite.config.ts
export default defineConfig({ plugins: [lumiose({ viewTransitions: true })] });
```

```tsx
import { Link } from "lumiose/router";

// In any page or component: the next page prefetches early, the archive never.
<Link href="/page/2" prefetch="viewport">Older →</Link>
<Link href="/archive" prefetch="none">Archive</Link>
```

Routes with `mode = "spa"` use the client router `lumiose/router` ([reference](../reference/router.md)):

- The SPA starts at the outermost `spa` layout (or the page itself) and covers every `spa` page
  below it; links between them navigate on the client, other links load the document.
- `<Link href prefetch>` (plain `<a>` links work too), `navigate(href, { replace })`, reactive
  `params()`, `route()` (the matched pattern), `url()`, `searchParams()` (`searchParams.set()` changes the
  query) and `isNavigating()`.
- Layouts persist: a layout's `children` is the outlet, and layouts shared by the old and the new
  page keep their state. A page with other param values (`songs/[id]`) is a new page.
- A navigation holds the old page until the new page's async content is ready, then swaps.
- Scroll restoration, focus reset, `_404` for unknown URLs and `notFound()`, `_error` for errors.

> **Status:** file routes, the manifest, matching, typegen, `href()`, the request handler, MPA
> prefetch and View Transitions, and the SPA router (`lumiose/router`) are available, served by
> `lumiose dev`, `lumiose build` and `lumiose preview`.

## API

| API                                                                                                   | Use                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `export default function Page(props: PageProps<"/x/[id]">)`                                           | A page component.                                             |
| `export default function Layout(props: LayoutProps<"/x">)`                                            | A layout: `{ params, children }`.                             |
| `params<"/x/[id]">()`                                                                                 | The matched route's params, typed by pattern (server).        |
| `href(pattern, params?)`                                                                              | Build a URL from a typed route pattern.                       |
| `Routes`, `RouteParams<P>`, `RouteMap`, `LayoutMap`                                                   | Route types.                                                  |
| `ErrorPageProps`                                                                                      | Props of `_404` and `_error`.                                 |
| `notFound()`, `error(status, message?)`, `redirect(to, status?)`                                      | Stop rendering; see [Server](server.md).                      |
| `lumiose/router`: `Link`, `navigate`, `isNavigating`, `searchParams`, reactive `url`/`params`/`route` | SPA routes and islands ([reference](../reference/router.md)). |

## Example

```stsx check file=routes/_layout.stsx
// src/routes/_layout.stsx
import { href, type LayoutProps } from "lumiose";

export default function Layout(props: LayoutProps<"/">) {
  return (
    <div class="app">
      <nav>
        <a href={href("/")}>Home</a>
        <a href={href("/blog/[slug]", { slug: "hello-world" })}>First post</a>
      </nav>
      {props.children}
    </div>
  );
}

<style global>
  body { margin: 0; font-family: system-ui, sans-serif; }
</style>
```

```stsx check file=routes/blog/[slug].stsx
// src/routes/blog/[slug].stsx
import { Title, notFound, type PageProps } from "lumiose";

const posts: Record<string, string> = { "hello-world": "Hello, world" };

export const mode = "server";

export default function Post({ params }: PageProps<"/blog/[slug]">) {
  // A function, so the JSX re-reads it when the params change (a plain const would be LUM2001).
  const title = () => posts[params.slug] ?? notFound();

  return (
    <article>
      <Title>{title()}</Title>
      <h1>{title()}</h1>
    </article>
  );
}
```

```tsx check file=routes/_404.tsx
// src/routes/_404.tsx: renders inside routes/_layout.stsx above (its nav and styles), so only
// the page content goes here
import type { ErrorPageProps } from "lumiose";

export default function NotFound({ status, error }: ErrorPageProps) {
  return (
    <main>
      <h1>{status}</h1>
      <p>{error.message}</p>
    </main>
  );
}
```

```tsx check file=routes/index.tsx
// src/routes/index.tsx
export default function Home() {
  return <h1>Home</h1>;
}
```

## Common mistakes

- **Helpers inside `src/routes`.** `src/routes/_utils.ts` or `src/routes/(x).stsx` are not routes
  (`LUM5002`). Put shared modules in `src/lib` or `src/components`.
- **Two files for one URL.** `blog.stsx` and `blog/index.stsx` both match `/blog` (`LUM5003`).
- **Hard-coded URLs.** `"/blog/" + slug` breaks silently when a route moves; `href("/blog/[slug]",
  { slug })` fails type-checking instead.
- **Reading params from `window.location` in a server component.** Use `props.params` or
  `params()`.
- **Matching `url().pathname` to know which route is showing.** `route() === "/songs/[id]"`
  compares the matched pattern, type-checked against the app's routes.
- **Route loaders.** There are none: load data in the async page component itself (decision-18).
- **`mode` that is not a string literal.** `export const mode = getMode()` cannot be read at build
  time (`LUM5002`).

## Related diagnostics

- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5003](../errors/LUM5003.md): duplicate route.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.

See also: [Rendering modes](rendering-modes.md), [Server](server.md), [reference: app layer](../reference/app.md), [`lumiose/router`](../reference/router.md).
