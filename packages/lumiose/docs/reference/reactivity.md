# `lumiose`: reactivity

> Signatures of the reactive core: signals, computeds, effects, stores, context, ids and scoped state.

All of these are exported by `lumiose` in the browser and on the server. On the server (the `node`
entry) signals are plain cells, computeds evaluate once per request, and `effect`/`onMount` never
run. Concepts: [Signals and reactivity](../concepts/signals.md).

The reactive core is a push-pull signal graph (the alien-signals algorithm). Reading a signal
inside a tracked scope (a JSX binding, a `computed`, an `effect`) subscribes that scope; writing
the signal marks it dirty and re-runs only what depends on it. Reads are synchronous: `count()`
always returns the current value, even right after a write.

## Owners

Every component, effect and root is an _owner_. Owners scope cleanups (`onCleanup`), context
(`<Ctx value>`/`useContext`), error handling and `getAbortSignal()`. Disposing an owner disposes
everything created under it.

## signal

Creates a reactive value: a function that reads it, with `set`, `update` and `peek`.

A write that is `Object.is`-equal to the current value is not a change. So
`list().push(x); list.set(list())` changes nothing: write a new value
(`list.update((l) => [...l, x])`), use `store()`, or create the signal with `{ equals: false }`.

```ts
function signal<T>(value: T, options?: SignalOptions<T>): Signal<T>;

interface Signal<T> {
  (): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  peek(): T;
}
interface SignalOptions<T> {
  equals?: false | ((a: T, b: T) => boolean);
}
```

```tsx check
import { signal } from "lumiose";

export function Counter() {
  const count = signal(0);
  const add = () => count.update((n) => n + 1);
  return <button onClick={add}>Clicked {count()} times</button>;
}
```

| Name             | Type                                 | Default     | Description                                                        |
| ---------------- | ------------------------------------ | ----------- | ------------------------------------------------------------------ |
| `value`          | `T`                                  | —           | The initial value.                                                 |
| `options.equals` | `false \| ((a: T, b: T) => boolean)` | `Object.is` | When a write counts as a change. `false`: every write is a change. |

| Member       | Type   | Description                       |
| ------------ | ------ | --------------------------------- |
| `()`         | `T`    | Reads the value (tracked).        |
| `set(value)` | `void` | Writes a value.                   |
| `update(fn)` | `void` | Writes `fn` of the current value. |
| `peek()`     | `T`    | Reads without tracking.           |

## computed

Creates a read-only value derived from other signals.

Lazy (runs on first read), cached, glitch-free. `fn` must be pure: no signal writes (`LUM2002`).
An unobserved computed unlinks itself from its sources.

```ts
function computed<T>(fn: (previous: T | undefined) => T, options?: SignalOptions<T>): Computed<T>;

type Computed<T> = () => T;
```

```tsx check
import { computed, signal } from "lumiose";

export function Cart() {
  const prices = signal([12, 30]);
  const sum = (a: number, b: number) => a + b;
  const total = computed(() => prices().reduce(sum, 0));
  return <p>Total: {total()}</p>;
}
```

| Name             | Type                                 | Default     | Description                                                                                    |
| ---------------- | ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------- |
| `fn`             | `(previous: T \| undefined) => T`    | —           | Computes the value from the signals it reads. It receives the previous value and must be pure. |
| `options.equals` | `false \| ((a: T, b: T) => boolean)` | `Object.is` | When a write counts as a change. `false`: every write is a change.                             |

## effect

Runs `fn` after the DOM updates, then again whenever a signal it read changes. A returned function
is a cleanup, run before the next run and on disposal. Returns a disposer. Owned by the current
owner, so it is disposed with the component.

The effects queued in a flush all run before the DOM bindings that their writes trigger; those
writes then render together, and the effects they schedule run after that, in the same flush. So
an effect sees the current value of a signal that an earlier effect of the same pass wrote, but
not yet its DOM.

- **Measuring, in one effect, what another effect's write renders** measures the previous layout,
  because the effects of a pass all run before their writes reach the DOM. Read the written signal
  in the effect that measures: it re-runs once the DOM shows the write.
- **Deriving state in an effect** (`effect(() => b.set(a() * 2))`) adds a frame of staleness and an
  extra flush. Use `computed(() => a() * 2)`.

