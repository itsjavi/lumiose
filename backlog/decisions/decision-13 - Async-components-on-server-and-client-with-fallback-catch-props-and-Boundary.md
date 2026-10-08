---
id: decision-13
title: Async components on server and client with fallback/catch props and Boundary
date: '2026-10-08 11:20'
status: proposed
---
## Context

Spec v0.1 allowed `async` components only on the server and used `resource()` + `<Suspense>` on the client. The user asked for async components on the client too. They also asked whether every async component could take a `fallback` prop, in the same way that `key` and `ref` are special props, removing the need for Suspense.

React requires a separate `<Suspense>` wrapper plus an `<ErrorBoundary>` class or library, which are two extra concepts. Svelte uses `{#await}` blocks, and Solid 2 uses `<Loading>` + `<Errored>`.

## Decision

**Async components everywhere.** Any component may be an `async function`, on the server and on the client.
- The compiler rewrites each `await` in a component so that the owner and tracking context is restored after it resumes, as Svelte 5 does. Browsers have no AsyncContext yet.
- Props and signals read in the component body, including after an `await`, are tracked. When one changes, the component re-runs:
  - the previous run is aborted through `lifetime()`;
  - the stale UI stays visible until the new run resolves;
  - `pending()` exposes the in-flight state.
- JSX bindings stay fine-grained and never re-run the body. Reading the component's own signals in the body outside JSX triggers a warning (`LUM2007`).

**Special props on async components only.** `fallback` (shown while pending) and `catch={(error, retry) => …}` (shown on rejection).
- They are typed through `JSX.LibraryManagedAttributes`, so passing either one to a sync component is a type error. This was verified on TS 7.0.2, with `JSX.ElementType` allowing `Promise<Element>` returns.
- An async component may not declare its own props with these names (`LUM2008`).
- A component that receives either prop becomes a boundary: the fallback shows on first load only, not on re-runs.

**`<Boundary fallback catch>`** replaces both `<Suspense>` and `<ErrorBoundary>`, and uses the same two props.
- Use it to give several async components, or deep async descendants, one shared fallback or error UI, and to avoid staggered loading.
- An async component without its own `fallback` or `catch` defers to the nearest `<Boundary>`.
- If there is no boundary at all:
  - the server waits for it (in-order streaming);
  - the client renders nothing until it resolves;
  - a rejection propagates to the route's `_error` page.

**Streaming.** Every boundary is an out-of-order streaming point on the server. That covers both a component with `fallback` and a `<Boundary>`.

**Hydration.** The resolved values of a component's awaits are serialized as plain data into its island's records, so hydration never fetches again. Values that are not serializable trigger `LUM4007`.

**Other primitives.** `resource()` stays as a low-level primitive for on-demand loading. Async components are the documented default for data.

## Consequences

- One concept covers data loading on both server and client: `async` plus `fallback` / `catch`, with `<Boundary>` only for grouping.
- Spec v0.1's `LUM4005` (no async components in client code) is dropped.
- The runtime needs boundary bookkeeping, roughly 0.5 kB extra, and the compiler needs the `await` rewrite.
- Whether a component is async is known only at runtime when it is imported from another module. Types enforce correct prop usage, and the runtime handles the Promise.
- Everything awaited inside an island is sent to the client. The docs and the `LUM4007` check must make this explicit.

