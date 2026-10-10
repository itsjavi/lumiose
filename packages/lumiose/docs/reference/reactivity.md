# `lumiose`: reactivity

> Signatures and behavior of the reactive core exported by `lumiose`: signals, computeds, effects, stores, owners, context, scoped state and in-flight state.

All of these are exported by `lumiose` in the browser and on the server. On the server (the `node`
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

## getAbortSignal

```ts
function getAbortSignal(): AbortSignal;
```

An `AbortSignal` for the current owner. Aborted when the owner is disposed, when an effect re-runs,
or when an async component run is superseded. On the server it is the request's signal. Throws
outside an owner (with a message in development). Svelte has the same function.

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

## flush

```ts
function flush(): void;
```

Runs pending computeds, DOM bindings and effects now, instead of in the next microtask.

## store

```ts
function store<T extends object>(value: T): T;
```

Wraps a plain object or array in a deep, **mutable** reactive proxy, like Valtio's `proxy`, Vue's
`reactive` or Solid's `createMutable`: you write to it directly (`state.count++`,
`state.items.push(item)`), with no setter. Reads track per property, writes notify only on change,
array methods work. Class instances, `Map`s, `Set`s and frozen objects are returned as is.

## snapshot

```ts
function snapshot<T>(value: T): T;
```

A deep plain copy of a store, of a value inside one (`snapshot(state.items)`), or of plain data
that holds stores. Plain objects and arrays are copied; other values (`Date`s, `Map`s, class
instances) are kept as they are, and shared or circular references stay shared. Use it where a
proxy does not work: `structuredClone()` and `postMessage()` (to a worker or an AudioWorklet)
throw on proxies, and a copy does not change when the store does (saving, undo history). Reads
are not tracked: in an effect, read the properties it should react to. On the server it copies the
plain object.

```ts
const song = store({ title: "Demo", rows: [] as number[][] });
worker.postMessage({ type: "song", song: snapshot(song) });
```

## reconcile

```ts
function reconcile<T extends object>(target: T, data: T, options?: ReconcileOptions): void;

interface ReconcileOptions {
  key?: string; // identifies array items, default "id"
}
```

Patches fresh `data` (a fetch result, a server payload) into a store, or into an object or array
inside one (`reconcile(state.books, fresh)`), in place, with Solid's `reconcile` semantics:

- Array items are matched by reference, or by `key` when the new item has it. Items without the
  key are merged into the item at the same index when that item has no key either; unmatched
  items are inserted as new values, and leftovers are removed. Keys should be unique: new items
  that share a key end up as the same store item.
- Matched objects are merged deeply; an object whose `key` differs from the old one is replaced.
- Keys missing from `data` are deleted. Primitives and other values (`Date`s, `Map`s, class
  instances) are replaced.

Unchanged items keep their identity, so keyed list rows, their DOM and their local state survive,
and only properties whose value changed notify, all in one batch. Reads are not tracked, so it is
safe in an effect. `target` and `data` must be the same kind (both arrays or both plain objects),
otherwise it throws a `TypeError` in development. Pass the store, not plain data: a plain object is patched
without notifying anything (that is what happens on the server, where stores are plain objects).

```ts
const books = store<Book[]>([]);
reconcile(books, (await (await fetch("/api/books")).json()) as Book[]);

const page = store({ rows: [{ slug: "intro", views: 1 }] });
reconcile(page.rows, [{ slug: "intro", views: 2 }], { key: "slug" });
```

## createContext, useContext

```ts
function createContext<T>(defaultValue: T): Context<T>;
function createContext<T>(): Context<T | undefined>;
function useContext<T>(context: Context<T>): T;
interface Context<T> {
  (props: { value: T; children?: JSX.Element }): JSX.Element; // the provider component
  readonly id: symbol;
  readonly defaultValue: T;
}
```

A context is also its provider component, as in React 19 and Solid 2: `<Theme value="dark">…</Theme>`
provides `value` to everything rendered inside it, including content rendered later (conditionals,
lists). `useContext` returns the value of the nearest provider above, or the default. A nested
provider of the same context shadows the outer one for its subtree. Context survives `await` in
async components. Islands start a new root ([LUM4010](../errors/LUM4010.md)).

