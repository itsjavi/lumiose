---
id: doc-7
title: API naming audit
type: specification
created_date: '2026-10-10 03:46'
---

# API naming audit

Status (2026-10-10): **proposal**, waiting for the user's approval (TASK-190 AC #4). Audit by Prism, recorded by Lux. Rule: decision-32. The user already decided that approved renames ship outright: a breaking 0.x change with a changelog migration table and no deprecated aliases.

Library abbreviations: R = React 19, S1 = Solid 1.9, S2 = Solid 2.0 RC, SR = Solid Router, RR = React Router 7, TQ = TanStack Query v5, SK = SvelteKit.

## Vocabulary family

Take a name exactly as React, Solid or TanStack spell it when our behaviour matches. Drop a prefix when it would promise behaviour we don't have: `create*` promises Solid's `[get, set]` tuple, and `use*` promises React's re-render model. Never put `use` on a name we coin ourselves.

| Family | Choice | Why | Main alternative |
| --- | --- | --- | --- |
| Reactive primitives | Short names: `signal`, `computed`, `effect`, `batch`, `untrack`, `flush`, `store`, `snapshot`, `reconcile`, `resource`, `optimistic` | Our `signal()` is a callable with `.set`/`.update`/`.peek`, which is exactly Angular's `signal`, and the same word as Preact, alien-signals and the TC39 proposal. `createSignal`/`createStore` would promise Solid's tuple, and S2's `createEffect(compute, apply)` has a different signature. S2 itself uses bare `snapshot`, `reconcile`, `flush` and `isPending`. | Solid's `createX` names on our shapes: familiar to Solid users, but wrong about behaviour |
| Context | `createContext` + `<Ctx value={…}>` + `useContext` | R19 and S2 now have the same shape. Solid's `useContext` is setup-once and walks the owner chain, exactly what our `inject` does. | Keep `provide`/`inject` (Vue) and document them |
| In-flight state | `is*` boolean getters: `isPending`, `isSubmitting`, `isNavigating`, `isBusy` | Standalone functions use `is*` in R (`isPending`), S2 (`isPending(fn)`), SR (`useIsRouting`) and TQ (`useIsFetching`). R and S2 `isPending` mean exactly what our `pending()` does. | Keep the bare adjectives (`pending()`) |
| Data and async | TanStack names for the cache (`query`, keys, `invalidate`, `staleTime`/`gcTime`); RR/SK names for actions and routing (`submit`, `actionData`, `href`, `redirect`, `fail`, `error`) | Keyed invalidation marks entries stale (TQ `invalidateQueries`), and URL invalidation is SK's `invalidate(url)`. `revalidate` implies "refetch now". | Solid Router vocabulary (`query(fn, key)`, `revalidate`, `createAsync`) |
| Lifecycle | `onMount`, `onCleanup` (S1), `getAbortSignal()` (Svelte 5.35) | Svelte's name has exactly our semantics: an AbortSignal aborted when the reaction re-runs or is destroyed. Neither React nor Solid has one. | `abortSignal()` (invented) |

## Proposed renames (migration table)

| Old | New | Entry |
| --- | --- | --- |
| `inject(Ctx)` | `useContext(Ctx)` | `lumiose` |
| `provide(Ctx, v)` | `<Ctx value={v}>…</Ctx>` | `lumiose` |
| `lifetime()` | `getAbortSignal()` | `lumiose` |
| `pending()` | `isPending()` | `lumiose` |
| `busy()` | `isBusy()` (invented: no known app-wide flag; mirrors `aria-busy`) | `lumiose` |
| `submitting(name?)` | `isSubmitting(name?)` | `lumiose` |
| `flushSync()` | `flush()` (S2) | `lumiose` |
| `navigating()` | `isNavigating()` | `lumiose/router` |
| `search()`, `search.set()`, `Search`, `SearchInit` | `searchParams()`, `searchParams.set()`, `SearchParams`, `SearchParamsInit` (the Web `URL.search` is a string, ours returns URLSearchParams) | `lumiose/router` |
| `mount(fn, el)` | `render(fn, el)` (S, same signature and disposer) | `lumiose/dom` |

The renames don't change the bundle size. The `<Ctx value>` provider adds a few tens of bytes gzipped, partly offset by removing `provide`.

