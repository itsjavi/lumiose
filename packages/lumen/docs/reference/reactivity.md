# `lumen`: reactivity

> Signatures and behavior of the reactive core exported by `lumen`: signals, computeds, effects, stores, owners, context and in-flight state.

All of these are exported by `lumen` in the browser and on the server. On the server (the `node`
entry) signals are plain cells, computeds evaluate once per request, and `effect`/`onMount` never
run. Concepts: [Signals and reactivity](../concepts/signals.md).

## signal

```ts
function signal<T>(value: T, options?: SignalOptions<T>): Signal<T>;

interface Signal<T> {
  (): T; // read (tracked)
  set(value: T): void;
  update(fn: (value: T) => T): void;
  peek(): T; // read without tracking
}
interface SignalOptions<T> {
  /** When a write counts as a change. Default Object.is; false: every write is a change. */
  equals?: false | ((a: T, b: T) => boolean);
}
```

## computed

```ts
function computed<T>(fn: (previous: T | undefined) => T, options?: SignalOptions<T>): Computed<T>;
type Computed<T> = () => T;
```

Lazy (runs on first read), cached, glitch-free. `fn` must be pure: no signal writes (`LUM2002`).
An unobserved computed unlinks itself from its sources.

## effect

```ts
function effect(fn: EffectFn): () => void;
type EffectFn = () => void | (() => void);
```

Runs `fn` after the DOM updates, then again whenever a signal it read changes. A returned function
is a cleanup, run before the next run and on disposal. Returns a disposer. Owned by the current
owner, so it is disposed with the component.

## onMount

```ts
function onMount(fn: EffectFn): void;
```

Runs `fn` once, untracked, after the current owner's DOM is mounted. It may return a cleanup.

## onCleanup

```ts
function onCleanup(fn: () => void): void;
```

Registers `fn` on the current owner: it runs when the owner is disposed (or, for an effect, before
its next run).

## lifetime

```ts
function lifetime(): AbortSignal;
```

An `AbortSignal` for the current owner. Aborted when the owner is disposed, when an effect re-runs,
or when an async component run is superseded. On the server it is the request's signal. Throws
outside an owner.

## untrack

```ts
function untrack<T>(fn: () => T): T;
```

Runs `fn` without subscribing the current scope to the signals it reads.

## batch

```ts
function batch<T>(fn: () => T): T;
```

Defers dependents until `fn` returns, so they run once. Delegated event handlers are batched
automatically.

## flushSync

```ts
function flushSync(): void;
```

Runs pending computeds, DOM bindings and effects now, instead of in the next microtask.

## store

```ts
function store<T extends object>(value: T): T;
```

Wraps a plain object or array in a deep reactive proxy: reads track per property, writes notify
only on change, array methods work. Class instances, `Map`s, `Set`s and frozen objects are returned
as is.

## createContext, provide, inject

```ts
function createContext<T>(defaultValue: T): Context<T>;
function createContext<T>(): Context<T | undefined>;
function provide<T>(context: Context<T>, value: T): void;
function inject<T>(context: Context<T>): T;
interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}
```

`provide` sets a value on the current owner for everything created below it; `inject` returns the
nearest provided value, or the default. Context survives `await` in async components.

## pending

```ts
function pending(): boolean;
```

Inside an async component (its body or its UI): whether a **re-run** is in flight. The first load is
not a re-run (`<Suspense>` covers it). Reading it in the body does not re-run the component.
Always `false` on the server.

## busy

```ts
function busy(): boolean;
```

App-wide: whether anything is in flight: an async component run, a `<Suspense>` showing its
fallback, a form submission (`submit()`) or an SPA navigation. Reactive. Always `false` on the
server.

## resource

```ts
function resource<T>(fetcher: (signal: AbortSignal) => T | PromiseLike<T>): Resource<T>;

interface Resource<T> {
  (): T | undefined; // latest value, tracked
  loading(): boolean;
  error(): unknown;
  refetch(): void; // aborts a load in flight and loads again
}
```

Low-level on-demand loading. `fetcher` runs now and whenever a signal it read synchronously
changes; its `AbortSignal` aborts when superseded or disposed. The first load counts as pending
for the nearest `<Suspense>`. Errors are not thrown: read `error()`. Browser only: on the server it
stays loading. Prefer [async components](../concepts/async.md).

## Example

```tsx check
import { batch, effect, lifetime, onCleanup, resource, signal, untrack } from "lumen";

export function Clock() {
  const now = signal(new Date());
  const timer = setInterval(() => now.set(new Date()), 1000);
  onCleanup(() => clearInterval(timer));

  const first = signal("Ada");
  const last = signal("Lovelace");
  const rename = () =>
    batch(() => {
      first.set("Grace");
      last.set("Hopper");
    });

  effect(() => {
    console.log(`${first()} ${last()} at`, untrack(now).toISOString());
  });

  const user = resource((signal) =>
    fetch(`/api/users/${first()}`, { signal }).then((res) => res.json() as Promise<{ id: string }>),
  );

  return (
    <p onClick={rename}>
      {now().toLocaleTimeString()} · {user.loading() ? "…" : user()?.id}
      {String(lifetime().aborted)}
    </p>
  );
}
```