```ts
function effect(fn: EffectFn): () => void;
type EffectFn = () => void | (() => void);
```

```tsx check
import { effect, signal } from "lumiose";

export function TitleField() {
  const title = signal("Inbox");
  effect(() => {
    document.title = title();
  });
  return <input bind:value={title} />;
}
```

| Name | Type       | Default | Description                                                                              |
| ---- | ---------- | ------- | ---------------------------------------------------------------------------------------- |
| `fn` | `EffectFn` | —       | The function to run. Signals it reads are tracked; a function it returns is its cleanup. |

## onMount

Runs `fn` once, untracked, after the current owner's DOM is mounted. It may return a cleanup.

```ts
function onMount(fn: EffectFn): void;
```

```tsx check
import { onMount, signal } from "lumiose";

export function WindowWidth() {
  const width = signal(0);
  onMount(() => {
    const update = () => width.set(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });
  return <p>{width()} px wide</p>;
}
```

| Name | Type       | Default | Description                                                              |
| ---- | ---------- | ------- | ------------------------------------------------------------------------ |
| `fn` | `EffectFn` | —       | Runs once, untracked, after mount. A function it returns is its cleanup. |

## onCleanup

Registers `fn` on the current owner: it runs when the owner is disposed (or, for an effect, before
its next run).

```ts
function onCleanup(fn: () => void): void;
```

```tsx check
import { onCleanup, signal } from "lumiose";

export function Clock() {
  const now = signal(new Date());
  const timer = setInterval(() => now.set(new Date()), 1000);
  onCleanup(() => clearInterval(timer));
  return <time>{now().toLocaleTimeString()}</time>;
}
```

| Name | Type         | Default | Description                                                                        |
| ---- | ------------ | ------- | ---------------------------------------------------------------------------------- |
| `fn` | `() => void` | —       | Runs when the current owner is disposed (for an effect, also before its next run). |

## getAbortSignal

An `AbortSignal` for the current owner. Aborted when the owner is disposed, when an effect re-runs,
or when an async component run is superseded. On the server it is the request's signal. Throws
outside an owner (with a message in development). Svelte has the same function.

```ts
function getAbortSignal(): AbortSignal;
```

```tsx check
import { getAbortSignal } from "lumiose";

export async function UserName(props: { id: string }) {
  const res = await fetch(`/api/users/${props.id}`, {
    signal: getAbortSignal(),
  });
  const user = (await res.json()) as { name: string };
  return <p>{user.name}</p>;
}
```

## untrack

Runs `fn` without subscribing the current scope to the signals it reads.

```ts
function untrack<T>(fn: () => T): T;
```

```tsx check
import { effect, signal, untrack } from "lumiose";

export function Search() {
  const query = signal("");
  const page = signal(1);
  // Runs when query changes, not when page does.
  effect(() => {
    console.log("search", query(), untrack(page));
  });
  return <input bind:value={query} />;
}
```

| Name | Type      | Default | Description                                                                       |
| ---- | --------- | ------- | --------------------------------------------------------------------------------- |
| `fn` | `() => T` | —       | Runs at once; the signals it reads are not tracked. `untrack` returns its result. |

## batch

Defers dependents until `fn` returns, so they run once. Event handlers are batched automatically,
for the duration of the handler: delegated `onX` handlers, native `on:x` listeners, the direct
listeners of non-bubbling events (`onFocus`, `onScroll`) and handlers passed in a spread. Their
writes render together when the handler returns, so the DOM is current right after the event
(decision-81). Any other write schedules a microtask flush.

```ts
function batch<T>(fn: () => T): T;
```

```ts check
import { batch, type Signal } from "lumiose";

export function rename(first: Signal<string>, last: Signal<string>): void {
  batch(() => {
    first.set("Grace");
    last.set("Hopper");
  });
}
```

| Name | Type      | Default | Description                                                                                               |
| ---- | --------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `fn` | `() => T` | —       | Runs at once; dependents of the signals it writes run once, after it returns. `batch` returns its result. |

## flush

Runs pending computeds, DOM bindings and effects now, instead of in the next microtask. Effects
never run synchronously with a write: in tests, call `flush()` after a write before asserting.

