# Async components

> Components can be async and await their data, on the server and in the browser, with Suspense for loading states and error boundaries for failures.

## Concept

### Await in a component

An `async` component awaits its data, in every rendering mode: there are no route loaders.
`<Suspense>` shows its fallback for the first load.

```tsx check
import { Suspense, fetchJSON } from "lumiose";

async function Title(props: { id: string }) {
  const url = `/api/books/${props.id}`;
  const book = await fetchJSON<{ title: string }>(url);
  return <h2>{book.title}</h2>;
}

export function TitlePage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Title id="1" />
    </Suspense>
  );
}
```

### The cache

```tsx check
import { invalidate, query } from "lumiose";

declare const db: {
  stats(): Promise<{ total: number }>;
  addBook(title: string): Promise<void>;
};

export async function Stats() {
  const stats = await query(["stats", "books"], () => db.stats());
  return <p>{stats.total} books</p>;
}

export function AddBook() {
  const add = async () => {
    await db.addBook("Dune");
    await invalidate(["stats"], "/api/books");
  };
  return <button onClick={add}>Add</button>;
}
```

Components that await the same `fetchJSON` URL or `query` key share one request and one cached
value. `invalidate` refetches the entries of a key prefix or a URL, and re-runs only the
components that awaited them.

> **Details:** the `await` rewrite, boundaries, the cache's rules, what islands send to the
> browser, and the status of each part:
> [Async components in detail](../reference/components.md#async-components-in-detail).

## API

| API                                | Use                                                       |
| ---------------------------------- | --------------------------------------------------------- |
| `async function Name(props) { … }` | An async component: `await`, then return JSX.             |
| `<Suspense fallback>`              | Fallback for new pending content below.                   |
| `<ErrorBoundary fallback>`         | Content or `(error, reset) => …`, shown after an error.   |
| `isPending()`                      | This component's re-run is in flight.                     |
| `isBusy()`                         | Anything in the app is in flight.                         |
| `getAbortSignal()`                 | The current run's signal: aborted when superseded.        |
| `fetchJSON<T>(url, init?)`         | JSON fetch, cached by URL when awaited in a component.    |
| `query(key, fn)`                   | Caches what `fn` resolves to under an array key.          |
| `invalidate(...targets)`           | Refetch URLs and key prefixes; no target: the whole page. |

Signatures: [components](../reference/components.md#suspense),
[data](../reference/app.md#data), [in-flight state](../reference/reactivity.md#ispending).

## Example

Clicking another id re-runs `BookDetails`. The old book stays, dimmed through `isPending()`, until
the new one arrives. A book seen before shows at once from the cache, then revalidates.

```tsx check
import { ErrorBoundary, Suspense, fetchJSON, getAbortSignal, isPending, signal } from "lumiose";

interface Book {
  title: string;
  summary: string;
}

async function BookDetails(props: { id: string }) {
  const book = await fetchJSON<Book>(`/api/books/${props.id}`, {
    signal: getAbortSignal(),
  });
  const open = signal(false);

  return (
    <article class={{ stale: isPending() }}>
      <h2>{book.title}</h2>
      <button onClick={() => open.update((o) => !o)}>Details</button>
      {open() && <p>{book.summary}</p>}
    </article>
  );
}

export function BookPage(props: { ids: string[] }) {
  const current = signal(props.ids[0] ?? "");

  return (
    <main>
      {props.ids.map((id) => (
        <button onClick={() => current.set(id)}>{id}</button>
      ))}
      <ErrorBoundary
        fallback={(error, reset) => (
          <p>
            {String(error)} <button onClick={reset}>Retry</button>
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

## Common mistakes

Each in full: [Async components in detail](../reference/components.md#async-components-in-detail).

- **Reading the component's own signals in its body** re-runs it (`LUM2007`).
- **Not passing `getAbortSignal()` to fetches.** A superseded run's request keeps going.
- **`invalidate("stats")`.** A string is a URL; pass the key array, `invalidate(["stats"])`.
- **Mutating cached data.** Every component that awaited the entry gets the same object.
- **Expecting the cache in an event handler.** Only component-level awaits are cached.
- **Awaiting a `Response` or a secret inside an island.** Awaited values are serialized into the
  HTML (`LUM4007`).
- **Expecting the `<Suspense>` fallback on a re-run.** Use `isPending()` or `isBusy()`.
- **`await using` in a component body** (`LUM1007`), and **`resource()` on the server**: neither
  works.

## Related diagnostics

- [LUM1007](../errors/LUM1007.md): `await using` in a component.
- [LUM2007](../errors/LUM2007.md): own signal read in an async body.
- [LUM4006](../errors/LUM4006.md): hydration mismatch (including replay key mismatches).
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.

See also: [Islands](islands.md), [Rendering modes](rendering-modes.md), [reference: components](../reference/components.md).
