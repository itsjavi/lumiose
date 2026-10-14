# Sharing state

> Where state should live: in a component, passed down with context, or shared by a page and its islands, with recipes for common store patterns.

## Concept

**Pick the narrowest place that works.**

| Where                                            | Lives as long as          | Shared with                                 | On the server                              |
| ------------------------------------------------ | ------------------------- | ------------------------------------------- | ------------------------------------------ |
| A component (`signal`, `store` in setup)         | the component             | its children, through props                 | one per request: safe                      |
| Context (`<Ctx value>` / `useContext`)           | the provider              | everything rendered inside it               | one per request: safe                      |
| Scoped state (`export const s = defineState(…)`) | the page (in the browser) | every component and island that calls `s()` | one per request, sent to the islands: safe |
| Module scope (`export const s = signal()`)       | the page (in the browser) | every component and island that imports it  | one per process: never write it during SSR |

**No state library needed.** Only the code that reads a signal (or a store property) re-runs, so
selectors and re-render tuning are not needed. What the popular libraries offer maps to:

| Library feature                                      | In Lumiose                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Jotai `atom(v)`, derived atoms                       | `signal(v)`, `computed(fn)`                                                       |
| Jotai `atomFamily`                                   | a `store` keyed by id, or the family recipe below                                 |
| Jotai `atomWithStorage`, Zustand `persist`           | the persisted signal recipe below                                                 |
| Jotai `Provider`, Zustand `createStore` with context | a store with actions, provided through context (recipe below)                     |
| Zustand selectors, `subscribeWithSelector`           | not needed: `computed` for the slice, `effect` to react to it                     |
| Zustand `immer` middleware                           | `store()`: a mutable proxy, mutate it directly                                    |
| Zustand `devtools`                                   | `effect(() => console.debug(JSON.stringify(state)))` (tracks every property read) |
| Valtio `proxy`, `snapshot`                           | `store`, `snapshot`                                                               |
| Solid `reconcile`, TanStack structural sharing       | `reconcile(store, data)`: patch fresh data in, keeping unchanged items            |
| `zustand/vanilla`, a Jotai store, Redux              | the external store recipe below                                                   |

**Islands.** Each [island](islands.md) hydrates as its own root, so context provided by the page
does not reach an island, and one island cannot provide to another. The server renders islands
the same way, so their HTML matches. Islands share the Lumiose runtime and the modules they import,
so islands share state through **scoped state**: `defineState(factory)` returns an accessor whose
factory runs on first use, once per page in the browser and once per request on the server.

**Scoped state on the server.** The factory runs per request, so it can seed itself from the
request (`cookies()`, `locals()`, …); there is no separate seed API. When islands (or SPA routes)
import a state, the page sends its server values: the signals and stores the factory returned,
once per page, in the chunk where the state was first used. In the browser the factory runs again
(rebuilding computeds and functions) and the server values replace its signals and stores before
any island reads them, so hydration matches. A state that only server code imports is never sent.
Sent values must be plain data, like island props (`LUM4011`), and they are **public**: everyone
who can load the page can read them in its source. Never put secrets in a state that islands use.

**Scoped state in tests.** Under Vitest, `@lumiose/vite` resets scoped state before each test: each
test starts with fresh instances, in DOM tests and in server tests (where calls outside a render
share one instance per test).

## API

| API                                                        | Use it for                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `signal(v)`, `computed(fn)`, `store(obj)`                  | The state itself and what derives from it.                           |
| `createContext<T>()`, `<Ctx value={v}>`, `useContext(ctx)` | One instance per subtree (and per request on the server).            |
| `defineState(factory)`                                     | One instance per page, per request on the server; shared by islands. |
| `effect(fn)`, `onMount(fn)`                                | Syncing with the outside world (storage, logging); browser only.     |
| `onCleanup(fn)`                                            | Ending a subscription when its owner is disposed.                    |
| `snapshot(value)`                                          | A plain copy of a store, to save or send. Its reads are not tracked. |
| `reconcile(store, data, { key })`                          | Patching fresh data into a store, keeping unchanged items as is.     |

See [Signals and reactivity](signals.md) for each API.

## Example

### A store with actions (Zustand-style)

A function creates the state and returns it with the functions that change it. Provide one
instance through context: every component below shares it, each request on the server gets its
own, and tests call `createCart()` directly.