**Flush order:** computeds are pulled, then DOM bindings run (parents before children), then user
effects. The effects queued at that point all run before the DOM bindings that their own writes
trigger, so effects that measure the DOM and then write share one layout. Then those bindings
run, then the effects that the writes scheduled. A later effect of the same pass reads the new
signal values, but the DOM does not show them yet. A conditional or list around a queued effect
that such a write changed still updates first, so an effect never runs inside content that an
earlier effect's write removed.

```ts
function flush(): void;
```

```ts check
import { effect, flush, signal } from "lumiose";

export function latestSeen(): number {
  const count = signal(0);
  let seen = -1;
  effect(() => {
    seen = count();
  });
  count.set(5);
  flush();
  return seen; // 5
}
```

## store

Creates a deep reactive object or array that you mutate directly.

Wraps a plain object or array in a deep, **mutable** reactive proxy, like Valtio's `proxy`, Vue's
`reactive` or Solid's `createMutable`: you write to it directly (`state.count++`,
`state.items.push(item)`), with no setter. Reads track per property, writes notify only on change,
array methods work. Class instances, `Map`s, `Set`s and frozen objects are returned as is.

```ts
function store<T extends object>(value: T): T;
```

```tsx check
import { store } from "lumiose";

export function Todos() {
  const state = store({ items: ["Write docs"] });
  const add = () => {
    state.items.push("Ship it");
  };
  return <button onClick={add}>{state.items.length} items</button>;
}
```

| Name    | Type | Default | Description                                                                                             |
| ------- | ---- | ------- | ------------------------------------------------------------------------------------------------------- |
| `value` | `T`  | —       | A plain object or array to wrap. Class instances, `Map`s, `Set`s and frozen objects are returned as is. |

## snapshot

A deep plain copy of a store, of a value inside one (`snapshot(state.items)`), or of plain data
that holds stores. Plain objects and arrays are copied; other values (`Date`s, `Map`s, class
instances) are kept as they are, and shared or circular references stay shared. Use it where a
proxy does not work: `structuredClone()` and `postMessage()` (to a worker or an AudioWorklet)
throw on proxies, and a copy does not change when the store does (saving, undo history). Reads
are not tracked: in an effect, read the properties it should react to. On the server it copies the
plain object.

```ts
function snapshot<T>(value: T): T;
```

```ts
const song = store({ title: "Demo", rows: [] as number[][] });
worker.postMessage({ type: "song", song: snapshot(song) });
```

| Name    | Type | Default | Description                                                   |
| ------- | ---- | ------- | ------------------------------------------------------------- |
| `value` | `T`  | —       | A store, a value inside one, or plain data that holds stores. |

## reconcile

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
function reconcile<T extends object>(target: T, data: T, options?: ReconcileOptions): void;

interface ReconcileOptions {
  key?: string;
}
```

```ts
const books = store<Book[]>([]);
reconcile(books, (await (await fetch("/api/books")).json()) as Book[]);

const page = store({ rows: [{ slug: "intro", views: 1 }] });
reconcile(page.rows, [{ slug: "intro", views: 2 }], { key: "slug" });
```

| Name          | Type     | Default | Description                                                                       |
| ------------- | -------- | ------- | --------------------------------------------------------------------------------- |
| `target`      | `T`      | —       | The store, or an object or array inside one, to patch.                            |
| `data`        | `T`      | —       | The fresh data, of the same kind as `target` (both arrays or both plain objects). |
| `options.key` | `string` | `"id"`  | The property that identifies array items across updates.                          |

## createContext, useContext

`createContext` creates a context, and `useContext` reads the value of its nearest provider.

A context is also its provider component, as in React 19 and Solid 2: `<Theme value="dark">…</Theme>`
provides `value` to everything rendered inside it, including content rendered later (conditionals,
lists). `useContext` returns the value of the nearest provider above, or the default. A nested
provider of the same context shadows the outer one for its subtree. Context survives `await` in
async components. Islands start a new root ([LUM4010](../errors/LUM4010.md)).

The provider reads `value` once, when it renders, like Solid's provider and like every component
prop read in a component body: components run once. To share state that changes, provide a signal,
a store or an object with getters, and read it where it is used.

```ts
function createContext<T>(defaultValue: T): Context<T>;
function createContext<T>(): Context<T | undefined>;
function useContext<T>(context: Context<T>): T;

interface Context<T> {
  (props: { value: T; children?: JSX.Element }): JSX.Element;
  readonly id: symbol;
  readonly defaultValue: T;
}
```

```tsx
const Theme = createContext("light");
const Count = createContext(signal(0));

