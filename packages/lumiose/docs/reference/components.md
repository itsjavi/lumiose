# `lumiose`: components

> Signatures of the built-in components, from Suspense and error boundaries to portals, head tags and view transitions.

All are exported by `lumiose` in the browser and on the server. Concepts:
[Components](../concepts/components.md), [Async components](../concepts/async.md),
[Head and document](../concepts/head.md).

## Component functions

A component is a function that returns JSX (`JSX.Element`), named in PascalCase. Its body runs once
per instance. Concept: [Components](../concepts/components.md).

### File types

| Extension | Contents                                                              |
| --------- | --------------------------------------------------------------------- |
| `.stsx`   | TSX plus `<style>` blocks. Use it for components with styles.         |
| `.tsx`    | Plain TSX. A `<style>` block here is `LUM1006` ("rename to `.stsx`"). |
| `.ts`     | Everything else: logic, tokens, endpoints and server code.            |

A file may export many components.

### Props

Props are the single parameter, a plain interface; `children?: JSX.Element` for content.

The compiler keeps props reactive, even when you destructure them: `({ title, count = 0 })` is
rewritten to reads of `props.title` and `props.count`, so a parent passing a signal value keeps
the child up to date. `...rest` stays reactive too. Destructuring the props object at the top of
the body, `const { children, ...rest } = props`, is rewritten the same way, as long as you don't
reassign the bindings; destructuring a nested prop (`const { name } = props.user`) reads it once.

On the server, where nothing is reactive, a prop expression is evaluated **lazily and at most once
per component instance** (decision-28): the first read runs it, later reads reuse the value, and a
prop the component never reads never runs. `<Filters labels={listLabels()} />` queries the labels
once per render however often `Filters` reads `props.labels`. In the browser props stay live: each
read re-evaluates the expression, so keep prop expressions free of side effects.

### children

`children` is lazy: it is evaluated where you insert it. Insert it once; to render something
several times, take a render function as a prop. Named slots are ordinary props that hold JSX.

Spreading props onto an element without content of its own renders their `children`, as in React:
`<button {...props} />` renders what the caller wrapped in the component. When the caller passes no
`children`, the element's content is left alone (a script may fill it).

```tsx check
function Button(props: JSX.HTMLProps<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

function Trigger(props: JSX.HTMLProps<HTMLButtonElement> & { label: string }) {
  const { children, label, ...rest } = props;
  return (
    <button type="button" aria-label={label} {...rest}>
      {children}
    </button>
  );
}

export function Toolbar() {
  return (
    <>
      <Button class="primary">Save</Button>
      <Trigger label="Close">×</Trigger>
    </>
  );
}
```

## Suspense

```ts
function Suspense(props: SuspenseProps): JSX.Element;
interface SuspenseProps {
  /** Shown while new content below is pending. */
  fallback?: JSX.Element;
  children?: JSX.Element;
}
```

Shows `fallback` while **new** async content below it is pending: the first load, and async
components or resources that a branch mounts later. Re-runs of revealed content keep their stale UI
(`isPending()` tells them apart). Hidden content stays alive. A shown fallback counts for `isBusy()`.
On the server, a boundary marks content that streams after the shell; with prerendering it is
resolved inline.

## ErrorBoundary

```ts
function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element;
interface ErrorBoundaryProps {
  /** Rendered instead of the children after an error. */
  fallback?: JSX.Element | ((error: unknown, reset: () => void) => JSX.Element);
  children?: JSX.Element;
}
```

Renders `fallback` when its children throw while rendering, an effect below throws, or an async
component below rejects. `reset()` disposes the fallback and renders the children again. On the
server, an error in a streamed boundary renders the nearest `ErrorBoundary` in place.

In production server rendering, a fallback receives a generic `Error` with a short `digest`
(`An error occurred while rendering this part of the page (digest 1a2b3c4d).`) instead of an
error that is not an `HttpError`, which could reveal a database message or a file path. The
original error goes to the server log (the request handler's `onError`) with the same `digest`
property, so a user's report can be matched to the log entry. `HttpError`s (`notFound()`,
`error(403, …)`) reach the fallback as they are, development keeps the raw error, and boundaries
that catch in the browser get the error itself (decision-29).

