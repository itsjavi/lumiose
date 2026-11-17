# Routing

> Routes are folders under `src/routes`, named like the Next.js App Router: pages, layouts, endpoints and error pages, with typed params.

## Concept

### Folders are routes

A folder is a URL segment, and special files give it behavior: `page`, `layout`, `not-found` and
`error` (`.stsx` or `.tsx`), `route.ts` and `middleware.ts`. Any other file is ignored by the
router, so it can live next to the route that uses it.

```
src/
  routes/
    layout.stsx                  root layout
    page.stsx                    /
    about/page.stsx              /about
    blog/[slug]/page.stsx        /blog/:slug
    blog/[slug]/Comments.stsx    colocated, not a route
    blog/_lib/posts.ts           private folder
    docs/[[...path]]/page.stsx   /docs and /docs/*
    files/[...path]/page.stsx    /files/*
    [[lang]]/contact/page.stsx   /contact, /:lang/contact
    (shop)/pricing/page.stsx     /pricing
    api/posts/route.ts           endpoint
    admin/middleware.ts          for all below /admin
    not-found.stsx  error.stsx   error pages
  document.stsx                  optional: owns <html>
  middleware.ts                  optional
```

> **Details:** segments, matching priority, private folders, the Next.js files that are
> `LUM5002`, and locale prefixes ([Internationalization](i18n.md)):
> [File routes](../reference/app.md#file-routes).

### Pages and layouts

A layout wraps every page below its folder: `children` is the page. A page exports a `default`
component, which may be `async`, and receives `{ params }`. `href()` builds a URL from a route
pattern and type-checks its params.

```stsx check file=routes/layout.stsx
import { href, type LayoutProps } from "lumiose";

export default function Layout(props: LayoutProps<"/">) {
  const post = href("/blog/[slug]", { slug: "hello-world" });
  return (
    <div class="app">
      <nav>
        <a href={href("/")}>Home</a>
        <a href={post}>First post</a>
      </nav>
      {props.children}
    </div>
  );
}

<style global>
  body { margin: 0; font-family: system-ui, sans-serif; }
</style>
```

```tsx check file=routes/page.tsx
export default function Home() {
  return <h1>Home</h1>;
}
```

> **Details:** `lumiose typegen` writes the route table that `PageProps`, `LayoutProps`,
> `params()`, `href()` and the context types check patterns against:
> [Typed routes](../reference/app.md#typed-routes). The other page exports (`mode`,
> `staticPaths`, `action`, `headers`, `limits`): [File routes](../reference/app.md#file-routes).

### Error pages

`not-found` renders unmatched URLs and `notFound()`; `error` renders thrown errors and
`error(status)`. The nearest one wins, and it renders inside the layouts of its folder, so it
holds only its own content.

```tsx check file=routes/not-found.tsx
import type { ErrorPageProps } from "lumiose";

export default function NotFound(props: ErrorPageProps) {
  return (
    <main>
      <h1>{props.status}</h1>
      <p>{props.error.message}</p>
    </main>
  );
}
```

### Navigation

Routes are MPA by default: a link loads the next document, and same-origin links are prefetched
on hover. `<Link prefetch>` sets the level per link, and `lumiose({ viewTransitions: true })`
turns on cross-document View Transitions.

```tsx
import { Link } from "lumiose/router";

// The next page prefetches early, the archive never.
<Link href="/page/2" prefetch="viewport">Older →</Link>
<Link href="/archive" prefetch="none">Archive</Link>
```

> **Details:** [Prefetch and View Transitions](../reference/app.md#mpa-navigation-prefetch-and-view-transitions).
> Routes with `mode = "spa"` navigate on the client with `lumiose/router`: layouts persist, and
> `beforeNavigate` and `afterNavigate` run around navigations
> ([The SPA router in short](../reference/router.md#the-spa-router-in-short)).

## API

| API                                                                          | Use                                                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `export default function Page(props: PageProps<P>)`                          | A page component.                                                                  |
| `export default function Layout(props: LayoutProps<P>)`                      | A layout: `{ params, children }`.                                                  |
| `params<"/x/[id]">()`                                                        | The matched route's params (server).                                               |
| `href(pattern, params?)`                                                     | A URL from a typed route pattern.                                                  |
| `Routes`, `RouteParams<P>`, `RouteMap`, `LayoutMap`                          | Route types.                                                                       |
| `ErrorPageProps`                                                             | Props of `not-found` and `error` pages.                                            |
| `notFound()`, `error(status, message?)`, `redirect(to, status?)`             | Stop rendering: [Server](server.md).                                               |
| `Link`, `navigate`, `isNavigating`, `searchParams`, `url`, `params`, `route` | `lumiose/router`: SPA routes; `Link`, the hooks and `searchParams` in islands too. |
| `beforeNavigate(fn)`, `afterNavigate(fn)`                                    | `lumiose/router`: run around navigations; cancel one.                              |

Signatures: [app layer](../reference/app.md#routing), [`lumiose/router`](../reference/router.md).

## Example

A `server` page with a param. `notFound()` renders the nearest `not-found` page.

```stsx check file=routes/blog/[slug]/page.stsx
import { Title, notFound, type PageProps } from "lumiose";

const posts: Record<string, string> = {
  "hello-world": "Hello, world",
};

export const mode = "server";

export default function Post(props: PageProps<"/blog/[slug]">) {
  // A function, so the JSX re-reads it when the params
  // change (a plain const would be LUM2001).
  const title = () => posts[props.params.slug] ?? notFound();

  return (
    <article>
      <Title>{title()}</Title>
      <h1>{title()}</h1>
    </article>
  );
}
```

## Common mistakes

- **A flat or `index` page file.** `about.stsx` is not a route: name it `about/page.stsx`.
  `lumiose routes` lists what the router sees.
- **`docs/[...path]` for `/docs`.** Use `docs/[[...path]]`, or add `docs/page.stsx`.
- **Two files for one URL** (`LUM5003`).
- **Hard-coded URLs.** `href("/blog/[slug]", { slug })` fails type-checking when a route moves.
- **Matching `url().pathname`.** Compare `route() === "/songs/[id]"`.
- **Route loaders.** There are none: load data in the async page component.
- **A `mode` that is not a string literal** (`LUM5002`).

The full list: [Common routing mistakes](../reference/app.md#common-routing-mistakes).

## Related diagnostics

- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5003](../errors/LUM5003.md): duplicate route.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.
- [LUM5008](../errors/LUM5008.md): folder middleware covering prerendered routes.

See also: [Rendering modes](rendering-modes.md), [Server](server.md), [reference: app layer](../reference/app.md), [`lumiose/router`](../reference/router.md).