<Theme value="dark">
  <Count value={signal(5)}>
    <Toolbar /> {/* useContext(Theme) is "dark"; useContext(Count)() is reactive */}
  </Count>
</Theme>;
```

| Name           | Type         | Default     | Description                                          |
| -------------- | ------------ | ----------- | ---------------------------------------------------- |
| `defaultValue` | `T`          | `undefined` | What `useContext` returns when no provider is above. |
| `context`      | `Context<T>` | —           | The context to read.                                 |

| Member         | Type          | Description                                       |
| -------------- | ------------- | ------------------------------------------------- |
| `(props)`      | `JSX.Element` | The provider component: `<Ctx value={v}>…</Ctx>`. |
| `id`           | `symbol`      | The context's unique key.                         |
| `defaultValue` | `T`           | The default passed to `createContext`.            |

## useId

Returns an id that is unique in the page, for `id`/`for`, `aria-labelledby`, `aria-describedby`,
`aria-controls` and the like. Call it in a component's setup, once per id you need; each call returns
the instance's next id. The id is a valid HTML id and CSS identifier (`l0-0-1-0`, `ls3`, `lc7`), so
it also works in selectors and as a `view-transition-name`. Do not parse it: the format may change.

- **Server and hydration.** Inside an island (and an SPA, which is one), the server builds the id
  from the island's id and the component instance's position in it, and hydration computes the same
  id, so the server's `for`/`id` pairs stay as they are. Outside islands, server ids follow the
  render tree, so the same page renders the same ids whatever order its async content resolves in.
- **Browser only.** Content rendered in the browser after hydration, or by
  [`render()`](dom.md#render), gets ids from a counter.
- **Several apps on one page.** Give each a prefix: `render(code, container, { idPrefix: "cart-" })`,
  or `renderToStream(root, { idPrefix })` on the server, which the page's islands reuse when they
  hydrate. Ids then start with the prefix.
- **Async components.** Each run of an async component runs its body again, so a re-run after a
  signal it read changed gets new ids, as its other locals are new too.

```ts
function useId(): string;
```

```tsx check
import { useId } from "lumiose";

export function EmailField(props: { label: string; hint: string }) {
  const id = useId();
  const hintId = useId();
  return (
    <p>
      <label for={id}>{props.label}</label>
      <input id={id} type="email" aria-describedby={hintId} />
      <small id={hintId}>{props.hint}</small>
    </p>
  );
}

export function SignUp() {
  const title = useId();
  return (
    <form aria-labelledby={title}>
      <h2 id={title}>Sign up</h2>
      <EmailField label="Email" hint="We never share it." />
      <EmailField label="Backup email" hint="Optional." />
    </form>
  );
}
```

## defineState

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
[`isServer`](#isserver). Calling an accessor on the server outside a request or render (at module
scope) throws.

**Sent to the browser.** When islands or SPA routes import the state, a page that created it
sends what the factory returned that the browser cannot rebuild: the returned signal or store
itself, or the top-level signals and stores of the returned object. Computeds and functions are
not sent; the factory runs again in the browser and the server values replace its signals and
stores before any island reads them, so hydration matches. Values go once per page, in the chunk
(shell or streamed boundary) where the state was first used, and must be plain data like island
props ([LUM4011](../errors/LUM4011.md)). States that only server code imports are never sent.
Everything a sent state holds is **public**: everyone who can load the page can read it in its
source. Never put secrets in a state that islands use.

Define states at module scope with `export const x = defineState(…)` (or export the binding):
`@lumiose/vite` names each one after its module and export (`/src/lib/cart.ts#cart`), the way it
names islands. States created elsewhere (inside a function) are never sent.

```ts
function defineState<T>(factory: () => T): () => T;
```

```ts
import { computed, cookies, defineState, isServer, signal } from "lumiose";

export const prefs = defineState(() => {
  const theme = signal(isServer ? (cookies().get("theme") ?? "light") : "light");
  return { theme, dark: computed(() => theme() === "dark") };
});
// prefs().theme(), prefs().dark(), prefs().theme.set("dark")
```

| Name      | Type      | Default | Description                                                                |
| --------- | --------- | ------- | -------------------------------------------------------------------------- |
| `factory` | `() => T` | —       | Creates the state. Runs on the first call of the accessor, once per scope. |