## Portal

```ts
function Portal(props: PortalProps): JSX.Element;
interface PortalProps {
  /** Where the content goes. Default: document.body. */
  mount?: Node;
  children?: JSX.Element;
}
```

Renders `children` into a `<div>` appended to `mount`, removed with the owner. Delegated events
from the portal's content continue at the portal's position in the component tree.

## Dynamic

```ts
function Dynamic(props: DynamicProps): JSX.Element;
interface DynamicProps {
  /** A component or an intrinsic tag name. Nothing renders while it is nullish or false. */
  component: Component | string | null | undefined | false;
  [prop: string]: unknown;
}
```

Renders `component` with the other props, re-creating it only when `component` changes. With a tag
name, the props are the element's written props. The text of a `<script>` or `<style>` (children,
`innerHTML` or `textContent`) is raw text, as in JSX
([Security](../concepts/security.md#concept)).

> **Warning:** with a tag name, `Dynamic` applies `innerHTML`, `textContent` and `srcdoc` from its
> props, which a spread never does. Never spread an untrusted object (a JSON payload) into
> `Dynamic`.

## ref

```ts
function ref<T extends Element>(): JSX.Ref<T>;
```

A callback for the `ref` prop that can also be read like a signal: `input()` is `undefined` until
the element exists. Pass it as `ref={input}`.

## Title

```ts
function Title(props: { children?: JSX.Element }): JSX.Element;
```

Sets the document title. The deepest `<Title>` wins, so a page overrides its layouts. It replaces
the `<title>` that `src/document.stsx` writes in `<head>`, which comes back after an SPA navigation to
a page without a `<Title>` ([head defaults](../concepts/head.md)).

## Meta

```ts
function Meta(props: Record<string, unknown>): JSX.Element;
```

Adds or updates a `<meta>` in `<head>`, with the given attributes. Metas with the same `charset`,
`name`, `property`, `http-equiv` or `itemprop` dedupe: the deepest wins, and the previous one comes
back when it is removed. A `<Meta>` replaces the `<meta>` with the same key that the document writes
in `<head>` (`src/document.stsx`, or the default document's `charset` and `viewport`), which comes
back after an SPA navigation to a page without one.

## Head

```ts
function Head(props: { children?: JSX.Element }): JSX.Element;
```

Appends its children to `<head>` and removes them on disposal. Elements equal to one already in
`<head>` (for example rendered by the server) are skipped.

## viewTransition

```ts
function viewTransition(fn: () => void): Promise<void>;
```

Runs `fn`, a state update (signal and store writes), inside
[`document.startViewTransition`](https://developer.mozilla.org/docs/Web/API/Document/startViewTransition),
and flushes, so the DOM shows the new state when the browser captures it: the page cross-fades from
the old state to the new one, and named elements morph. The browser captures the old state first,
so `fn` runs a frame later. The promise resolves when the transition finished, and rejects when
`fn` throws. Without View Transitions support, or when the reader prefers reduced motion, it runs
`fn` and flushes at once. On the server it only runs `fn`.

With [`lumiose({ viewTransitions: true })`](vite.md#lumiose), SPA navigations to another page swap
the page inside `viewTransition()` ([Routing](../concepts/routing.md)).

## ViewTransition

```ts
function ViewTransition(props: ViewTransitionProps): JSX.Element;
interface ViewTransitionProps {
  /** The child's view-transition-name. Default: a useId() id, unique in the page. */
  name?: string;
  /** The child's view-transition-class while it enters in a viewTransition(). */
  enter?: string;
  /** The child's view-transition-class while it exits in a viewTransition(). */
  exit?: string;
  /** A single element. */
  children?: JSX.Element;
}
```

Gives its single child element a `view-transition-name`, so that in a `viewTransition()` it
animates on its own instead of with the page:

- **Moves.** In the old and the new state (a keyed list row that moved, a layout change), it morphs
  from its old position and size to the new ones.
- **Enters.** Rendered by the update (a conditional that turns on, a new row), it fades in, with
  `view-transition-class: <enter>` until the transition finished.
- **Exits.** Removed by the update, it fades out, with `view-transition-class: <exit>`. Every
  `<ViewTransition>` with `exit` gets that class before the browser captures the old state (it is
  not known yet which elements go); the ones that stay lose it again.

Style the animations in a global style block with the
[`::view-transition-*`](https://developer.mozilla.org/docs/Web/CSS/::view-transition-new)
pseudo-elements, by name or by class: `::view-transition-new(.slide-in)` for entering elements,
`::view-transition-old(.slide-out)` for exiting ones. The name is set in the browser, when the
element is created or hydrated; for cross-document transitions between MPA pages, set
`view-transition-name` in CSS ([Routing](../concepts/routing.md)). Anything but one element child
renders unnamed, with a warning in development.

```tsx check
import { signal, viewTransition, ViewTransition } from "lumiose";

export function Notifications() {
  const items = signal([{ id: 1, text: "Welcome" }]);
  let next = 2;
  const add = () =>
    viewTransition(() => items.set([{ id: next, text: `Note ${next++}` }, ...items()]));
  const dismiss = (id: number) =>
    viewTransition(() => items.set(items().filter((item) => item.id !== id)));

  return (
    <section>
      <button onClick={add}>Add</button>
      <ul>
        {items().map((item) => (
          <ViewTransition key={item.id} enter="slide-in" exit="slide-out">
            <li>
              {item.text} <button onClick={() => dismiss(item.id)}>Dismiss</button>
            </li>
          </ViewTransition>
        ))}
      </ul>
    </section>
  );
}
```

```css
/* In a global style block */
::view-transition-new(.slide-in) {
  animation: slide-in 0.25s ease-out;
}
::view-transition-old(.slide-out) {
  animation: slide-out 0.2s ease-in forwards;
}
@keyframes slide-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }
}
@keyframes slide-out {
  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}
```

## Example

```tsx check
import { Dynamic, ErrorBoundary, Portal, Suspense, ref, signal } from "lumiose";

function Info() {
  return <p>Info</p>;
}

export function Dialog() {
  const open = signal(false);
  const kind = signal<"h2" | "h3">("h2");
  const button = ref<HTMLButtonElement>();

  return (
    <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>{String(error)}</button>}>
      <button ref={button} onClick={() => open.set(true)}>
        Open
      </button>
      {open() && (
        <Portal>
          <div role="dialog">
            <Dynamic component={kind()}>Title</Dynamic>
            <Suspense fallback={<p>Loading…</p>}>
              <Dynamic component={Info} />
            </Suspense>
            <button onClick={() => (open.set(false), button()?.focus())}>Close</button>
          </div>
        </Portal>
      )}
    </ErrorBoundary>
  );
}
```

## Async components in detail

**The await rewrite.** The compiler rewrites `await` only where the nearest enclosing function is
the component itself; awaits inside handlers and callbacks are ordinary awaits. Around each
component-level `await`, the runtime restores the owner, context and tracking, so `useContext()`,
`getAbortSignal()` and signal reads keep working after it.

**Re-runs.** Props and signals read in the body (before or after an `await`) are tracked. When one
changes, the component **re-runs**:

- the previous run's `getAbortSignal()` signal aborts (cancel your fetches with it);
- the old UI stays on screen until the new run resolves, then swaps atomically;
- signals created in the body start fresh on each run;
- `isPending()` is true while the re-run is in flight.

**Boundaries.**

- `<Suspense fallback={…}>` shows its fallback for **new** pending content: the first load, and
  branches mounted later. Re-runs of content already shown keep the stale UI instead (use
  `isPending()` to dim it).
- `<ErrorBoundary fallback={(error, reset) => …}>` catches rejections and render errors below it.
- With no boundary: on the server the component becomes part of the page shell (the response waits
  for it); on the client nothing renders until it resolves; errors go to the `error` page.

**In-flight state** (all are reactive and safe to read anywhere):

| Helper                | True while                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `isPending()`         | this async component's own re-run is in flight (inside the component or its UI).                       |
| `isSubmitting(name?)` | a form action submission is in flight. See [Data and actions](../concepts/data-and-actions.md).        |
| `isNavigating()`      | an SPA navigation is in flight. See [Routing](../concepts/routing.md).                                 |
| `isBusy()`            | anything above is in flight, or any `<Suspense>` shows its fallback. Use it for a global progress bar. |

**Caching.** Component-level awaits of `fetchJSON` and `query` go through a keyed cache:

- A GET `await fetchJSON(url)` is keyed by its absolute URL, so it needs no key.
- `await query(key, fn)` caches anything else (a database call, an SDK) under a TanStack-style
  array key such as `["stats", "books"]`: JSON-serializable values, hashed stably. `fn` receives
  `{ signal, queryKey }` (TanStack's query function context); pass `signal` on to cancel the work
  once no component waits for it.
- Components awaiting the same entry share one request: per request on the server, per page in the
  browser (every island and the SPA tree, kept across client navigations).
- In the browser, a cached entry shows at once (no `<Suspense>` fallback for a new component) and
  refetches in the background (stale-while-revalidate, TanStack defaults: `staleTime` 0, `gcTime`
  5 minutes). If the data changed, the components that awaited it re-run.
- `invalidate("/api/books/1")` refetches that URL's entry and `invalidate(["stats"])` the entries
  whose key starts with `["stats"]`. Only the components that awaited them re-run, keeping their
  UI until the new data arrives. `invalidate()` with no target refreshes the whole page.
- Only awaits in async component bodies are cached. `fetchJSON` in event handlers, middleware,
  endpoints and actions is a plain request, and so are non-GET requests and
  `fetchJSON(url, { cache: "no-store" })`, the opt-out for data that must always be fresh: never
  deduped, kept or sent with the page payload.
- Errors are never cached: the next await tries again. Aborting one component's wait (a superseded
  run) never cancels a request another component still awaits.

**Islands.** Inside an [island](../concepts/islands.md), each awaited value is recorded during SSR and
replayed during hydration, so the client does not fetch it again. Cached values (`fetchJSON`,
`query`) are sent once per page instead, however many islands await them, and fill the browser
cache. Those values must be plain data (`LUM4007`), and **everything awaited inside an island is
sent to the browser**.

> **Status:** async components, the `await` rewrite, re-runs, `<Suspense>`, `<ErrorBoundary>`,
> `isPending()`, `isBusy()`, server streaming and the keyed cache (`fetchJSON`, `query`,
> `invalidate(...targets)`) are available, and so is replaying awaited values when an island
> hydrates (see [Islands](../concepts/islands.md)).

**Mistakes with async components.**

- **Reading the component's own signals in its body.** A signal created in the body and read in
  the body re-runs the component, which re-creates the signal. Read it in JSX or handlers instead
  (`LUM2007`).
- **Not passing `getAbortSignal()` to fetches.** Without it, a superseded run's request keeps going. Pass
  `{ signal: getAbortSignal() }`.
- **Passing a key as a string to `invalidate()`.** A string is a URL: `invalidate("stats")` matches
  no `query()` entry (development builds warn). Pass the key array: `invalidate(["stats"])`.
- **Mutating cached data.** Every component that awaited an entry gets the same object. Copy it
  before changing it, or keep editable state in a signal or `store`.
- **Expecting `fetchJSON` in an event handler to use the cache.** Only component-level awaits are
  cached; a handler's call is a plain request (call `invalidate(url)` after a mutation instead).
- **Awaiting a `Response` inside an island.** `await fetch(url)` gives a non-serializable value.
  Use `await fetchJSON(url)` (`LUM4007`).
- **Putting secrets in awaited values inside islands.** They are serialized into the HTML. Fetch
  only what the browser may see.
- **Wrapping a re-run in `<Suspense>` and expecting the fallback again.** Revealed content keeps
  its stale UI; show progress with `isPending()` or `isBusy()`.
- **`await using` in a component body.** Not supported in v1 (`LUM1007`).
- **Expecting `resource()` on the server.** It never runs there; use an async component.

## Head and document in detail

**Head components.** `<Title>`, `<Meta>` and `<Head>` can be used in any component, layout or page.
There is no `meta` export: these components are the one way to set head content.

- `<Title>`: the deepest one wins, so a page overrides its layouts and the document.
- `<Meta name="…" content="…" />`: attributes as in HTML. Metas with the same `charset`, `name`,
  `property`, `http-equiv` or `itemprop` dedupe: the deepest one wins, and the previous value comes
  back when it is removed.
- `<Head>`: any other head elements (`<link>`, `<script>`). Elements already in `<head>` are not
  duplicated; while hydrating, the server's copy belongs to the component and goes with it.

**On the server** they are collected while the shell renders and flushed into `<head>`. Inside a
streamed `<Suspense>` boundary they are too late (`LUM5004`). **In the browser** (islands, SPA)
they update `document.title` and `<head>` live, and are removed with their component: the
previous value comes back, or the head default (see Head defaults) when the last one of a key goes.

**Document.** By default Lumiose renders the HTML document. `src/document.stsx` takes over
`<html>`, `<head>` and `<body>`: it receives `{ head, body }` and must render each once. It renders
like any component, so it can provide context to pages. `{props.head}` also carries the page's
stylesheets, then its island loader, client scripts and module preloads: the stylesheets block the
first paint, so the browser requests them first (over HTTP/1.1 it opens only six connections per
host). `{props.body}` is followed by the page's island records
and its streamed `<Suspense>` content, so the whole page stays inside `<body>` with either document.

**Head defaults.** The `<title>` and `<meta>` tags the document writes in its `<head>` are defaults,
the shallowest level of the head: a `<Title>` replaces the title, and a `<Meta>` replaces the tag
with the same `charset`, `name`, `property`, `http-equiv` or `itemprop`, where the document put it.
Each page gets one of each, in complete and streamed responses. The default document's `charset` and
`viewport` tags work the same way. After an SPA navigation to a page without its own `<Title>` or
`<Meta>` of a key, the default comes back, as the server would render that page: a tag that
replaced a default carries it in a `data-l-default` attribute. The same goes for the `<Title>` and
`<Meta>` of layouts outside the SPA (the ones the server renders around it), except where the page
that loaded the document replaced them; SPA-wide defaults belong in the document or the outermost
`spa` layout.

**Inline JSON and scripts.** The text of a `<script>` or `<style>` is raw text, which HTML does
not decode, so Lumiose writes it as it is (no `&lt;`) and makes sure it cannot end the element or
open a tag: the character after a `<` that could start one is escaped (`</script` becomes
`<\/script`, `<b` becomes `<\u0062` in a script and `<\62 ` in a style; see
[Security](../concepts/security.md) for what reads them back), and in a JSON script
(`application/ld+json`, `application/json` and other `…json` types, `importmap`,
`speculationrules`) every `<` becomes `\u003c`, which JSON reads back as `<`. So
`{JSON.stringify(data)}` is the way to write JSON-LD, even with data users wrote. `innerHTML` and
`textContent` on these elements get the same treatment.

> **Status:** available on the server (`renderToStream`) and in the browser; the default and custom
> documents are rendered by the request handler.

**Mistakes with the head and the document.**

- **A `meta` or `title` export.** There is none; render `<Title>` and `<Meta>`.
- **`<Title>` inside `<Suspense>`** on a server route: the head was already sent (`LUM5004`). Set
  it in the page body outside the boundary.
- **Rendering `props.head` or `props.body` twice** in `document.stsx`. Render each exactly once.
- **Writing `<title>` or `<meta>` elements directly in a page.** They land in the body. Use the
  components.
- **Setting `document.title` in an effect.** It fights with `<Title>`; use the component.
- **Escaping JSON for a `<script>` yourself.** `&lt;` stays `&lt;` in a script; write
  `{JSON.stringify(data)}` and let Lumiose make it safe.
