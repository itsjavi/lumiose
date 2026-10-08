# Routing

> Routes are files under `src/routes`: pages (`.stsx`/`.tsx`), endpoints (`.ts`), nested `_layout` files and `_404`/`_error` pages. Route patterns and params are typed by `lumen typegen`.

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
  page exports: `mode`, `ssr`, `staticPaths`, `action`/`actions` and `headers` (see
  [Rendering modes](rendering-modes.md) and [Data and actions](data-and-actions.md)).
- **Error pages:** `_404` renders unmatched URLs and `notFound()`; `_error` renders thrown errors
  and `error(status)`. Both receive `{ status, error }`. Outside dev, unexpected errors are masked
  as 500.

**Typed routes.** `lumen typegen` (run by `lumen check` and the dev server) writes
`.lumen/types/routes.d.ts`, which augments `RouteMap`. Then:

- `href("/blog/[slug]", { slug })` builds a URL and type-checks the pattern and params;
- `params<"/blog/[slug]">()` and `RouteProps<"/blog/[slug]">` type the params.

**Navigation.** Routes are MPA by default (full page loads). For smooth MPA navigation today, add
the CSS opt-in `@view-transition { navigation: auto; }` to a global style block, and optionally a
`<script type="speculationrules">` for prefetching; the travel-journal example does both. Built-in
`lumen()` options for these are planned (TASK-93). Routes with `mode = "spa"` use the client router `lumen/router`
([reference](../reference/router.md)):

- The SPA starts at the outermost `spa` layout (or the page itself) and covers every `spa` page
  below it; links between them navigate on the client, other links load the document.
- `<Link href prefetch>` (plain `<a>` links work too), `navigate(href, { replace })`, reactive
  `params()`, `url()`, `search()` (`search.set()` changes the query) and `navigating()`.
- Layouts persist: a layout's `children` is the outlet, and layouts shared by the old and the new
  page keep their state. A page with other param values (`songs/[id]`) is a new page.
- A navigation holds the old page until the new page's async content is ready, then swaps.
- Scroll restoration, focus reset, `_404` for unknown URLs and `notFound()`, `_error` for errors.

> **Status:** file routes, the manifest, matching, typegen, `href()`, the request handler and the
> SPA router (`lumen/router`) are available, served by `lumen dev`, `lumen build` and
> `lumen preview`.

## API

| API                                                              | Use                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| `export default function Page(props: RouteProps<"/x/[id]">)`     | A page component.                                      |
| `params<"/x/[id]">()`                                            | The matched route's params, typed by pattern (server). |
| `href(pattern, params?)`                                         | Build a URL from a typed route pattern.                |
| `Routes`, `RouteParams<P>`, `RouteProps<P>`, `RouteMap`          | Route types.                                           |
| `ErrorPageProps`                                                 | Props of `_404` and `_error`.                          |
| `notFound()`, `error(status, message?)`, `redirect(to, status?)` | Stop rendering; see [Server](server.md).               |
| `lumen/router`: `Link`, `navigate`, `navigating`, `search`       | SPA routes ([reference](../reference/router.md)).      |

## Example

```stsx check file=routes/_layout.stsx
// src/routes/_layout.stsx
import { href } from "lumen";

export default function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="app">
      <nav>
        <a href={href("/")}>Home</a>
        <a href={href("/blog/[slug]", { slug: "hello-world" })}>First post</a>
      </nav>
      {props.children}

      <style global>
        body { margin: 0; font-family: system-ui, sans-serif; }
      </style>
    </div>
  );
}
```

```stsx check file=routes/blog/[slug].stsx
// src/routes/blog/[slug].stsx
import { Title, notFound, type RouteProps } from "lumen";

const posts: Record<string, string> = { "hello-world": "Hello, world" };

export const mode = "server";

export default function Post({ params }: RouteProps<"/blog/[slug]">) {
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
// src/routes/_404.tsx
import type { ErrorPageProps } from "lumen";

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
- **Route loaders.** There are none: load data in the async page component itself (decision-18).
- **`mode` that is not a string literal.** `export const mode = getMode()` cannot be read at build
  time (`LUM5002`).

## Related diagnostics

- [LUM5002](../errors/LUM5002.md): invalid route file.
- [LUM5003](../errors/LUM5003.md): duplicate route.
- [LUM5001](../errors/LUM5001.md): request API used during prerender.

See also: [Rendering modes](rendering-modes.md), [Server](server.md), [reference: app layer](../reference/app.md), [`lumen/router`](../reference/router.md).
