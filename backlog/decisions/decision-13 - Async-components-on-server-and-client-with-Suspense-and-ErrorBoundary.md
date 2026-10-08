---
id: decision-13
title: Async components on server and client with Suspense and ErrorBoundary
date: '2026-10-08 11:25'
status: accepted
---
## Context

Spec v0.1 allowed `async` components only on the server, and used `resource()` with `<Suspense>` on the client. The user asked for async components on the client as well.

An alternative was discussed: `fallback` and `catch` special props on async components, plus a single `<Boundary>`. The user chose to keep `<Suspense>` instead (2026-10-08).

## Decision

**Async components everywhere.** Any component may be an `async function`, on the server and on the client.

**Await rewrite.** The compiler rewrites each `await` inside a component so that the reactive owner and tracking context is restored after the await resumes. This is the Svelte 5 technique, needed because browsers have no AsyncContext yet.

**Re-running.**
- Props and signals read in the component body are tracked, including reads after an `await`.
- When a tracked input changes, the component re-runs. The previous run is aborted through `lifetime()`.
- The stale UI stays visible until the new run resolves. `pending()` exposes the in-flight state.
- JSX bindings stay fine-grained and never re-run the body.
- Reading the component's own signals in the body, outside JSX, triggers a warning (`LUM2007`).

**Pending and error UI.**
- `<Suspense fallback>` shows its fallback while async descendants are pending. This applies on first load only, not on re-runs.
- `<ErrorBoundary fallback={(error, retry) => …}>` handles rejections.
- With no boundary:
  - the server waits for the component (in-order streaming);
  - the client renders nothing until it resolves;
  - errors go to the route's `_error` page.

**Streaming.** On the server, each `<Suspense>` is an out-of-order streaming point.

**Hydration.** The resolved values of awaits are serialized as plain data into the island records, so hydration never fetches again. Values that are not serializable trigger `LUM4007`.

**`resource()`** stays as a low-level primitive for on-demand loading. Async components are the documented default for loading data.

## Consequences

- A single data-loading idiom (`async` + `await`) works on server and client.
- Spec v0.1's `LUM4005` rule ("no async components in client graphs") is dropped.
- The runtime needs boundary bookkeeping (about 0.5 kB) and the compiler needs the `await` rewrite.
- Everything awaited inside an island is sent to the client. The docs and `LUM4007` must make this explicit.

