# Async components

> Any component may be `async` and `await` data in its body, on the server and the client. `<Suspense>` shows a fallback while new content loads; `<ErrorBoundary>` catches failures.

## Concept

Async components are **the** way to read data in Lumiose (there are no route loaders). The same
component works in every rendering mode.

**The await rewrite.** The compiler rewrites `await` only where the nearest enclosing function is
the component itself; awaits inside handlers and callbacks are ordinary awaits. Around each
component-level `await`, the runtime restores the owner, context and tracking, so `inject()`,
`lifetime()` and signal reads keep working after it.

**Re-runs.** Props and signals read in the body (before or after an `await`) are tracked. When one
changes, the component **re-runs**:

- the previous run's `lifetime()` signal aborts (cancel your fetches with it);
- the old UI stays on screen until the new run resolves, then swaps atomically;
- signals created in the body start fresh on each run;
- `pending()` is true while the re-run is in flight.

**Boundaries.**

- `<Suspense fallback={…}>` shows its fallback for **new** pending content: the first load, and
  branches mounted later. Re-runs of content already shown keep the stale UI instead (use
  `pending()` to dim it).
- `<ErrorBoundary fallback={(error, retry) => …}>` catches rejections and render errors below it.
- With no boundary: on the server the component becomes part of the page shell (the response waits
  for it); on the client nothing renders until it resolves; errors go to the `_error` page.

**In-flight state** (all are reactive and safe to read anywhere):

| Helper              | True while                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `pending()`         | this async component's own re-run is in flight (inside the component or its UI).                       |
| `submitting(name?)` | a form action submission is in flight. See [Data and actions](data-and-actions.md).                    |
| `navigating()`      | an SPA navigation is in flight. See [Routing](routing.md).                                             |
| `busy()`            | anything above is in flight, or any `<Suspense>` shows its fallback. Use it for a global progress bar. |

**Islands.** Inside an [island](islands.md), each awaited value is recorded during SSR and
replayed during hydration, so the client does not fetch it again. Those values must be plain data
(`LUM4007`), and **everything awaited inside an island is sent to the browser**.

> **Status:** async components, the `await` rewrite, re-runs, `<Suspense>`, `<ErrorBoundary>`,
> `pending()`, `busy()` and server streaming are available, and so is replaying awaited values when
> an island hydrates (see [Islands](islands.md)).

## API

| API                                                              | Shape                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `async function Name(props) { const x = await …; return <… /> }` | An async component.                                                                                       |
| `<Suspense fallback={…}>`                                        | Fallback for new pending content below.                                                                   |
| `<ErrorBoundary fallback={(error, retry) => …}>`                 | Fallback after an error below; `retry()` mounts the children again. `fallback` may also be plain content. |
| `pending()`                                                      | Whether this component's re-run is in flight.                                                             |
| `busy()`                                                         | Whether anything in the app is in flight.                                                                 |
| `lifetime()`                                                     | `AbortSignal` of the current run; aborted when superseded or disposed.                                    |
| `fetchJSON<T>(url, init?)`                                       | Isomorphic JSON fetch that returns plain data. See [Data and actions](data-and-actions.md).               |

## Example

```tsx check
import { ErrorBoundary, Suspense, fetchJSON, lifetime, pending, signal } from "lumiose";

interface Book {
  id: string;
  title: string;
  summary: string;
}

export async function BookDetails({ id }: { id: string }) {
  const book = await fetchJSON<Book>(`/api/books/${id}`, { signal: lifetime() });
  const expanded = signal(false);

  return (
    <article class={{ stale: pending() }}>
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
        fallback={(error, retry) => (
          <p>
            Could not load the book ({String(error)}). <button onClick={retry}>Retry</button>
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

Clicking another id re-runs `BookDetails`: the old book stays (dimmed through `pending()`) until
the new one arrives; `<Suspense>` only showed its fallback for the first load.

## Common mistakes

- **Reading the component's own signals in its body.** A signal created in the body and read in
  the body re-runs the component, which re-creates the signal. Read it in JSX or handlers instead
  (`LUM2007`).
- **Not passing `lifetime()` to fetches.** Without it, a superseded run's request keeps going. Pass
  `{ signal: lifetime() }`.
- **Awaiting a `Response` inside an island.** `await fetch(url)` gives a non-serializable value.
  Use `await fetchJSON(url)` (`LUM4007`).
- **Putting secrets in awaited values inside islands.** They are serialized into the HTML. Fetch
  only what the browser may see.
- **Wrapping a re-run in `<Suspense>` and expecting the fallback again.** Revealed content keeps
  its stale UI; show progress with `pending()` or `busy()`.
- **`await using` in a component body.** Not supported in v1 (`LUM1007`).
- **Expecting `resource()` on the server.** It never runs there; use an async component.

## Related diagnostics

- [LUM1007](../errors/LUM1007.md): `await using` in a component.
- [LUM2007](../errors/LUM2007.md): own signal read in an async body.
- [LUM4006](../errors/LUM4006.md): hydration mismatch (including replay key mismatches).
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.

See also: [Islands](islands.md), [Rendering modes](rendering-modes.md), [reference: components](../reference/components.md).