## Kept, with a documentation note

- `store`: a mutable proxy, like Valtio `proxy`, Vue `reactive` or S1 `createMutable`. Without the `create` prefix it promises no tuple, and it pairs with `snapshot`/`reconcile` as in S2.
- `resource`: a low-level S1 `createResource` (errors aren't thrown, and there's no tuple or `mutate`).
- `ref`: readable as a signal. `createRef` would promise `.current`.
- `renderToStream`: returns `Promise<RenderedShell>`.
- `invalidate`: see the data family.
- `prefetch="hover"`: Astro's word. The docs mention RR's `"intent"`.
- `ErrorBoundary`: the docs should name the fallback's second argument `reset` (S1, react-error-boundary) instead of `retry`.
- `url`/`params`/`route` exist in both `lumiose` (server-only, LUM4003 in the browser) and `lumiose/router` (reactive, also works on the server). Document the difference, and point the LUM4003 hint to `lumiose/router`.

Everything else keeps its name and already matches known vocabulary: `signal`, `computed`, `effect`, `batch`, `untrack`, `onMount`, `onCleanup`, `snapshot`, `createContext`, `Suspense`, `ErrorBoundary`, `Portal`, `Dynamic`, `Head`/`Title`/`Meta`, `fetchJSON`, `FetchError`, `submit`, `actionData`, `fail`, `href`, `redirect`, `notFound`, `error`, the request getters, `Link`, `navigate`, the `client:*`/`bind:*`/`on:*` JSX names and all types.

## doc-6 primitives

- **A. Scoped state:** `defineState(factory)` returns an accessor (`cart()`). The name is coined. The closest semantic match is Pinia's setup-style `defineStore`, but "store" already means our mutable proxy. The accessor gets no `use` prefix.
- **B. Async cache:**
  - `await query(key, fn)`, with the key first (TQ's positional form). The docs note that SR's `query(fn, name)` returns a wrapped function and ours does not.
  - `invalidate(...targets)`, variadic. A target is a URL string or a key array (prefix match). With no argument, it refreshes the whole page.
  - `submit(form, { invalidate: true | Target[] })`.
  - A dev warning when a string target doesn't look like a URL (`/…`, `./…`, `http(s):`). It catches `{ invalidate: ["stats"] }`, which is meant as a key but reads as a URL.
- **C. `reconcile(store, data, { key: "id" })`:** the S1/S2 name and default key. The store comes first because we have no setter.
- **D. Optimistic:** `optimistic(source)`, after R `useOptimistic` and S2 `createOptimistic`. It writes with the signal verbs plus a required promise, replacing the coined `.during()`: `likes.update((n) => n + 1, submit(event))`, `likes.set(v, promise)`. The overlay holds until the promise settles.
- **E. TanStack adapter:** TanStack's current Solid names: `useQuery`, `useMutation`, `useQueryClient`, and a `QueryClientProvider`. Solid Query v5 itself uses `use*`, so these are known names, not coined ones. Package name: `@lumiose/tanstack-query`, so it isn't confused with the core `query()`.

## Where the renames land

- **Spark** (`src/core`, `src/dom`, `src/app/router`):
  - Every rename except `submitting`. `src/core/server.ts` mirrors the core names.
  - `flushSync` has about 288 hits, mostly in tests.
  - Examples: spa-router-e2e, vite-counter, benchmarks/js-framework-benchmark.
- **Nova** (`src/app`): `submitting`, plus examples/ssr-bookshelf and benchmarks/fullstack/apps/lumiose.
- **Photon:**
  - No compiler-emitted import uses a renamed name; the Rust compiler only hardcodes `signal`.
  - `packages/vite` detects the HMR entry by its `mount` import from `lumiose/dom`, so that check must switch to `render`. Its tests also need updating.
- **Beacon:** `packages/cli` (`mount`), `apps/playground`, `packages/create`, and the docs pages plus `docs:gen`.
- **Chime:** spa-dotmatrix (`search`).
- **Halo:** site-kit (`mount`).
- **Quasar:** evals/tasks and benchmarks/fullstack (React apps unaffected).
- **Lux:** doc-6 and the decisions that quote old names.
