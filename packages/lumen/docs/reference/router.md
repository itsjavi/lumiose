# `lumen/router`

> The client router for `spa` routes, built on the Navigation API: `<Link>`, `navigate()`, reactive `params()`, `route()`, `search()`, `url()` and `navigating()`, persistent layouts, transitions that hold the old page, scroll and focus restoration, and a client-side `_404`.

`lumen/router` works inside `spa` routes (`export const mode = "spa"`, or `lumen({ mode: "spa" })`
for the whole project); `<Link>` works on MPA pages too (see [Link](#link)). Pages and layouts of an SPA import it like any module; on the server
(`ssr` pages) the same names read the request: `params()`, `route()`, `url()` and `search()` return the
request's values, `<Link>` renders its `<a>`, `navigating()` is `false`, and `navigate()` and
`search.set()` throw (call them from event handlers and effects). Concepts:
[Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md).

## Components

### Link

```ts
function Link(props: LinkProps): JSX.Element;

type LinkProps = Omit<JSX.IntrinsicElements["a"], "href" | "children"> & {
  href: string;
  /** Default "hover" in spa pages; on MPA pages, lumen({ prefetch }). */
  prefetch?: "hover" | "viewport" | "none";
  children?: JSX.Element;
};
```

An `<a href>` with every attribute and event of `<a>`. The router navigates plain `<a>` links too;
`<Link>` adds:

- **Prefetch.** It loads the target route's modules ahead of the click: when the pointer enters
  the link or it gets focus (`hover`), when it enters the viewport (`viewport`), or not (`none`).
  Data still loads when the page renders. `spa` pages get no speculation rules, so this is the
  prefetch of their links.
- **On MPA pages** (static and server routes) there is no router: `<Link>` renders a plain `<a>`,
  outside islands without any JavaScript, and `prefetch` sets how the page's speculation rules from
  `lumen({ prefetch })` treat it ([Routing](../concepts/routing.md)). The `<a>` gets
  `data-l-prefetch="<level>"`; the rules skip `none` links, prefetch `viewport` links with `eager`
  and `hover` links with `moderate` eagerness, and give unmarked links (`<Link>` without
  `prefetch`, plain `<a>`) the project default. With `lumen({ prefetch: "none" })`, only pages that
  have `hover` or `viewport` links get rules. Browsers prefetch URLs: a `none` link to a URL that
  another link on the page prefetches does not stop it.
- **`aria-current="page"`** while its path is the current URL's path (style it with
  `a[aria-current="page"]`).

Build `href` with [`href()`](app.md#href) so the route and its params type-check.

## Navigation

### navigate

```ts
function navigate(href: string | URL, options?: NavigateOptions): Promise<void>;

interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
}
```

Navigates on the client when `href` belongs to the current SPA, else loads the document. Resolves
once the new page is on screen (its async content ready), or when another navigation supersedes
it. Browser only. Only `http:` and `https:` URLs (relative ones included) navigate: any other
scheme, such as `javascript:`, throws a `TypeError`.

### navigating

```ts
function navigating(): boolean;
```

Whether a navigation is in flight: from the click until the new page is on screen. Reactive, and
counted by [`busy()`](reactivity.md) (decision-20).

## Route state

### params

```ts
function params<P extends Routes = never>(): RouteParams<P>; // untyped: Record<string, string>
```

The current route's params, reactive: `params<"/songs/[id]">().id`. Pages also receive them as
`props.params`.

### route

```ts
function route(): Routes | undefined;
```

The matched route pattern, reactive: `route() === "/songs/[id]"`. Compare patterns instead of
matching `url().pathname`; typegen makes an unknown pattern a type error. `undefined` on a `_404`
page for an unknown URL (a matched route that throws `notFound()` keeps its pattern).

### url

```ts
function url(): URL;
```

The current URL, reactive. Do not mutate it.

### search

```ts
interface Search {
  (): URLSearchParams;
  set(
    next: SearchInit | ((current: URLSearchParams) => SearchInit),
    options?: NavigateOptions,
  ): Promise<void>;
}
const search: Search;

type SearchInit =
  | URLSearchParams
  | string
  | Record<string, string | number | boolean | readonly string[] | null | undefined>;
```

`search()` is the current URL's query, reactive (a new object per change). `search.set()`
navigates to the current path with a new query, keeping the scroll position; `null` and
`undefined` values are left out. It adds a history entry unless `{ replace: true }`.

While a page is still loading during a navigation, `params()`, `route()`, `url()` and `search()` called in it
(and its props) already describe the page it is loading; everything else keeps the shown URL until
the new page is on screen.

## Behaviour

- **Interception.** The router handles same-document navigations to URLs of its SPA: link clicks,
  `navigate()`, back/forward and (with the Navigation API) `GET` form submissions. URLs of other
  routes (`static` or `server` pages, endpoints, other SPAs) load the document. Without the
  Navigation API, a History API fallback intercepts link clicks and `popstate`; it is a chunk of its
  own that only those browsers load, shortly after the SPA starts (a click before it loads is a
  document navigation).
- **Persistent layouts.** A layout's `children` is the outlet. Layouts the old and the new page
  share stay mounted with their state; the first level that differs (another file, or other
  values of the params in its path, such as `songs/[id].stsx` for another song) is replaced. A
  navigation that only changes the query keeps every level and updates `search()`.
- **Transitions.** The new page is created off-screen. The old page stays until the new page's
  async content (async components and resources outside a `<Suspense>` of the new page) is ready;
  then the URL signals change and the pages swap in one step. A `<Suspense>` inside the new page
  shows its fallback instead.
- **Scroll and focus.** After a navigation the page scrolls to the top (or to the URL's `#hash`)
  and focus moves to the document (or the first `[autofocus]` element); back/forward restore the
  scroll position. `search.set()` keeps both.
- **Errors.** `notFound()` and unknown URLs render the nearest `_404` page of the SPA; other errors
  its `_error` page (`{ status, error }` props), with the layouts kept. A thrown `redirect()`
  navigates. Without such a page, a minimal built-in error page replaces the SPA.
- **`invalidate()`** from `lumen` re-runs the SPA's async components and resources (they keep
  their UI meanwhile) and resolves once they settled. `submit()` redirects navigate through the
  router, and a successful `submit()` invalidates (on MPA pages it does not: that would reload).
- **Stale modules.** A page module that fails to load (an old chunk after a deploy) loads the URL
  as a document instead.

## Example

```tsx check file=routes/music/_layout.tsx
// src/routes/music/_layout.tsx: an SPA under /music, with a persistent layout
import { href, type LayoutProps } from "lumen";
import { Link, navigating } from "lumen/router";

export const mode = "spa";

export default function Layout(props: LayoutProps<"/music">) {
  return (
    <div class="app">
      <nav>
        <Link href={href("/music")}>Songs</Link>
        <Link href={href("/music/settings")} prefetch="viewport">
          Settings
        </Link>
      </nav>
      {navigating() && <progress />}
      <main>{props.children}</main>
    </div>
  );
}
```

```tsx check file=routes/music/index.tsx
// src/routes/music/index.tsx: a filter kept in the query
import { search } from "lumen/router";

export default function Songs() {
  const query = () => search().get("q") ?? "";
  return (
    <input
      type="search"
      value={query()}
      onInput={(event) => search.set({ q: event.currentTarget.value || null }, { replace: true })}
    />
  );
}
```

```tsx check file=routes/music/settings.tsx
// src/routes/music/settings.tsx
import { href } from "lumen";
import { navigate } from "lumen/router";

export default function Settings() {
  return <button onClick={() => navigate(href("/music"), { replace: true })}>Done</button>;
}
```

See also: [Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md),
[`lumen`: app layer](app.md).
