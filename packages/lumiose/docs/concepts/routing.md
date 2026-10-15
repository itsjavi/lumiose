# Routing

> Routes are folders under `src/routes`, named like the Next.js App Router: pages, layouts, endpoints and error pages, with typed params.

## Concept

```
src/
  routes/
    layout.stsx                     root layout; a nested layout.stsx per folder
    page.stsx                       /
    about/page.stsx                 /about
    blog/page.stsx                  /blog
    blog/[slug]/page.stsx           /blog/:slug
    blog/[slug]/Comments.stsx       colocated module, not a route
    blog/_lib/posts.ts              private folder: nothing below it routes
    docs/[[...path]]/page.stsx      /docs and /docs/*  (optional rest)
    files/[...path]/page.stsx       /files/*  (rest: one or more segments)
    [[lang]]/contact/page.stsx      /contact and /:lang/contact  (optional param)
    (marketing)/pricing/page.stsx   /pricing  (a group folder adds no URL segment)
    api/posts/route.ts              endpoint: export GET / POST / … = (ctx) => Response
    sitemap.xml/route.ts            endpoint at /sitemap.xml
    not-found.stsx  error.stsx      error pages, nearest one wins
  document.stsx                     optional: owns <html>, <head> and <body>
  middleware.ts                     optional: export default (ctx, next) => Promise<Response>
```

- **A folder is a URL segment; special files give it behavior:** `page.stsx` or `page.tsx` (the
  page), `route.ts` (an endpoint), and `layout`, `not-found` and `error` (`.stsx` or `.tsx`).
  There is no `index` and no flat page file: `about/page.stsx` is the page at `/about`, and
  `about.stsx` is not a route. A folder has a page or a `route.ts`, not both (`LUM5003`).
- **Colocation:** any other file in `src/routes` (components, helpers, styles, tests) is ignored
  by the router, so it can live next to the route that uses it. A folder whose name starts with
  `_` is private: nothing below it routes, not even a `page.stsx`.
- **Segments:** `[param]` matches one segment, `[[param]]` zero or one, `[...rest]` one or more
  and `[[...rest]]` zero or more (joined with `/`); `(group)` folders add no segment. A rest
  segment is the last one of the URL. An optional param that matched nothing is absent:
  `params.lang` is `undefined` at `/contact`.
- **Matching priority:** segment by segment, static beats `[param]`, which beats `[...rest]`. A
  route with optional segments competes with each URL shape it serves: `/[[lang]]/contact` serves
  `/contact` as a static route. Two files that serve the same URL are `LUM5003`, including a
  `[[...rest]]` folder next to a page for the URL without it.
- **Next.js files Lumiose does not have** are `LUM5002`, so they never silently do nothing:
  `loading`, `template`, `default` and `global-error` files, `@slot` folders (parallel routes)
  and `(.)` folders (intercepting routes).
- **Layouts** wrap every page below their folder and receive `{ params, children }`. `children`
  is the page (the outlet).
- **Pages** export a `default` component (it may be `async`), which receives `{ params }`. Other
  page exports: `mode`, `ssr`, `prerender`, `staticPaths`, `action`/`actions`, `headers` and
  `limits` (see
  [Rendering modes](rendering-modes.md), [Data and actions](data-and-actions.md) and
  [Security](security.md)). Endpoints may export `limits` too.
- **Error pages:** `not-found` renders unmatched URLs and `notFound()`; `error` renders thrown
  errors and `error(status)`. Both receive `{ status, error }`. Outside dev, unexpected errors are
  masked as 500. An error page renders inside the layouts of its folder, like a page there: the
  root `not-found` gets the root `layout` (header, navigation), so it only renders its own
  content. If a layout itself fails, the error page renders without layouts. To give errors a
  different frame, move the regular pages into a group with their own layout
  (`(app)/layout.stsx`) and keep the error page outside it.

**Locales.** With `lumiose({ i18n })`, the router also serves each page under the prefixes of the
locales it declares (`/es/about` from `about/page.stsx`), and `href()`, `<html lang>` and the
`hreflang` links follow. See [Internationalization](i18n.md).

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
  helpers, actions and endpoints (see [Data and actions](data-and-actions.md));
- optional params are optional properties (`RouteParams<"/[[lang]]/contact">` is
  `{ lang?: string }`), and `href()` leaves out an optional segment whose param is missing or
  empty: `href("/docs/[[...path]]")` is `/docs`.

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
- A navigation holds the old page until the new page's async content is ready, then swaps. With
  `viewTransitions: true`, a navigation to another page swaps inside
  [`viewTransition()`](../reference/components.md#viewtransition) (a query change on the same page
  does not), and `<ViewTransition>` names the elements that morph.
