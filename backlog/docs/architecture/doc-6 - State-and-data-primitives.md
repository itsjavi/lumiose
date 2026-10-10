---
id: doc-6
title: State and data primitives
type: specification
created_date: '2026-10-10 03:32'
updated_date: '2026-10-10 03:32'
---
# State and data primitives

Status (2026-10-10): the user approved the direction of A–E below ("for the rest I'd go with your recommendations"). Names and call syntax were approved on 2026-10-10 (TASK-190, doc-7, decision-35): `defineState`, `query`, `invalidate(...targets)`, `submit({ invalidate })`, `reconcile`, `optimistic(source)` with `.set(value, promise)` / `.update(fn, promise)`, and `@lumiose/query` with TanStack's `useQuery`/`useMutation`/`useQueryClient`/`QueryClientProvider`. Examples below use the approved names (`useContext`, `getAbortSignal`, …).

## Why

Comparing Jotai, Zustand, Valtio and TanStack Query/DB with Lumiose (2026-10-10) showed that signals, `store`, `computed` and context already cover what Jotai/Zustand/Valtio offer (recipes: `docs/concepts/state.md`, TASK-189). The gaps:

- Module-scope state is one instance per server process (`LUM4008`), and tests cannot isolate it.
- Context does not reach islands: each island hydrates under its own root. During SSR an island still sees page context, so its HTML and hydrated state can disagree (TASK-194).
- Two components awaiting the same URL fetch it twice; `invalidate()` only refreshes the whole page.
- An async component re-run replaces its whole subtree, so refetched lists lose row state.
- Optimistic UI and rollback are manual.

Recipes cover families, persistence, external stores and stores with actions. Everything below needs runtime, SSR or island integration, so it cannot be a recipe.

## A. Scoped state

```ts
// lib/cart.ts
export const cart = defineState(() => {
  const items = signal<Item[]>([]);
  return { items, count: computed(() => items().length), add: (item: Item) => items.update((l) => [...l, item]) };
});

// any component or island
const { count, add } = cart();
```

- The factory runs lazily once per scope: per request on the server, once per page in the browser (shared by every island and the SPA tree), fresh per test.
- **Seeding** (decision-33): the factory runs per request on the server, so it reads request APIs (`locals()`, `cookies()`, …) directly. No separate seed API (the Nuxt `useState(key, init)` pattern).
- **Serialization** (decision-33): states instantiated during a request and reachable from client code are sent once per page, keyed by a compiler-assigned id, through the existing serializer and its escaping. In the browser the factory runs once, then the server values replace its signals before any island hydrates.

## B. Keyed async cache

```tsx
export async function BookTitle({ id }: { id: string }) {
  const book = await fetchJSON<Book>(`/api/books/${id}`); // deduped and cached by URL, no key needed
  return <h2>{book.title}</h2>;
}

export async function Stats() {
  const stats = await query(["stats", "books"], () => db.stats.books()); // anything that is not fetchJSON
  return <p>{stats.total}</p>;
}

invalidate("/api/books/1"); // the fetchJSON entries for that URL
invalidate(["stats"]);      // query entries whose key starts with ["stats"]
invalidate();               // the whole page, as today
submit(form, { invalidate: ["/api/books/1", ["stats"]] });
```

- Keys (decision-34): a GET `fetchJSON` is keyed by its absolute URL; `query()` keys are arrays of JSON-serializable values, hashed stably, with prefix matching for invalidation (TanStack Query semantics).
- Only component-level awaits are cached; `fetchJSON` in handlers stays a plain request. Non-GET requests are never cached.
- Scope: per request on the server, per page/app in the browser. Islands read server results from the page payload (as A), shared instead of replayed per island.
- A cached key returns at once (no `<Suspense>` fallback) and revalidates in the background. Defaults follow TanStack (`staleTime: 0`, `gcTime: 5 min`).

## C. `reconcile`

```ts
const books = store<Book[]>([]);
reconcile(books, await fetchJSON<Book[]>("/api/books"), { key: "id" });
```

Solid's `reconcile`, applied to our mutable stores: unchanged items keep their identity and only changed fields notify. Default key `"id"`, as Solid. B, D and E use it internally (TanStack's structural sharing).

## D. Optimistic updates

```tsx
const likes = optimistic(() => props.likes);
likes.update((n) => n + 1, submit(event));
```

The overlay holds while the promise is pending. On success the refreshed source shows; on failure the overlay drops, which rolls back. Prior art: React `useOptimistic`, Solid 2 `createOptimistic`. Works with any promise, not only `submit()`.

## E. `@lumiose/query`

An optional package: a thin adapter over `@tanstack/query-core`, with the names of `@tanstack/solid-query` v5 (`useQuery`, `useMutation`, `useQueryClient`, `QueryClientProvider`) since it is the signal-based adapter users know. Observers write into a store through C; the client is provided through context or A. Browser first (SPA and islands); SSR dehydration later. A TanStack DB adapter can follow the same pattern.

## Order

TASK-190 (naming audit) first, since it names A, B and D. C has no dependencies. E depends on C. TASK-194 (island context bug) is independent.
