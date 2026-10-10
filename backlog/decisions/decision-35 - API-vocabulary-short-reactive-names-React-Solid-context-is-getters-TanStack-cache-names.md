---
id: decision-35
title: >-
  API vocabulary: short reactive names, React-Solid context, is-getters,
  TanStack cache names
date: '2026-10-10 18:13'
status: accepted
---
## Context

decision-32 says public names reuse React, Solid and TanStack vocabulary when the behaviour matches. The audit in TASK-190 (doc-7) applied that rule to every public export and to the doc-6 primitives. The user approved its recommendations on 2026-10-10, with one change: the TanStack adapter keeps the package name `@lumiose/query`. Earlier the same day the user decided that renames ship outright: a breaking 0.x change with a changelog migration table and no deprecated aliases.

## Decision

- **Naming rule:** take the known name exactly when our behaviour matches. Drop a `create*` prefix when it would promise Solid's `[get, set]` tuple, and a `use*` prefix when it would promise React re-rendering. Never put `use` on a name we coin ourselves.
- **Reactive primitives:** short names stay: `signal`, `computed`, `effect`, `batch`, `untrack`, `store` (documented as mutable), `snapshot`, `reconcile`, `resource`. `flushSync` becomes `flush` (Solid 2).
- **Context:** `createContext`, the `<Ctx value={v}>` provider component, and `useContext` (React 19 and Solid 2). `provide` and `inject` are removed.
- **In-flight state:** `isPending`, `isBusy` (coined, after `aria-busy`), `isSubmitting` and `isNavigating` replace `pending`, `busy`, `submitting` and `navigating`.
- **Lifecycle:** `onMount`, `onCleanup`. `getAbortSignal()` (Svelte) replaces `lifetime()`.
- **Router and DOM:**
  - `search`, `Search` and `SearchInit` become `searchParams`, `SearchParams` and `SearchParamsInit`.
  - `mount` becomes `render` (Solid).
- **Kept as they are:** the request getters `url`, `params` and `route` stay in both `lumiose` and `lumiose/router`. The docs explain the difference, and the LUM4003 hint points to `lumiose/router`.
- **doc-6 primitives:**
  - `defineState(factory)` returns an accessor. The name is coined, after Pinia's `defineStore`.
  - `await query(key, fn)`, `invalidate(...targets)` with URL strings or key arrays, and `submit(form, { invalidate })`.
  - `optimistic(source)` with `.set(value, promise)` and `.update(fn, promise)`.
  - The `@lumiose/query` package exposes TanStack's `useQuery`, `useMutation`, `useQueryClient` and `QueryClientProvider`.

## Consequences

- TASK-191 applies the renames across the runtime, `packages/vite` (the HMR entry detection keys on the `render` import), tooling, examples, apps, docs and evals, with a migration table in the changelog.
- TASK-193, TASK-195, TASK-196 and TASK-197 use these names. doc-6 and doc-7 are updated to match.