- Scroll restoration, focus reset, `not-found` for unknown URLs and `notFound()`, `error` for
  errors.
- Navigation hooks: `beforeNavigate(fn)` runs before each navigation and may `cancel()` it (to
  confirm leaving unsaved changes; the browser asks for one that unloads the document), and
  `afterNavigate(fn)` runs after each completed one and once on mount (page views, focus). They
  belong to the component that calls them during setup, and work in islands of MPA pages too
  (`"leave"` and `"enter"` only). See [Navigation hooks](../reference/router.md#navigation-hooks).

```tsx
import { signal } from "lumiose";
import { afterNavigate, beforeNavigate } from "lumiose/router";

export function Editor() {
  const dirty = signal(false);
  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.willUnload) navigation.cancel(); // the browser asks
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });
  afterNavigate((navigation) => console.info("page view", navigation.to?.url.pathname));
  return <textarea onInput={() => dirty.set(true)} />;
}
```

> **Status:** file routes, the manifest, matching, typegen, `href()`, the request handler, MPA
> prefetch and View Transitions, and the SPA router (`lumiose/router`) are available, served by
> `lumiose dev`, `lumiose build` and `lumiose preview`.

## API

| API                                                                                                   | Use                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `export default function Page(props: PageProps<"/x/[id]">)`                                           | A page component.                                                                      |
| `export default function Layout(props: LayoutProps<"/x">)`                                            | A layout: `{ params, children }`.                                                      |
| `params<"/x/[id]">()`                                                                                 | The matched route's params, typed by pattern (server).                                 |
| `href(pattern, params?)`                                                                              | Build a URL from a typed route pattern.                                                |
| `Routes`, `RouteParams<P>`, `RouteMap`, `LayoutMap`                                                   | Route types.                                                                           |
| `ErrorPageProps`                                                                                      | Props of `not-found` and `error` pages.                                                |
| `notFound()`, `error(status, message?)`, `redirect(to, status?)`                                      | Stop rendering; see [Server](server.md).                                               |
| `lumiose/router`: `Link`, `navigate`, `isNavigating`, `searchParams`, reactive `url`/`params`/`route` | SPA routes and islands ([reference](../reference/router.md)).                          |
| `lumiose/router`: `beforeNavigate(fn)`, `afterNavigate(fn)`                                           | Run around navigations; cancel one ([hooks](../reference/router.md#navigation-hooks)). |

## Example

```stsx check file=routes/layout.stsx
// src/routes/layout.stsx
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

```stsx check file=routes/blog/[slug]/page.stsx
// src/routes/blog/[slug]/page.stsx
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

```tsx check file=routes/not-found.tsx
// src/routes/not-found.tsx: renders inside routes/layout.stsx above (its nav and styles), so only
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

```tsx check file=routes/page.tsx
// src/routes/page.tsx
export default function Home() {
  return <h1>Home</h1>;
}
```

## Common mistakes

- **A flat or `index` page file.** `src/routes/about.stsx` and `src/routes/blog/index.stsx` are
  colocated modules, not routes: name them `about/page.stsx` and `blog/page.stsx`. `lumiose routes`
  lists what the router sees.
- **A `[...rest]` folder for its parent's URL.** `docs/[...path]/page.stsx` does not match
  `/docs`: use `docs/[[...path]]/page.stsx`, or add `docs/page.stsx`.
- **Two files for one URL.** `cart/page.stsx` and `(shop)/cart/page.stsx` both match `/cart`, and
  so do `feed/page.stsx` and `feed/route.ts` (`LUM5003`).
- **Hard-coded URLs.** `"/blog/" + slug` breaks silently when a route moves; `href("/blog/[slug]",
  { slug })` fails type-checking instead.
- **Reading params from `window.location` in a server component.** Use `props.params` or
  `params()`.
- **Matching `url().pathname` to know which route is showing.** `route() === "/songs/[id]"`
  compares the matched pattern, type-checked against the app's routes.
- **Route loaders.** There are none: load data in the async page component itself (decision-18).
- **A custom dialog for leaving the document.** For a navigation that unloads the page
  (`navigation.willUnload`), `cancel()` makes the browser show its own prompt; a `confirm()` or a
  modal cannot run there. Ask with your own UI only for navigations inside the SPA.
- **`mode` that is not a string literal.** `export const mode = getMode()` cannot be read at build
  time (`LUM5002`).

## Related diagnostics

- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5003](../errors/LUM5003.md): duplicate route.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.

See also: [Rendering modes](rendering-modes.md), [Server](server.md), [reference: app layer](../reference/app.md), [`lumiose/router`](../reference/router.md).
