# Async components

> Any component may be `async` and `await` data in its body, on the server and the client. `<Suspense>` shows a fallback while new content loads; `<ErrorBoundary>` catches failures.

## Concept

Async components are **the** way to read data in Lumiose (there are no route loaders). The same
component works in every rendering mode.

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
  for it); on the client nothing renders until it resolves; errors go to the `_error` page.

**In-flight state** (all are reactive and safe to read anywhere):

| Helper                | True while                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `isPending()`         | this async component's own re-run is in flight (inside the component or its UI).                       |
| `isSubmitting(name?)` | a form action submission is in flight. See [Data and actions](data-and-actions.md).                    |
| `isNavigating()`      | an SPA navigation is in flight. See [Routing](routing.md).                                             |
| `isBusy()`            | anything above is in flight, or any `<Suspense>` shows its fallback. Use it for a global progress bar. |

**Caching.** Component-level awaits of `fetchJSON` and `query` go through a keyed cache:

- A GET `await fetchJSON(url)` is keyed by its absolute URL, so it needs no key.
- `await query(key, fn)` caches anything else (a database call, an SDK) under a TanStack-style
  array key such as `["stats", "books"]`: JSON-serializable values, hashed stably.
- Components awaiting the same entry share one request: per request on the server, per page in the
  browser (every island and the SPA tree, kept across client navigations).
- In the browser, a cached entry shows at once (no `<Suspense>` fallback for a new component) and
  refetches in the background (stale-while-revalidate, TanStack defaults: `staleTime` 0, `gcTime`
  5 minutes). If the data changed, the components that awaited it re-run.
- `invalidate("/api/books/1")` refetches that URL's entry and `invalidate(["stats"])` the entries
  whose key starts with `["stats"]`. Only the components that awaited them re-run, keeping their
  UI until the new data arrives. `invalidate()` with no target refreshes the whole page.
- Only awaits in async component bodies are cached. `fetchJSON` in event handlers, middleware,
  endpoints and actions is a plain request, and so are non-GET requests.
- Errors are never cached: the next await tries again. Aborting one component's wait (a superseded
  run) never cancels a request another component still awaits.

**Islands.** Inside an [island](islands.md), each awaited value is recorded during SSR and
replayed during hydration, so the client does not fetch it again. Cached values (`fetchJSON`,
`query`) are sent once per page instead, however many islands await them, and fill the browser
cache. Those values must be plain data (`LUM4007`), and **everything awaited inside an island is
sent to the browser**.

> **Status:** async components, the `await` rewrite, re-runs, `<Suspense>`, `<ErrorBoundary>`,
> `isPending()`, `isBusy()`, server streaming and the keyed cache (`fetchJSON`, `query`,
> `invalidate(...targets)`) are available, and so is replaying awaited values when an island
> hydrates (see [Islands](islands.md)).

## API

| API                                                              | Shape                                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `async function Name(props) { const x = await …; return <… /> }` | An async component.                                                                                        |
| `<Suspense fallback={…}>`                                        | Fallback for new pending content below.                                                                    |
| `<ErrorBoundary fallback={(error, reset) => …}>`                 | Fallback after an error below; `reset()` renders the children again. `fallback` may also be plain content. |
| `isPending()`                                                    | Whether this component's re-run is in flight.                                                              |
| `isBusy()`                                                       | Whether anything in the app is in flight.                                                                  |
| `getAbortSignal()`                                               | `AbortSignal` of the current run; aborted when superseded or disposed.                                     |
| `fetchJSON<T>(url, init?)`                                       | Isomorphic JSON fetch that returns plain data; cached by URL when awaited in a component.                  |
| `query(key, fn)`                                                 | Awaited in a component, caches what `fn` resolves to under `key` (an array).                               |
| `invalidate(...targets)`                                         | Refetches the entries of URLs and key prefixes, re-running their components; no target: the whole page.    |

## Example

```tsx check
import { ErrorBoundary, Suspense, fetchJSON, getAbortSignal, isPending, signal } from "lumiose";

interface Book {
  id: string;
  title: string;
  summary: string;
}

export async function BookDetails({ id }: { id: string }) {
  const book = await fetchJSON<Book>(`/api/books/${id}`, { signal: getAbortSignal() });
  const expanded = signal(false);

  return (
    <article class={{ stale: isPending() }}>
      <h2>{book.title}</h2>
      <button onClick={() => expanded.update((open) => !open)}>Details</button>
      {expanded() && <p>{book.summary}</p>}
    </article>
  );
}

export function BookPage({ ids }: { ids: string[] }) {
  const current = signal(ids[0] ?? "");

  return (
    <main>
      <nav>
        {ids.map((id) => (
          <button onClick={() => current.set(id)}>{id}</button>
        ))}
      </nav>
      <ErrorBoundary
        fallback={(error, reset) => (
          <p>
            Could not load the book ({String(error)}). <button onClick={reset}>Retry</button>
          </p>
        )}
      >
        <Suspense fallback={<p>Loading…</p>}>
          <BookDetails id={current()} />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}
```

Clicking another id re-runs `BookDetails`: the old book stays (dimmed through `isPending()`) until
the new one arrives; `<Suspense>` only showed its fallback for the first load. Going back to a book
already seen shows it at once from the cache, then revalidates it.

Data that does not come from `fetchJSON` goes through `query`, and a mutation refreshes only what it
changed:

```tsx check
import { invalidate, query } from "lumiose";

declare const db: { stats(): Promise<{ total: number }>; addBook(title: string): Promise<void> };

export async function Stats() {
  const stats = await query(["stats", "books"], () => db.stats());
  return <p>{stats.total} books</p>;
}

export function AddBook() {
  return (
    <button
      onClick={async () => {
        await db.addBook("Dune");
        await invalidate(["stats"], "/api/books"); // re-runs Stats and the components of /api/books
      }}
    >
      Add
    </button>
  );
}
```

## Common mistakes

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

## Related diagnostics

- [LUM1007](../errors/LUM1007.md): `await using` in a component.
- [LUM2007](../errors/LUM2007.md): own signal read in an async body.
- [LUM4006](../errors/LUM4006.md): hydration mismatch (including replay key mismatches).
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.

See also: [Islands](islands.md), [Rendering modes](rendering-modes.md), [reference: components](../reference/components.md).
