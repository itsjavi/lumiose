# `lumiose/router`

> The client router for `spa` routes: links, navigation, navigation hooks, reactive route state, persistent layouts, transitions and scroll restoration.

`lumiose/router` works inside `spa` routes (`export const mode = "spa"`, or `lumiose({ mode: "spa" })`
for the whole project); `<Link>`, `beforeNavigate()` and `afterNavigate()` work on MPA pages too (see [Link](#link) and
[Navigation hooks](#navigation-hooks)). Pages and layouts of an SPA import it like any module; on the server
(`ssr` pages, rendered per request or prerendered at build time) the same names read the request: `params()`, `route()`, `url()` and `searchParams()` return the
request's values, `<Link>` renders its `<a>`, `isNavigating()` is `false`, `beforeNavigate()` and
`afterNavigate()` register nothing, and `navigate()` and `searchParams.set()` throw (call them from
event handlers and effects). Concepts:
[Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md).

## Components

### Link

```ts
function Link(props: LinkProps): JSX.Element;

type LinkProps = Omit<JSX.IntrinsicElements["a"], "href" | "children"> & {
  href: string;
  /** Default "hover" in spa pages; on MPA pages, lumiose({ prefetch }). */
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
  `lumiose({ prefetch })` treat it ([Routing](../concepts/routing.md)). The `<a>` gets
  `data-l-prefetch="<level>"`; the rules skip `none` links, prefetch `viewport` links with `eager`
  and `hover` links with `moderate` eagerness, and give unmarked links (`<Link>` without
  `prefetch`, plain `<a>`) the project default. With `lumiose({ prefetch: "none" })`, only pages that
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

### isNavigating

```ts
function isNavigating(): boolean;
```

Whether a navigation is in flight: from the click until the new page is on screen. Reactive, and
counted by [`isBusy()`](reactivity.md) (decision-20).

## Navigation hooks

SvelteKit's `beforeNavigate` and `afterNavigate` (decision-50). Call them during component setup,
like `onMount`: the hook runs while the component is mounted and is removed when it is disposed.

### beforeNavigate

```ts
function beforeNavigate(fn: (navigation: BeforeNavigate) => void): void;

interface BeforeNavigate {
  type: "link" | "navigate" | "popstate" | "leave";
  from: NavigationTarget | null;
  /** `null` when the next document is outside the app (another origin, or `"leave"`). */
  to: NavigationTarget | null;
  /** The document unloads: the navigation is not a client-side one. */
  willUnload: boolean;
  cancel(): void;
}

interface NavigationTarget {
  url: URL;
  /** The matched route pattern (`/songs/[id]`); undefined when none matched. */
  route: Routes | undefined;
  params: Record<string, string>;
}
```

Runs before each navigation away from the current location, before the router loads anything.
`type` is what started it:

| `type`       | Navigation                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------- |
| `"link"`     | A link click (or a `GET` form) to a URL of the SPA, or out of it (`willUnload`).             |
| `"navigate"` | `navigate()` or `searchParams.set()` (a thrown `redirect()` runs no hook: it continues one). |
| `"popstate"` | Back/forward.                                                                                |
| `"leave"`    | The document unloads otherwise: closing the tab, typing a URL, a reload, a `POST` form.      |

`navigation.cancel()` stops it, and the URL stays the current one:

- Inside the SPA, the navigation does not start. Back/forward that the browser does not let the
  page cancel happens, then the router returns to the entry it left (without the Navigation API,
  each history entry the router creates stores its index in `history.state` for that).
- For a navigation that unloads the document (`willUnload`: `"leave"`, or a link or `navigate()`
  to a page outside the SPA), the browser shows its own "Leave site?" prompt (`beforeunload`): a
  custom dialog cannot run there. The browser shows it only after the user interacted with the
  page.

A change of the URL's `#hash` alone is not a navigation for the hooks.

### afterNavigate

```ts
function afterNavigate(fn: (navigation: AfterNavigate) => void): void;

interface AfterNavigate {
  type: "enter" | "link" | "navigate" | "popstate";
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  willUnload: boolean;
}
```

Runs once per completed client navigation, after the new page is on screen (after a view
transition's DOM update, not its animation), its scroll position restored and focus reset. A
navigation that a newer one supersedes or a hook cancels never completes. It also runs once when
the component mounts, with `type: "enter"` and `from: null`, so the first page view counts too; a
component that a navigation created gets that navigation's call instead.

### On MPA pages

Islands of `static` and `server` pages have no router, and using the hooks loads none: there,
`beforeNavigate` sees only `"leave"` (a `beforeunload` listener, added while a hook is registered)
and `afterNavigate` fires once with `"enter"`, with `route` undefined.

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
matching `url().pathname`; typegen makes an unknown pattern a type error. `undefined` on a `not-found`
page for an unknown URL (a matched route that throws `notFound()` keeps its pattern).

### url

```ts
function url(): URL;
```

The current URL, reactive. Do not mutate it.

### locale

```ts
function locale(): Locale;
```

With `lumiose({ i18n })`, the locale of the current URL (its prefix, else the default locale),
reactive inside SPA routes; in islands of other routes, the page's. `undefined` without
`lumiose({ i18n })`, typed `string | undefined`. A navigation to another locale renders every level again, and `<html lang>`
follows. See [Internationalization](../concepts/i18n.md).

### searchParams

```ts
interface SearchParams {
  (): URLSearchParams;
  set(
    next: SearchParamsInit | ((current: URLSearchParams) => SearchParamsInit),
    options?: NavigateOptions,
  ): Promise<void>;
}
const searchParams: SearchParams;

type SearchParamsInit =
  | URLSearchParams
  | string
  | Record<string, string | number | boolean | readonly string[] | null | undefined>;
```

`searchParams()` is the current URL's query, reactive (a new object per change). `searchParams.set()`
navigates to the current path with a new query, keeping the scroll position; `null` and
`undefined` values are left out. It adds a history entry unless `{ replace: true }`.

While a page is still loading during a navigation, `params()`, `route()`, `url()` and `searchParams()` called in it
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
  values of the params in its path, such as `songs/[id]/page.stsx` for another song) is replaced. A
  navigation that only changes the query keeps every level and updates `searchParams()`.
- **Transitions.** The new page is created off-screen. The old page stays until the new page's
  async content (async components and resources outside a `<Suspense>` of the new page) is ready;
  then the URL signals change and the pages swap in one step. A `<Suspense>` inside the new page
  shows its fallback instead.
- **Scroll and focus.** After a navigation the page scrolls to the top (or to the URL's `#hash`)
  and focus moves to the document (or the first `[autofocus]` element); back/forward restore the
  scroll position. `searchParams.set()` keeps both.
- **Errors.** `notFound()` and unknown URLs render the nearest `not-found` page of the SPA; other
  errors its `error` page (`{ status, error }` props), with the layouts kept. With
  `src/instrumentation.client.ts`, its `onError` receives the other errors (`phase: "navigate"`),
  and its `navigate` wrappers observe each navigation
  ([Islands](../concepts/islands.md#concept)). A thrown `redirect()`
  navigates. Without such a page, a minimal built-in error page replaces the SPA. A `not-found` page that
  the server rendered at the URL of a prerendered page with params (`404.html` on a static host)
  renders that page instead: see
  [Prerendered SPA routes](../concepts/rendering-modes.md#prerendered-spa-routes).
- **`invalidate()`** from `lumiose` re-runs the SPA's async components and resources (they keep
  their UI meanwhile) and resolves once they settled. `submit()` redirects navigate through the
  router, and a successful `submit()` invalidates (on MPA pages it does not: that would reload).
- **Stale modules.** A page module that fails to load (an old chunk after a deploy) loads the URL
  as a document instead (its hooks already ran: no `"leave"`).

## Example

```tsx check file=routes/music/layout.tsx
// src/routes/music/layout.tsx: an SPA under /music, with a persistent layout
import { href, type LayoutProps } from "lumiose";
import { Link, isNavigating } from "lumiose/router";

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
      {isNavigating() && <progress />}
      <main>{props.children}</main>
    </div>
  );
}
```

```tsx check file=routes/music/page.tsx
// src/routes/music/page.tsx: a filter kept in the query
import { searchParams } from "lumiose/router";

export default function Songs() {
  const query = () => searchParams().get("q") ?? "";
  return (
    <input
      type="search"
      value={query()}
      onInput={(event) =>
        searchParams.set({ q: event.currentTarget.value || null }, { replace: true })
      }
    />
  );
}
```

```tsx check file=routes/music/settings/page.tsx
// src/routes/music/settings/page.tsx: asks before leaving unsaved changes
import { href, signal } from "lumiose";
import { afterNavigate, beforeNavigate, navigate } from "lumiose/router";

export default function Settings() {
  const dirty = signal(false);

  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.willUnload) navigation.cancel(); // the browser asks
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });

  afterNavigate((navigation) => {
    if (navigation.to !== null) console.info("page view", navigation.to.url.pathname);
  });

  return (
    <form>
      <input name="volume" onInput={() => dirty.set(true)} />
      <button
        type="button"
        onClick={() => {
          dirty.set(false);
          void navigate(href("/music"), { replace: true });
        }}
      >
        Done
      </button>
    </form>
  );
}
```

See also: [Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md),
[`lumiose`: app layer](app.md).
