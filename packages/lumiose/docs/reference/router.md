# `lumiose/router`

> The client router for `spa` routes: links, navigation, navigation hooks, reactive route state, persistent layouts, transitions, scroll restoration, focus reset and page announcements.

`lumiose/router` works inside `spa` routes (`export const mode = "spa"`, or `lumiose({ mode: "spa" })`
for the whole project); `<Link>`, `beforeNavigate()`, `afterNavigate()` and `searchParams` work on MPA pages too (see [Link](#link),
[Navigation hooks](#navigation-hooks) and [searchParams](#searchparams)). Pages and layouts of an SPA import it like any module; on the server
(`ssr` pages, rendered per request or prerendered at build time) the same names read the request: `params()`, `route()`, `url()` and `searchParams()` return the
request's values, `<Link>` renders its `<a>`, `isNavigating()` is `false`, `beforeNavigate()` and
`afterNavigate()` register nothing, and `navigate()` and `searchParams.set()` throw (call them from
event handlers and effects). Concepts:
[Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md).

## Components

### Link

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

```ts
function Link(props: LinkProps): JSX.Element;

type LinkProps = Omit<JSX.IntrinsicElements["a"], "href" | "children"> & {
  href: string;
  prefetch?: Prefetch;
  children?: JSX.Element;
};

type Prefetch = "hover" | "viewport" | "none";
```

```tsx check
import { href } from "lumiose";
import { Link } from "lumiose/router";

export function MusicNav() {
  return (
    <nav>
      <Link href={href("/music")}>Songs</Link>
      <Link href={href("/music/settings")} prefetch="none">
        Settings
      </Link>
    </nav>
  );
}
```

| Name       | Type                              | Default   | Description                                                                                                            |
| ---------- | --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `href`     | `string`                          | —         | The URL; build it with `href()` to type-check the route and its params.                                                |
| `prefetch` | `"hover" \| "viewport" \| "none"` | `"hover"` | When to load the target route's modules. The default is `"hover"` in spa pages; on MPA pages, `lumiose({ prefetch })`. |
| `children` | `JSX.Element`                     | —         | The link's content.                                                                                                    |
| `...`      | `JSX.IntrinsicElements["a"]`      | —         | Every other attribute and event of `<a>`.                                                                              |

## Navigation

### navigate

Navigates on the client when `href` belongs to the current SPA, else loads the document. Resolves
once the new page is on screen (its async content ready), or when another navigation supersedes
it. Browser only. Only `http:` and `https:` URLs (relative ones included) navigate: any other
scheme, such as `javascript:`, throws a `TypeError`. An `href` that only names a fragment of the
current page (`navigate("#comments")`) is the browser's, as a link to it is: it scrolls there and
keeps focus, no hook runs, and `url()` follows.

```ts
function navigate(href: string | URL, options?: NavigateOptions): Promise<void>;

interface NavigateOptions {
  replace?: boolean;
}
```

```tsx check
import { navigate } from "lumiose/router";

export function DoneButton() {
  const done = () => void navigate("/music", { replace: true });
  return <button onClick={done}>Done</button>;
}
```

| Name              | Type            | Default | Description                                                      |
| ----------------- | --------------- | ------- | ---------------------------------------------------------------- |
| `href`            | `string \| URL` | —       | Where to go: an `http:` or `https:` URL, relative ones included. |
| `options.replace` | `boolean`       | `false` | Replace the current history entry instead of adding one.         |

### isNavigating

Whether a navigation is in flight: from the click until the new page is on screen. Reactive, and
counted by [`isBusy()`](reactivity.md) (decision-20).

```ts
function isNavigating(): boolean;
```

```tsx check
import { isNavigating } from "lumiose/router";

export function NavigationProgress() {
  return <progress hidden={!isNavigating()} />;
}
```

## Navigation hooks

SvelteKit's `beforeNavigate` and `afterNavigate` (decision-50). Call them during component setup,
like `onMount`: the hook runs while the component is mounted and is removed when it is disposed.

### beforeNavigate

Runs before each navigation away from the current location, before the router loads anything.
`type` is what started it:

| `type`       | Navigation                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"link"`     | A link click (or a `GET` form) to a URL of the SPA, or out of it (`willUnload`). On MPA pages, a click on a same-origin link (`willUnload`).                                    |
| `"navigate"` | `navigate()` or `searchParams.set()` (a thrown `redirect()` runs no hook: it continues one).                                                                                    |
| `"popstate"` | Back/forward.                                                                                                                                                                   |
| `"leave"`    | The document unloads otherwise: closing the tab, typing a URL, a reload, a `POST` form. On MPA pages also `navigate()`, `searchParams.set()`, forms and links to other origins. |

`navigation.cancel()` stops it, and the URL stays the current one:

- A `"link"` or `"navigate"` navigation does not happen. Inside the SPA the router does not start
  it; one that would load another document (a page outside the SPA, or a link on an MPA page) is
  stopped too (the click is prevented), so the page stays as it is, with no prompt. The hook can
  ask with `confirm()`, or cancel, show its own dialog and follow `navigation.to.url` once the user
  agrees.
- Back/forward that the browser does not let the page cancel happens, then the router returns to
  the entry it left (without the Navigation API, each history entry the router creates stores its
  index in `history.state` for that).
- `"leave"` cannot be stopped by the page: the browser shows its own "Leave site?" prompt
  (`beforeunload`), where a custom dialog cannot run. The browser shows it only after the user
  interacted with the page.

So a hook that guards unsaved changes cancels `"leave"` and asks the user itself for the rest (see
[Unsaved changes](#unsaved-changes)). A change of the URL's `#hash` alone is not a navigation for
the hooks.

```ts
function beforeNavigate(fn: (navigation: BeforeNavigate) => void): void;

interface BeforeNavigate {
  type: "link" | "navigate" | "popstate" | "leave";
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  willUnload: boolean;
  cancel(): void;
}

interface NavigationTarget {
  url: URL;
  route: Routes | undefined;
  params: Record<string, string>;
}
```

```tsx check
import { signal } from "lumiose";
import { beforeNavigate } from "lumiose/router";

export function Draft() {
  const dirty = signal(false);
  beforeNavigate((navigation) => {
    if (dirty()) navigation.cancel();
  });
  return <textarea onInput={() => dirty.set(true)} />;
}
```

| Name | Type                                   | Default | Description                                               |
| ---- | -------------------------------------- | ------- | --------------------------------------------------------- |
| `fn` | `(navigation: BeforeNavigate) => void` | —       | The hook. It runs while the calling component is mounted. |

| Member       | Type                                            | Description                                                                                     |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `type`       | `"link" \| "navigate" \| "popstate" \| "leave"` | What started the navigation.                                                                    |
| `from`       | `NavigationTarget \| null`                      | Where it starts.                                                                                |
| `to`         | `NavigationTarget \| null`                      | Where it goes; `null` when the next document is outside the app (another origin, or `"leave"`). |
| `willUnload` | `boolean`                                       | The document unloads: the navigation is not a client-side one.                                  |
| `cancel()`   | `void`                                          | Stops the navigation.                                                                           |
| `url`        | `URL`                                           | The location's URL.                                                                             |
| `route`      | `Routes \| undefined`                           | The matched route pattern (`/songs/[id]`); undefined when none matched.                         |
| `params`     | `Record<string, string>`                        | The route's params.                                                                             |

### afterNavigate

Runs once per completed client navigation, after the new page is on screen (after a view
transition's DOM update, not its animation), its scroll position restored, focus reset and the page
announced to screen readers. A
navigation that a newer one supersedes or a hook cancels never completes. It also runs once when
the component mounts, with `type: "enter"` and `from: null`, so the first page view counts too; a
component that a navigation created gets that navigation's call instead.

```ts
function afterNavigate(fn: (navigation: AfterNavigate) => void): void;

interface AfterNavigate {
  type: "enter" | "link" | "navigate" | "popstate";
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  willUnload: boolean;
}
```

```tsx check
import { afterNavigate } from "lumiose/router";

export function PageViews() {
  afterNavigate((navigation) => {
    const path = navigation.to?.url.pathname;
    console.info("page view", navigation.type, path);
  });
  return <></>;
}
```

| Name | Type                                  | Default | Description                                               |
| ---- | ------------------------------------- | ------- | --------------------------------------------------------- |
| `fn` | `(navigation: AfterNavigate) => void` | —       | The hook. It runs while the calling component is mounted. |

| Member       | Type                                            | Description                                                           |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| `type`       | `"enter" \| "link" \| "navigate" \| "popstate"` | What started the navigation; `"enter"` is the mount of the component. |
| `from`       | `NavigationTarget \| null`                      | Where it started; `null` for `"enter"`.                               |
| `to`         | `NavigationTarget \| null`                      | Where it went.                                                        |
| `willUnload` | `boolean`                                       | Whether the document unloads.                                         |

### On MPA pages

Islands of `static` and `server` pages have no router, and using the hooks loads none of it.
There, `beforeNavigate` sees a click on a same-origin link as `"link"` (`willUnload`; `route`
undefined, and `to` is `null` for a URL outside Vite's `base`) and everything else that unloads the
document as `"leave"`. `afterNavigate` fires once with `"enter"`, with `route` undefined.

- **Which clicks.** The hooks hear every link of the page, inside islands or not, through a `click`
  listener at `window` and a `beforeunload` listener, both added while a hook is registered.
  Running at `window`, after the page's own handlers, they skip a click that a handler prevented.
- **Left to the browser.** These clicks are not reported: a click with a modifier key or another
  button (a new tab or window), on a link with `target` (other than `_self`) or `download`, to
  another origin (`mailto:` and `tel:` included), or to a fragment of the current page.
- **Cancelling** a `"link"` prevents the click, so the page stays with no prompt. An island can
  show its own dialog, then call `location.assign(navigation.to.url)` once the user agrees
  (clearing its unsaved state first, or the hook cancels again, as `"leave"`).

### Unsaved changes

While the page holds unsaved work, the hook cancels every navigation, then asks with the page's own
dialog where the page can. The same hook works in an SPA and in an island of a `static` or
`server` page:

- **`"link"` and `"navigate"`**: the page stays, with no prompt. Keep `navigation.to.url` and open
  your dialog. `to` is `null` for a URL outside the app (another origin in an SPA, or outside
  Vite's `base`), which the dialog could not follow: ask with `confirm()` there.
- **`"leave"`** (closing the tab, a reload, a typed URL, a `POST` form): the browser shows its own
  prompt, and no page code runs.
- **`"popstate"`** (back/forward, in an SPA): the router returns to the page.

The dialog's **Leave** button sets a flag that the hook checks first, then follows the URL:
`location.assign(url)` on an MPA page, where islands that use the hooks load no router, and
`navigate(url)` in an SPA. Without the flag the hook cancels again (on an MPA page as `"leave"`, so
the browser asks).

Any dialog works in place of the `<p role="alert">`, such as @lumiose/ui's
[alert dialog](https://lumiose.dev/ui/dialog/) bound to `pending() !== null`. When the
unsaved work sits in the rows of a list (an editable table), key the rows by the record's id
([Lists and keys](../concepts/jsx.md#lists-and-keys)): a row keyed by its index keeps its typed
value after a sort or a filter, next to another record.

```tsx check
// An island of a server page that edits a note; in an SPA, the same component as a page
import { signal } from "lumiose";
import { beforeNavigate } from "lumiose/router";

export function NoteEditor() {
  const dirty = signal(false);
  /** Where a cancelled link or navigate() was going; the dialog shows while it is set. */
  const pending = signal<URL | null>(null);
  let leaving = false;

  beforeNavigate((navigation) => {
    if (leaving || !dirty()) return;
    if (navigation.type === "leave") {
      navigation.cancel(); // the browser asks
    } else if (navigation.to === null) {
      // Outside the app: the dialog could not follow it.
      if (!confirm("Discard your changes?")) navigation.cancel();
    } else {
      navigation.cancel(); // the page stays
      if (navigation.type !== "popstate") pending.set(navigation.to.url);
    }
  });

  function leave(url: URL) {
    leaving = true; // the hook lets this navigation through
    location.assign(url); // in an SPA: void navigate(url)
  }

  return (
    // Saving posts the form, which unloads the page too ("leave"): it is not unsaved work then.
    <form method="post" onSubmit={() => dirty.set(false)}>
      <textarea name="text" onInput={() => dirty.set(true)} />
      <button>Save</button>
      {pending() !== null && (
        <p role="alert">
          Your changes are not saved.{" "}
          <button type="button" onClick={() => pending.set(null)}>
            Stay
          </button>{" "}
          <button type="button" onClick={() => leave(pending()!)}>
            Leave
          </button>
        </p>
      )}
    </form>
  );
}
```

## Route state

### params

The current route's params, reactive: `params<"/songs/[id]">().id`. Pages also receive them as
`props.params`.

```ts
function params<P extends Routes = never>(): [P] extends [never]
  ? Record<string, string>
  : RouteParams<P>;
```

```tsx check file=routes/music/[id]/page.tsx
// src/routes/music/[id]/page.tsx
import { params } from "lumiose/router";

export default function Song() {
  return <h1>Song {params<"/music/[id]">().id}</h1>;
}
```

### route

The matched route pattern, reactive: `route() === "/songs/[id]"`. Compare patterns instead of
matching `url().pathname`; typegen makes an unknown pattern a type error. `undefined` on a `not-found`
page for an unknown URL (a matched route that throws `notFound()` keeps its pattern).

```ts
function route(): Routes | undefined;
```

```tsx check
import { route } from "lumiose/router";

export function NowPlaying() {
  return <p hidden={route() !== "/music/[id]"}>Now playing</p>;
}
```

### url

The current URL, reactive. Do not mutate it.

```ts
function url(): URL;
```

```tsx check
import { url } from "lumiose/router";

export function CurrentPath() {
  return <code>{url().pathname}</code>;
}
```

### locale

With `lumiose({ i18n })`, the locale of the current URL (its prefix, else the default locale),
reactive inside SPA routes; in islands of other routes, the page's. `undefined` without
`lumiose({ i18n })`, typed `string | undefined`. A navigation to another locale renders every level again, and `<html lang>`
follows. See [Internationalization](../concepts/i18n.md).

```ts
function locale(): Locale;
```

```tsx check
import { locale } from "lumiose/router";

export function Greeting() {
  return <h1>{locale() === "es" ? "Hola" : "Hello"}</h1>;
}
```

### searchParams

The current URL's query, with `set()` to change it.

`searchParams()` is the current URL's query, reactive (a new object per change). `searchParams.set()`
navigates to the current path with a new query, keeping the scroll position; `null` and
`undefined` values are left out. It adds a history entry unless `{ replace: true }`. Inside an
SPA, `{ shallow: true }` changes nothing: a query change already keeps every layout and page
mounted.

`searchParams.set()` escapes only what the query needs, so shared URLs stay readable:
`searchParams.set({ sorts: "price:desc,name:asc" })` writes `?sorts=price:desc,name:asc`. Keys and
values are written as `URLSearchParams` writes them (letters, digits and `* - . _` as they are,
spaces as `+`, everything else percent-encoded as UTF-8: `%`, `&`, `=`, `+`, `#`, quotes,
non-ASCII…), except that `! $ ( ) , / : ? @ ~` stay as they are too: a query may hold them, and
its parser reads them as themselves. `;` stays escaped, because some servers and caches still split
a query on it. `searchParams()` in the browser and on the server, and
`ctx.url.searchParams` in middleware and endpoints, read every value back unchanged, `&`, `=`, `+`
and `#` included. A string or a `URLSearchParams` passed to `set()` is parsed first, so
`set("sorts=price%3Adesc")` writes `?sorts=price:desc`.

In islands of MPA pages (`static` and `server` routes), where no router runs, `searchParams()` is
the document's query, shared by every island, and `searchParams.set()` loads the page with the new
query, like `navigate()` there. With `{ shallow: true }` it loads nothing: it writes the URL with
`history.pushState()` (`replaceState()` with `{ replace: true }`, or when the URL does not change)
and updates `searchParams()`, keeping the path, the hash, the scroll position and focus. Back/forward
between those entries update `searchParams()`. The server-rendered HTML then stays as it is, and the
navigation hooks do not run. During SSR, islands of `server` pages read the request's query; at
build time a `static` page has none (`LUM5001`). See [Islands](../concepts/islands.md#concept).

While a page is still loading during a navigation, `params()`, `route()`, `url()` and `searchParams()` called in it
(and its props) already describe the page it is loading; everything else keeps the shown URL until
the new page is on screen.

```ts
interface SearchParams {
  (): URLSearchParams;
  set(
    next: SearchParamsInit | ((current: URLSearchParams) => SearchParamsInit),
    options?: SearchParamsOptions,
  ): Promise<void>;
}
const searchParams: SearchParams;

type SearchParamsInit =
  | URLSearchParams
  | string
  | Record<string, string | number | boolean | readonly string[] | null | undefined>;

interface SearchParamsOptions extends NavigateOptions {
  shallow?: boolean;
}
```

```tsx check
import { searchParams } from "lumiose/router";

export function NextPage() {
  const page = () => Number(searchParams().get("page") ?? 1);
  const next = () => void searchParams.set({ page: page() + 1 });
  return <button onClick={next}>Page {page() + 1}</button>;
}
```

| Name              | Type                                                                   | Default | Description                                                                                                              |
| ----------------- | ---------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `next`            | `SearchParamsInit \| ((current: URLSearchParams) => SearchParamsInit)` | —       | The new query, or a function of the current one. `null` and `undefined` values are left out.                             |
| `options.replace` | `boolean`                                                              | `false` | Replace the current history entry instead of adding one.                                                                 |
| `options.shallow` | `boolean`                                                              | `false` | In islands of MPA pages, update the URL and `searchParams()` without loading the page. Inside an SPA it changes nothing. |

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
  and focus moves to the document (or the first focusable `[autofocus]` element), so the next Tab
  starts from the top of the page, as after a document load; back/forward restore the scroll
  position. Focus the new page moved while it loaded stays. `searchParams.set()` keeps both, and
  back/forward between entries that differ only in `#hash` keeps focus. A link or `navigate()` to
  a `#hash` of the current page is left to the browser, which scrolls to it and keeps focus.
  Browsers without the Navigation API get the same behaviour from the History API fallback.
- **Announcements.** Screen readers announce a document load, not a client navigation, so the
  router reads each new page aloud: once it is on screen, scrolled and focused, a visually hidden
  live region (`aria-live="assertive"`, `aria-atomic="true"`, appended to `<body>` with a
  `data-l-announcer` attribute) gets its `document.title` (set by `<Title>`), else the text of its
  first `<h1>`, else its path. The first page is not announced (the screen reader reads the
  document), nor is a navigation that keeps the path (a query change) unless the title changed.
  Give each page a distinct `<Title>` so the announcement says where the user is. The region is
  created once the SPA has hydrated, outside it, and removed with it.
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
    if (navigation.type === "leave") navigation.cancel(); // the browser asks
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

## The SPA router in short

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
  [`viewTransition()`](components.md#viewtransition) (a query change on the same page
  does not), and `<ViewTransition>` names the elements that morph.
- Scroll restoration, focus reset, an announcement of each new page for screen readers (its
  `<Title>`, else its first `<h1>`), `not-found` for unknown URLs and `notFound()`, `error` for
  errors. See [Behaviour](#behaviour).
- Navigation hooks: `beforeNavigate(fn)` runs before each navigation and may `cancel()` it (to
  confirm leaving unsaved changes; the page stays, and for `"leave"`, such as closing the tab, the
  browser asks), and `afterNavigate(fn)` runs after each completed one and once on mount (page
  views, focus). They belong to the component that calls them during setup, and work in islands of
  MPA pages too (link clicks, `"leave"` and `"enter"`). See
  [Navigation hooks](#navigation-hooks), and
  [Unsaved changes](#unsaved-changes) for a guard with your own dialog.

```tsx
import { signal } from "lumiose";
import { afterNavigate, beforeNavigate } from "lumiose/router";

export function Editor() {
  const dirty = signal(false);
  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.type === "leave") navigation.cancel(); // the browser asks
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });
  afterNavigate((navigation) => console.info("page view", navigation.to?.url.pathname));
  return <textarea onInput={() => dirty.set(true)} />;
}
```

## Locale routing in detail

```ts
// vite.config.ts
lumiose({
  i18n: {
    locales: ["en", "es", "fr"],
    defaultLocale: "en", // served unprefixed (/about); the others are prefixed (/es/about)
    missing: "404", // or "redirect" to the default locale's page; site-wide
    detect: false, // or { cookie: "locale", acceptLanguage: true }: only on entry
  },
  site: "https://example.com", // the origin of prerendered pages' absolute URLs
});
```

**URLs.** Locales are URL path segments (`en`, `pt-BR`). The router reads the prefix and matches
the rest against the routes, so `src/routes/about/page.stsx` serves `/about` (the default locale)
and `/es/about`, `/fr/about` for the locales it declares. The default locale has no prefix:
`/en/about` is not a URL. There is no `[locale]` folder (a route param named `locale` is
[LUM5007](../errors/LUM5007.md)).

**Declaring locales.** A page exists in the locales it declares; without a declaration, only in the
default locale, so a site can translate some pages and never serves an untranslated duplicate:

- `export const locales = ["en", "es"]`: these locales; `"all"`: every configured locale.
- `export async function locales({ params })`: content-driven pages decide per params (a blog post
  translated into some languages). It runs per request, and once per path while prerendering.
- A layout's `locales` applies to every page below it; a page's own export wins. Endpoints
  (`route.ts`) declare locales the same way.
- A locale the config does not list is a `LUM5002` error.

**Missing translations.** A page requested in a locale it does not declare is a 404 (the
`not-found` page, in that locale), or with `missing: "redirect"` a redirect to the default
locale's URL when the page exists there (302, or 307 for other methods than GET).

**The request's locale.** `locale()` from `lumiose` reads it on the server (the URL prefix, else
the default locale), `ctx.locale` in middleware, actions and endpoints, and `locale()` from
`lumiose/router` is reactive in SPA routes (and the page's locale in islands). `Locale` is the
union of the configured locales, from typegen. Without `lumiose({ i18n })` they are `undefined`,
and typed `string | undefined`. The document's `<html lang>` follows: the default
document writes it, a custom `src/document.stsx` gets the `lang` of its `<html>` set, and SPA
navigations update it.

**Links.** `href()` builds URLs in the current locale: `href("/about")` is `/es/about` on a Spanish
page. The `locale` key switches it: `href("/blog/[slug]", { slug, locale: "fr" })`. `href()` does
not check that the page declares the locale; `alternates()` lists the URLs that exist.

**Alternates and search engines.** `alternates()` returns the current page in every locale it
declares, `[{ locale, href }]`, for language switchers. `alternates(pattern, params?)` does the same
for another route, to link a page translated into fewer locales than the current one
(`alternates("/about")`); its params are typed like `href()`'s. A route whose locales come from a
`locales({ params })` function throws there: rendering cannot wait for it, so build those links
from the translations your content lists. A page that declares more than one locale also gets, in
its `<head>`:

- `<link rel="alternate" hreflang="…">` for each declared locale, and nothing for the others (no
  `x-default`), so search engines never see a URL that does not exist;
- `<link rel="canonical">` to the page's own URL in its locale (each locale is canonical for
  itself). A canonical the page or a layout renders with `<Head>` replaces it.

In `spa` routes the client router keeps them current: after each navigation it writes the new
page's links, or removes them for a page that declares a single locale, and a canonical that the
new page renders with `<Head>` still replaces Lumiose's. Hreflang links of the configured locales
belong to Lumiose there: do not write them with `<Head>`.

These URLs are absolute: the request's origin for pages rendered per request, and
`lumiose({ site })` for prerendered pages, which have no request; after an SPA navigation, the
page's origin (`location.origin`). Without `site`, prerendered pages
get root-relative URLs, which search engines ignore, and `lumiose build` warns. The origin is
joined with the `href()` path, which already has Vite's `base`: a site with a path
(`"https://example.com/docs"`) sets the base when the config has none, and must match it
otherwise.

**Prerendering.** A `static` page (or an `spa` page with `prerender`) renders once per locale it
declares, for each path of its `staticPaths()`: `about/index.html`, `es/about/index.html`, … A
`locales()` function is asked for each path's params.

**Detection** (`detect`, off by default) runs only on entry, never on every request:

- On a first visit (no `cookie`), the visitor's `Accept-Language` locale (with
  `acceptLanguage: true`): a page that declares it redirects there (`/about` → `/es/about`), and
  the cookie records the locale either way.
- On `/`, the cookie's locale: a visitor who chose Spanish lands on `/es`.
- Deep links never redirect once the cookie exists, prefixed URLs never do, and without a `cookie`
  only `/` detects (first visits cannot be told apart).
- These responses send `Vary: Cookie, Accept-Language` and `Cache-Control: private, no-store`.
- A prefetch never keeps a decision, since a language switcher may change the cookie before the
  navigation: the speculation rules leave out `/`, and a detecting request that carries
  `Sec-Purpose: prefetch` (another prefetcher, a prerender) gets a `503` the browser discards, so the
  navigation itself detects.

A language switcher must update the cookie (`cookies().set("locale", "es")` in an action, or
`document.cookie` in an island); the cookie is not `HttpOnly`, so client code can. Detection runs in
the request handler: a prerendered `/` served as a file never redirects, so render the entry page
per request (`export const mode = "server"`) to detect there.

**SPA routes.** The client router matches prefixed URLs too, for the locales a page declares in a
list; a page with a `locales()` function, or a locale it does not declare, loads as a document and
the server answers. That is a trade-off: the function runs on the server (it usually reads content
or a database), and only the server knows whether the URL exists, so it answers with the page, a
404 or a redirect, and its `hreflang` links. A navigation to another locale renders every level
again.

**Messages.** Lumiose does not translate or format messages: use a library such as Paraglide JS
(compile-time messages, only what a page uses) or i18next, keyed by `locale()`. The
[i18n guide](../guides/i18n.md) shows both end to end.

> **Status:** locale routing, declarations, `missing`, detection, `locale()`, `alternates()`,
> locale-aware `href()`, `<html lang>`, `hreflang` and canonical links, and per-locale
> prerendering are available. Locales per domain (`example.es`) come after 1.0.

**Mistakes with locale routing.**

- **A `[locale]` folder.** The router handles the prefix: `src/routes/about/page.stsx` serves
  every locale it declares, and a param named `locale` is `LUM5007`.
- **Expecting every page in every locale.** Without `export const locales` (on the page or a
  layout), a page exists only in the default locale; `/es/about` is then a 404.
- **`href()` to a page that is not translated.** On a French page `href("/about")` is
  `/fr/about`; pick a locale from `alternates("/about")`.
- **Hard-coded prefixes.** `"/es" + path` breaks for the default locale and below a `base`; use
  `href(pattern, { locale })`.
- **A switcher that does not update the detection cookie.** The visitor's next visit to `/` sends
  them back to the locale in the cookie.
- **Detection on a prerendered `/`.** A static file never redirects; render the entry page per
  request.
- **No `site` for a prerendered site.** `hreflang` and canonical URLs stay root-relative, which
  search engines ignore; `lumiose build` warns.
