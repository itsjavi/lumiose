# `@lumiose/query`

> TanStack Query for Lumiose, with Solid Query's API and results in reactive stores.

An optional package, not part of `lumiose`: install it with `pnpm add @lumiose/query`. It is a thin
adapter. Caching, deduplication, retries, stale times, invalidation and refetching on focus or
reconnect come from `@tanstack/query-core`, so the [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/solid/overview)
apply as written. Concepts: [Signals and reactivity](../concepts/signals.md),
[Data and actions](../concepts/data-and-actions.md).

## When to use it

Lumiose reads data without a library: async components `await` it, [`fetchJSON`](app.md#fetchjson)
fetches JSON, and `invalidate()` and `submit()` refresh what a page shows. Those awaits are cached:
[`fetchJSON`](app.md#fetchjson) by URL and [`query(key, fn)`](app.md#query) by key, deduplicated,
stale-while-revalidate, invalidated by URL or key prefix, and sent from the server to islands with
the page. Prefer the built-in primitives when:

- data is read by async components and refreshed by form actions or `invalidate(target)`,
- pages render on the server (`@lumiose/query` does not fetch there, see [Server rendering](#server-rendering)).

Use `@lumiose/query` for client-side data (`spa` routes and islands) that needs what a client cache
gives you:

- many components reading the same data, fetched once and kept in sync,
- polling (`refetchInterval`), refetching on window focus and reconnect, per-query `staleTime`,
- retries, pagination with `placeholderData: keepPreviousData`, dependent queries (`enabled`),
- mutations with optimistic updates and rollback (`onMutate`, `onError`),
- a team or code that already knows TanStack Query.

## QueryClientProvider

```ts
function QueryClientProvider(props: { client: QueryClient; children?: JSX.Element }): JSX.Element;
```

Provides `client` to everything rendered inside it, through a context. Once mounted it calls `client.mount()`, which refetches on window focus and reconnect and resumes
paused mutations, and `client.unmount()` when it is disposed. A client is usually created once, at
module scope:

```tsx
import { QueryClient, QueryClientProvider } from "@lumiose/query";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Books />
    </QueryClientProvider>
  );
}
```

Islands start a new root and do not see context provided outside them: wrap each island that uses
queries in its own provider. Pass the same module-scope client to share one cache between islands.

## useQueryClient

```ts
function useQueryClient(queryClient?: QueryClient): QueryClient;
```

`queryClient` if given, else the client of the nearest `QueryClientProvider`. Throws "No
QueryClient set, use QueryClientProvider to set one" when there is none. Call it while the
component sets up, and use the client later (`client.invalidateQueries(...)` in a handler).

## useQuery

```ts
function useQuery<TQueryFnData, TError, TData, TQueryKey>(
  options: () => QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  queryClient?: () => QueryClient,
): UseQueryResult<TData, TError>;
```

Subscribes to a query. `options` takes every [`QueryObserverOptions`](https://tanstack.com/query/latest/docs/reference/QueryObserver)
field except `structuralSharing`, plus `reconcile` (below). It is an accessor: when a signal it
reads changes, such as a part of the key or `enabled`, the query switches to the new options.

```tsx
function Book(props: { id: number }) {
  const book = useQuery(() => ({
    queryKey: ["book", props.id],
    queryFn: () => fetchJSON<Book>(`/api/books/${props.id}`),
  }));
  return (
    <article>
      {book.isPending ? (
        <p>Loading…</p>
      ) : book.isError ? (
        <p>{book.error.message}</p>
      ) : (
        <h2>{book.data.title}</h2>
      )}
      {book.isFetching && <small>Refreshing…</small>}
    </article>
  );
}
```

The result is a [store](reactivity.md#store) with the fields of TanStack's `QueryObserverResult`
(`data`, `error`, `status`, `isPending`, `isFetching`, `refetch`, …). Read fields where they are
used, as with any store: destructuring (`const { data } = book`) reads once and loses updates.

- **Structural sharing through `reconcile`.** A new `data` is written into the store with
  [`reconcile()`](reactivity.md#reconcile): array items are matched by `id`, unchanged objects keep
  their identity, and only the fields that changed notify. List rows and effects that read an
  unchanged item do not re-run after a refetch. `reconcile: "slug"` matches by another key;
  `reconcile: false` stores `data` as the cache holds it (replaced on each change);
  `reconcile: (old, next) => data` decides. query-core's own `structuralSharing` is turned off.
- **The store holds a copy of `data`.** The cache's object is shared by every observer of the
  query, and a store writes into the object it wraps. Writing to `book.data` therefore changes
  this component only: update the cache with `client.setQueryData()`.
- **Lifetime.** The observer subscribes after the component mounts, so the fetch starts then, and
  it unsubscribes when the component (its owner) is disposed. What `queryFn` reads is not tracked.
- Two `useQuery` calls with the same key share one fetch and one cache entry.

## useMutation

```ts
function useMutation<TData, TError, TVariables, TOnMutateResult>(
  options: () => MutationOptions<TData, TError, TVariables, TOnMutateResult>,
  queryClient?: () => QueryClient,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult>;
```

A mutation. The result is a store with TanStack's `MutationObserverResult` fields (`status`,
`isPending`, `data`, `error`, `variables`, `reset`, …), plus:

- `mutate(variables, { onSuccess, onError, onSettled }?)`: runs `mutationFn`. It never rejects;
  errors go to `error` and the callbacks.
- `mutateAsync(variables, callbacks?)`: the same, as a promise that rejects on error.

```tsx
function AddBook() {
  const client = useQueryClient();
  const add = useMutation(() => ({
    mutationFn: (title: string) =>
      fetchJSON<Book>("/api/books", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["books"] }),
  }));
  return (
    <button disabled={add.isPending} onClick={() => add.mutate("Dune")}>
      {add.isPending ? "Adding…" : "Add"}
    </button>
  );
}
```

## Re-exports

Everything `@tanstack/query-core` exports is re-exported, as by `@tanstack/solid-query`:
`QueryClient`, `QueryCache`, `MutationCache`, `skipToken`, `keepPreviousData`, `hashKey`, its types,
and so on. The adapter's own types: `QueryOptions`, `UseQueryOptions`, `UseQueryResult`,
`DefinedUseQueryResult`, `UndefinedInitialDataOptions`, `DefinedInitialDataOptions`,
`MutationOptions`, `UseMutationOptions`, `UseMutationResult`, `UseMutateFunction`,
`UseMutateAsyncFunction` and `QueryClientProviderProps`. With `initialData`,
`useQuery`'s result is typed `DefinedUseQueryResult`: `data` is never `undefined`.

## Server rendering

Browser first: SPA routes and islands. In a server render, effects never run, so queries do not
subscribe and never fetch. `useQuery` shows what the client's cache already holds, otherwise the
pending state, and `QueryClientProvider` does not mount the client.

- Render the same thing on the server and in the browser's first render. With an empty cache on
  both sides, both render the pending state and the island fetches once it hydrates.
- A module-scope client on the server is shared by every request. Create one per request, or
  render only the pending state on the server.

Dehydrating the server's cache into the page (TanStack's `dehydrate`/`hydrate`) is not supported
yet.

## Not supported yet

- `<Suspense>`: queries do not suspend, and the `suspense` option has no effect. Render
  `isPending` instead.
- `throwOnError`: errors stay in the result instead of reaching an `<ErrorBoundary>`.
- `useQueries`, `useInfiniteQuery`, `useIsFetching`, `useIsMutating`, `useMutationState` and
  `queryOptions()`. The observers they wrap (`QueriesObserver`, `InfiniteQueryObserver`) are
  re-exported from query-core.
