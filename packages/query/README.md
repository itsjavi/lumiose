# @lumiose/query

[TanStack Query](https://tanstack.com/query) for Lumiose: a thin adapter over `@tanstack/query-core`
with the names and call shapes of `@tanstack/solid-query` v5. Results are Lumiose stores, written
through `reconcile()`, so unchanged data keeps its identity and only the fields that changed
re-render.

```sh
pnpm add @lumiose/query
```

```tsx
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@lumiose/query";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Books />
    </QueryClientProvider>
  );
}

function Books() {
  const client = useQueryClient();
  const books = useQuery(() => ({
    queryKey: ["books"],
    queryFn: async () => (await fetch("/api/books")).json() as Promise<Book[]>,
  }));
  const add = useMutation(() => ({
    mutationFn: (title: string) => fetch("/api/books", { method: "POST", body: title }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["books"] }),
  }));
  return (
    <>
      {books.isPending ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {books.data?.map((book) => (
            <li>{book.title}</li>
          ))}
        </ul>
      )}
      <button disabled={add.isPending} onClick={() => add.mutate("New book")}>
        Add
      </button>
    </>
  );
}
```

- `useQuery(() => options, client?)`: options are an accessor, so a signal read inside (a key
  part, `enabled`) updates the query. `reconcile` picks the key `reconcile()` matches array items
  by (default `"id"`), or `false` to store `data` as the cache holds it.
- `useMutation(() => options, client?)`: `mutate`, `mutateAsync` and the mutation state.
- `useQueryClient(client?)` and `QueryClientProvider`. Everything `@tanstack/query-core` exports
  (`QueryClient`, `skipToken`, `keepPreviousData`, types) is re-exported.

Browser first (SPA and islands). In a server render, queries do not fetch: they show what the
client's cache already holds, else the pending state. There is no dehydration and no Suspense
integration yet.

When to use it rather than the built-in data primitives, and the details:
[docs/reference/query.md](https://github.com/itsjavi/lumiose/blob/main/packages/lumiose/docs/reference/query.md).

MIT