The provider reads `value` once, when it renders, like Solid's provider and like every component
prop read in a component body: components run once. To share state that changes, provide a signal,
a store or an object with getters, and read it where it is used.

```tsx
const Theme = createContext("light");
const Count = createContext(signal(0));

<Theme value="dark">
  <Count value={signal(5)}>
    <Toolbar /> {/* useContext(Theme) is "dark"; useContext(Count)() is reactive */}
  </Count>
</Theme>;
```

## defineState

```ts
function defineState<T>(factory: () => T): () => T;
```

Scoped state: returns an accessor whose `factory` runs on the first call, once per scope, and
returns the same instance after that.

| Scope          | One instance per                                                                       |
| -------------- | -------------------------------------------------------------------------------------- |
| Browser        | page: shared by every island and the SPA tree                                          |
| Server         | request: middleware, endpoints, actions and the render share it; never across requests |
| Tests (Vitest) | test: `@lumiose/vite` resets scoped state before each test                             |

The factory runs outside the component tree: it sees no context and its reads are not tracked; in
the browser its effects live as long as the page. On the server it may read request APIs
(`cookies()`, `locals()`, …), which do not exist in the browser: guard them with
`import.meta.env.SSR`. Calling an accessor on the server outside a request or render (at module
scope) throws.

**Sent to the browser.** When islands or SPA routes import the state, a page that created it
sends what the factory returned that the browser cannot rebuild: the returned signal or store
itself, or the top-level signals and stores of the returned object. Computeds and functions are
not sent; the factory runs again in the browser and the server values replace its signals and
stores before any island reads them, so hydration matches. Values go once per page, in the chunk
(shell or streamed boundary) where the state was first used, and must be plain data like island
props ([LUM4011](../errors/LUM4011.md)). States that only server code imports are never sent.
Everything a sent state holds is public: never put secrets in it.

Define states at module scope with `export const x = defineState(…)` (or export the binding):
`@lumiose/vite` names each one after its module and export, the way it names islands. States
created elsewhere (inside a function) are never sent.

```ts
import { computed, cookies, defineState, signal } from "lumiose";

export const prefs = defineState(() => {
  const theme = signal(import.meta.env.SSR ? (cookies().get("theme") ?? "light") : "light");
  return { theme, dark: computed(() => theme() === "dark") };
});
// prefs().theme(), prefs().dark(), prefs().theme.set("dark")
```

## isPending

```ts
function isPending(): boolean;
```

Inside an async component (its body or its UI): whether a **re-run** is in flight. The first load is
not a re-run (`<Suspense>` covers it). Reading it in the body does not re-run the component.
Always `false` on the server.

## isBusy

```ts
function isBusy(): boolean;
```

App-wide: whether anything is in flight: an async component run, a `<Suspense>` showing its
fallback, a form submission (`submit()`), an SPA navigation or a request of the async cache
(`fetchJSON`, `query`), background refetches included. Reactive. Always `false` on the
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

## optimistic

```ts
function optimistic<T>(source: () => T): Optimistic<T>;

interface Optimistic<T> {
  (): T; // source() with the pending overlays applied in order, tracked
  set(value: T, promise: PromiseLike<unknown>): void;
  update(fn: (value: T) => T, promise: PromiseLike<unknown>): void;
}
```

A value that follows `source` (a getter such as `() => props.likes`, or a signal), plus overlays
held while their promises are pending. Each `set`/`update` applies at once and drops when its own
promise settles, either way: on success the (refreshed) source shows, on failure the value rolls
back. Concurrent overlays apply in call order over the latest source value, so an `update` is
re-applied when the source changes. A rejection is not re-thrown; await the promise itself to
handle it. Writes stop when the owner is disposed. On the server it reads `source()` and `set`/`update`
do nothing. See [optimistic updates](../concepts/data-and-actions.md#optimistic-updates).

## Example

```tsx check
import { batch, effect, getAbortSignal, onCleanup, resource, signal, untrack } from "lumiose";

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
      {String(getAbortSignal().aborted)}
    </p>
  );
}
```