### Scoped state on the server and in tests

**Islands.** Each [island](../concepts/islands.md) hydrates as its own root, so context provided by the page
does not reach an island, and one island cannot provide to another. The server renders islands
the same way, so their HTML matches. Islands share the Lumiose runtime and the modules they import,
so islands share state through **scoped state**.

**Scoped state on the server.** The factory runs per request, so it can seed itself from the
request (`cookies()`, `locals()`, …); there is no separate seed API. What the page then sends to
the browser is under **Sent to the browser**, above.

**Scoped state in tests.** Under Vitest, `@lumiose/vite` resets scoped state before each test: each
test starts with fresh instances, in DOM tests and in server tests (where calls outside a render
share one instance per test).

In the [cart example](../concepts/state.md#state-shared-by-islands-definestate), what the page
sends is `cart`'s store (`{ items: [...] }`): `count` and `add` are created again in the browser.
For state that lives only in the browser, a module-scope `signal` works too,
as long as it is written only in handlers and effects, which never run on the server.

## isServer

`true` in the server entry of `lumiose` (the `node` condition), `false` in the browser entry
(Solid's name). Use it to guard code that runs on both sides, such as a `defineState` factory that
reads request APIs: `signal(isServer ? locals().user : null)`. The guard stays explicit: request
APIs called in the browser still throw [LUM4003](../errors/LUM4003.md).

It is a constant, so production client builds fold it: `if (isServer) { … }` and
`isServer ? a : b` lose their server branch, and server-only strings in it never reach the
bundle. The server branch must still type-check and import only what client code may import;
server-only modules stay out of client graphs ([LUM4003](../errors/LUM4003.md)).

```ts
const isServer: boolean;
```

```ts check
import { isServer } from "lumiose";

export function storedTheme(): string {
  if (isServer) return "light";
  return localStorage.getItem("theme") ?? "light";
}
```

## isPending

Inside an async component (its body or its UI): whether a **re-run** is in flight. The first load is
not a re-run (`<Suspense>` covers it). Reading it in the body does not re-run the component.
Always `false` on the server.

```ts
function isPending(): boolean;
```

```tsx check
import { fetchJSON, isPending } from "lumiose";

export async function BookTitle(props: { id: string }) {
  const url = `/api/books/${props.id}`;
  const book = await fetchJSON<{ title: string }>(url);
  return <h2 class={{ stale: isPending() }}>{book.title}</h2>;
}
```

## isBusy

App-wide: whether anything is in flight: an async component run, a `<Suspense>` showing its
fallback, a form submission (`submit()`), an SPA navigation or a request of the async cache
(`fetchJSON`, `query`), background refetches included. Reactive. Always `false` on the
server.

```ts
function isBusy(): boolean;
```

```tsx check
import { isBusy } from "lumiose";

export function BusyBar() {
  return <progress hidden={!isBusy()} aria-label="Loading" />;
}
```

## resource

Loads a value on demand and exposes its loading and error state.

Low-level on-demand loading. `fetcher` runs now and whenever a signal it read synchronously
changes; its `AbortSignal` aborts when superseded or disposed. The first load counts as pending
for the nearest `<Suspense>`. Errors are not thrown: read `error()`. Browser only: on the server it
stays loading. Prefer [async components](../concepts/async.md).

```ts
function resource<T>(fetcher: (signal: AbortSignal) => T | PromiseLike<T>): Resource<T>;

interface Resource<T> {
  (): T | undefined;
  loading(): boolean;
  error(): unknown;
  refetch(): void;
}
```

```tsx check
import { resource, signal } from "lumiose";

interface User {
  name: string;
}

export function UserCard() {
  const id = signal("ada");
  const user = resource(async (signal) => {
    const res = await fetch(`/api/users/${id()}`, { signal });
    return (await res.json()) as User;
  });
  const reload = () => user.refetch();
  return <p onClick={reload}>{user.loading() ? "Loading…" : user()?.name}</p>;
}
```

| Name      | Type                                           | Default | Description                                                                                                                     |
| --------- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `fetcher` | `(signal: AbortSignal) => T \| PromiseLike<T>` | —       | Loads the value. Runs now and whenever a signal it read synchronously changes; its `signal` aborts when superseded or disposed. |

| Member      | Type             | Description                                                                  |
| ----------- | ---------------- | ---------------------------------------------------------------------------- |
| `()`        | `T \| undefined` | The latest loaded value; `undefined` until the first load resolves. Tracked. |
| `loading()` | `boolean`        | Whether a load is in flight. Tracked.                                        |
| `error()`   | `unknown`        | The error of the latest load, or `undefined` once a load succeeds. Tracked.  |
| `refetch()` | `void`           | Aborts a load in flight and loads again.                                     |

## optimistic

A value that follows `source` (a getter such as `() => props.likes`, or a signal), plus overlays
held while their promises are pending. Each `set`/`update` applies at once and drops when its own
promise settles, either way: on success the (refreshed) source shows, on failure the value rolls
back. Concurrent overlays apply in call order over the latest source value, so an `update` is
re-applied when the source changes. A rejection is not re-thrown; await the promise itself to
handle it. Writes stop when the owner is disposed. On the server it reads `source()` and `set`/`update`
do nothing. See [optimistic updates](../concepts/data-and-actions.md) in Data and actions.

```ts
function optimistic<T>(source: () => T): Optimistic<T>;

interface Optimistic<T> {
  (): T;
  set(value: T, promise: PromiseLike<unknown>): void;
  update(fn: (value: T) => T, promise: PromiseLike<unknown>): void;
}
```

```tsx check
import { optimistic, submit } from "lumiose";

export function LikeButton(props: { likes: number }) {
  const likes = optimistic(() => props.likes);
  return (
    <form
      method="post"
      action="?/like"
      onSubmit={(event) => likes.update((n) => n + 1, submit(event))}
    >
      <button>Like ({likes()})</button>
    </form>
  );
}
```

| Name     | Type      | Default | Description                                                             |
| -------- | --------- | ------- | ----------------------------------------------------------------------- |
| `source` | `() => T` | —       | The value to follow: a getter such as `() => props.likes`, or a signal. |

| Member                | Type   | Description                                                                                          |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `()`                  | `T`    | `source()` with the pending overlays applied in order. Tracked.                                      |
| `set(value, promise)` | `void` | Shows `value` until `promise` settles.                                                               |
| `update(fn, promise)` | `void` | Shows `fn` applied to the current value until `promise` settles; re-applied when the source changes. |

## State libraries mapped

**No state library needed.** Only the code that reads a signal (or a store property) re-runs, so
selectors and re-render tuning are not needed. What the popular libraries offer maps to:

| Library feature                                      | In Lumiose                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Jotai `atom(v)`, derived atoms                       | `signal(v)`, `computed(fn)`                                                                               |
| Jotai `atomFamily`                                   | a `store` keyed by id, or the family recipe below                                                         |
| Jotai `atomWithStorage`, Zustand `persist`           | the persisted signal recipe below                                                                         |
| Jotai `Provider`, Zustand `createStore` with context | a store with actions, provided through [context](../concepts/state.md#a-store-with-actions-zustand-style) |
| Zustand selectors, `subscribeWithSelector`           | not needed: `computed` for the slice, `effect` to react to it                                             |
| Zustand `immer` middleware                           | `store()`: a mutable proxy, mutate it directly                                                            |
| Zustand `devtools`                                   | `effect(() => console.debug(JSON.stringify(state)))` (tracks every property read)                         |
| Valtio `proxy`, `snapshot`                           | `store`, `snapshot`                                                                                       |
| Solid `reconcile`, TanStack structural sharing       | `reconcile(store, data)`: patch fresh data in, keeping unchanged items                                    |
| `zustand/vanilla`, a Jotai store, Redux              | the [external store recipe](../concepts/state.md#an-external-store-zustandvanilla-a-jotai-store-redux)    |

## State recipes

### Families (atomFamily)

A `store` tracks each key separately, so a record keyed by id is already a family: setting
`selected[id]` re-runs only what read that id.

```ts check
import { store } from "lumiose";

export const selected = store<Record<string, boolean>>({});
// selected["todo-1"] = true; re-runs only the bindings that read selected["todo-1"]
```

#### One signal per key

When each entry must be a signal of its own (to pass it to a component, or to derive from it),
create them on first use:

```ts check
import { signal, type Signal } from "lumiose";

export function family<K, T>(initial: (key: K) => T) {
  const signals = new Map<K, Signal<T>>();
  return {
    get(key: K): Signal<T> {
      let entry = signals.get(key);
      if (entry === undefined) signals.set(key, (entry = signal(initial(key))));
      return entry;
    },
    delete(key: K): void {
      signals.delete(key);
    },
  };
}

export const drafts = family((_postId: string) => "");
// drafts.get("post-1").set("Hello"); drafts.get("post-1")()
```

### Fresh data into a store (reconcile)

Replacing a store's array with a new fetch result (`state.books = fresh`) gives every row a new
object, so a list re-renders every row and loses its local state. `reconcile` patches the data in
instead: rows are matched by `id` (or by `{ key }`), unchanged rows keep their identity, and only
the fields that changed notify.

It works on a part of a store too; [`reconcile`](#reconcile) has the matching rules.

```ts check
import { reconcile, store } from "lumiose";

interface Book {
  id: number;
  title: string;
}

export const books = store<Book[]>([]);

export async function refresh(): Promise<void> {
  const fresh = (await (await fetch("/api/books")).json()) as Book[];
  reconcile(books, fresh); // only changed titles and added or removed rows update the page
}
```

### A persisted signal (atomWithStorage, persist)

Call it in a component. The saved value loads in `onMount`, after hydration, so the server HTML
and the first browser render agree; other tabs stay in sync through the `storage` event.

In a `client:only` island or an SPA, which render nothing on the server, you can read
`localStorage` directly in `signal(…)` instead.

```tsx check
import { effect, onMount, signal, type Signal } from "lumiose";

export function persisted<T>(key: string, initial: T): Signal<T> {
  const value = signal(initial);
  let loaded = false;
  onMount(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) value.set(JSON.parse(saved) as T);
    loaded = true;
    const sync = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) value.set(JSON.parse(event.newValue) as T);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  });
  effect(() => {
    const current = value();
    if (loaded) localStorage.setItem(key, JSON.stringify(current));
  });
  return value;
}

export function ThemeToggle() {
  const theme = persisted<"light" | "dark">("theme", "light");
  return (
    <button onClick={() => theme.update((t) => (t === "light" ? "dark" : "light"))}>
      Theme: {theme()}
    </button>
  );
}
```

## Common mistakes when sharing state

- **Writing module-scope state during SSR.** A module-scope signal written in a component body or
  a server path leaks one request's state into the next (`LUM4008`). Use `defineState`, whose
  factory runs once per request, or keep it in context.
- **Reading page context inside an island.** Each island starts a new context root, on the
  server as in the browser, so `useContext()` inside it does not see what the page provided outside
  it and returns the context's default (`LUM4010` warns in dev). Pass the value as an island prop,
  provide the context inside the island, or share scoped state (`defineState`).
- **Calling request APIs in a state's factory without a guard.** The factory also runs in the
  browser, where `cookies()` and `locals()` throw `LUM4003`. Read them only on the server
  (`isServer ? cookies().get("cart") : undefined`); the server's values arrive anyway.
- **Putting secrets or class instances in a state that islands use.** Its signals and stores are
  sent with the page, readable by anyone, and must hold plain data (`LUM4011`). Keep secrets in
  server-only modules; keep other values in computeds or functions, which are not sent.
- **Calling a state's accessor at module scope on the server.** There is no request there, so it
  throws. Call it in components, middleware, endpoints or actions.
- **Creating a state inside a function.** Only module-scope states get an id, so a state created
  in a component or helper is never sent and the browser starts from the factory's values.
- **Reading `localStorage` in setup in a server-rendered component.** The server cannot read it,
  so the first browser render differs from the HTML (`LUM4006`). Load it in `onMount`, as the
  persisted recipe does.
- **Copying state between stores with `effect`.** `effect(() => b.set(a()))` adds a frame of
  staleness. Derive with `computed`, or keep one source of truth.
- **Expecting `snapshot()` in an effect to track.** Its reads are not tracked. To log every change,
  read through the store (`JSON.stringify(state)`).
- **Assigning a fresh fetch result over a store's array.** `state.rows = await res.json()` replaces
  every row, so lists re-create their rows and lose row state. Use `reconcile(state.rows, data)`.
- **Wrapping a class instance, `Map` or `Set` in `store()`.** Only plain objects and arrays become
  reactive. Use a record keyed by id, or the family recipe.

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