```tsx check
import { computed, createContext, store, useContext } from "lumiose";

export function createCart() {
  const state = store({ items: [] as { id: string; qty: number }[] });
  return {
    state,
    count: computed(() => state.items.reduce((n, item) => n + item.qty, 0)),
    add(id: string) {
      const item = state.items.find((item) => item.id === id);
      if (item) item.qty += 1;
      else state.items.push({ id, qty: 1 });
    },
    clear() {
      state.items = [];
    },
  };
}

export type Cart = ReturnType<typeof createCart>;

const CartContext = createContext<Cart>();

export function getCart(): Cart {
  const cart = useContext(CartContext);
  if (cart === undefined) throw new Error("getCart() needs a <Shop> above it.");
  return cart;
}

export function Shop() {
  return (
    <CartContext value={createCart()}>
      <main>
        <AddButton id="pen" />
        <CartCount />
      </main>
    </CartContext>
  );
}

function AddButton({ id }: { id: string }) {
  const cart = getCart();
  return <button onClick={() => cart.add(id)}>Add {id}</button>;
}

function CartCount() {
  const cart = getCart();
  return <p>{cart.count()} items</p>;
}
```

### State shared by islands (defineState)

Define the state at module scope with `defineState` and call its accessor wherever it is used. The
server seeds it from the request; the islands start from the server's values and share one
instance in the browser.

```ts check file=lib/cart.ts
import { computed, cookies, defineState, isServer, store } from "lumiose";

export interface CartItem {
  id: string;
  qty: number;
}

export const cart = defineState(() => {
  // Request APIs exist only on the server; the browser gets the server's values instead.
  const saved = isServer ? cookies().get("cart") : undefined;
  const state = store({ items: saved ? (JSON.parse(saved) as CartItem[]) : [] });
  return {
    state, // sent to the browser (a store)
    count: computed(() => state.items.reduce((n, item) => n + item.qty, 0)), // derived again
    add(id: string) {
      const item = state.items.find((item) => item.id === id);
      if (item) item.qty += 1;
      else state.items.push({ id, qty: 1 });
    },
  };
});
```

```stsx check file=components/CartIslands.stsx
import { cart } from "../lib/cart.ts";

export function AddToCart(props: { id: string }) {
  const { add } = cart();
  return <button onClick={() => add(props.id)}>Add to cart</button>;
}

export function CartBadge() {
  const { count } = cart();
  return <span class="badge">{count()}</span>;
}
```

```stsx check file=routes/shop-islands/page.stsx
import { AddToCart, CartBadge } from "../../components/CartIslands.stsx";
import { cart } from "../../lib/cart.ts";

export const mode = "server";

export default function ShopPage() {
  return (
    <main>
      <header>
        Cart <CartBadge client:idle />
      </header>
      <p>{cart().count()} items, rendered on the server for this request</p>
      <AddToCart client:visible id="pen" />
    </main>
  );
}
```

What the page sends is `cart`'s store (`{ items: [...] }`): `count` and `add` are created again in
the browser. `@lumiose/vite` names each state after its module and export
(`/src/lib/cart.ts#cart`), the way it names islands, so define states at module scope and export
them (or the binding). For state that lives only in the browser, a module-scope `signal` works too,
as long as it is written only in handlers and effects, which never run on the server.

### Families (atomFamily)

A `store` tracks each key separately, so a record keyed by id is already a family: setting
`selected[id]` re-runs only what read that id.

```ts check
import { store } from "lumiose";

export const selected = store<Record<string, boolean>>({});
// selected["todo-1"] = true; re-runs only the bindings that read selected["todo-1"]
```

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

It works on a part of a store too: `reconcile(state.books, fresh)`. Keys missing from the new
data are deleted, nested objects are merged, and other values are replaced.

### A persisted signal (atomWithStorage, persist)

Call it in a component. The saved value loads in `onMount`, after hydration, so the server HTML
and the first browser render agree; other tabs stay in sync through the `storage` event.

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

In a `client:only` island or an SPA, which render nothing on the server, you can read
`localStorage` directly in `signal(…)` instead.

### An external store (zustand/vanilla, a Jotai store, Redux)

Mirror any store with `getState()` and `subscribe()` into a signal. Call it in a component (or
under another owner) so the subscription ends with it.

```ts check
import { onCleanup, signal } from "lumiose";

export interface ExternalStore<T> {
  getState(): T;
  subscribe(listener: () => void): () => void;
}

export function fromStore<T>(source: ExternalStore<T>): () => T {
  const state = signal(source.getState());
  onCleanup(source.subscribe(() => state.set(source.getState())));
  return state;
}
```

A `zustand/vanilla` store fits as it is: `fromStore(bearStore)`. For a Jotai store, adapt one
atom: `fromStore({ getState: () => jotai.get(countAtom), subscribe: (fn) => jotai.sub(countAtom, fn) })`.
Derive slices with `computed(() => state().bears)`.

## Common mistakes

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

## Related diagnostics

- [LUM4008](../errors/LUM4008.md): module-scope signal written during SSR.
- [LUM4011](../errors/LUM4011.md): non-serializable scoped state value.
- [LUM4010](../errors/LUM4010.md): island reads context provided by the page.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM2002](../errors/LUM2002.md): signal write during render.

See also: [Signals and reactivity](signals.md), [Islands](islands.md), [Async components](async.md).
