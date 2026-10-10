# Sharing state

> Signals already do what Jotai, Zustand and Valtio do: keep state in a component, pass it down with context, or share it from a module. This page shows where state should live, with recipes for stores with actions, families, persistence, external stores and state shared by islands.

## Concept

**Pick the narrowest place that works.**

| Where                                      | Lives as long as          | Shared with                                | On the server                              |
| ------------------------------------------ | ------------------------- | ------------------------------------------ | ------------------------------------------ |
| A component (`signal`, `store` in setup)   | the component             | its children, through props                | one per request: safe                      |
| Context (`provide` / `inject`)             | the providing owner       | everything rendered below it               | one per request: safe                      |
| Module scope (`export const s = signal()`) | the page (in the browser) | every component and island that imports it | one per process: never write it during SSR |

**No state library needed.** Only the code that reads a signal (or a store property) re-runs, so
selectors and re-render tuning are not needed. What the popular libraries offer maps to:

| Library feature                                      | In Lumiose                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Jotai `atom(v)`, derived atoms                       | `signal(v)`, `computed(fn)`                                                       |
| Jotai `atomFamily`                                   | a `store` keyed by id, or the family recipe below                                 |
| Jotai `atomWithStorage`, Zustand `persist`           | the persisted signal recipe below                                                 |
| Jotai `Provider`, Zustand `createStore` with context | a store with actions, provided through context (recipe below)                     |
| Zustand selectors, `subscribeWithSelector`           | not needed: `computed` for the slice, `effect` to react to it                     |
| Zustand `immer` middleware                           | `store()`: mutate it directly                                                     |
| Zustand `devtools`                                   | `effect(() => console.debug(JSON.stringify(state)))` (tracks every property read) |
| Valtio `proxy`, `snapshot`                           | `store`, `snapshot`                                                               |
| Solid `reconcile`, TanStack structural sharing       | `reconcile(store, data)`: patch fresh data in, keeping unchanged items            |
| `zustand/vanilla`, a Jotai store, Redux              | the external store recipe below                                                   |

**Islands.** Each [island](islands.md) hydrates as its own root, so context provided by the page
does not reach an island, and one island cannot provide to another. The server renders islands
the same way, so their HTML matches. Islands share
the Lumiose runtime and the modules they import, so module-scope state is how islands share state.

## API

| API                                                    | Use it for                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `signal(v)`, `computed(fn)`, `store(obj)`              | The state itself and what derives from it.                           |
| `createContext<T>()`, `provide(ctx, v)`, `inject(ctx)` | One instance per subtree (and per request on the server).            |
| `effect(fn)`, `onMount(fn)`                            | Syncing with the outside world (storage, logging); browser only.     |
| `onCleanup(fn)`                                        | Ending a subscription when its owner is disposed.                    |
| `snapshot(value)`                                      | A plain copy of a store, to save or send. Its reads are not tracked. |
| `reconcile(store, data, { key })`                      | Patching fresh data into a store, keeping unchanged items as is.     |

See [Signals and reactivity](signals.md) for each API.

## Example

### A store with actions (Zustand-style)

A function creates the state and returns it with the functions that change it. Provide one
instance through context: every component below shares it, each request on the server gets its
own, and tests call `createCart()` directly.

```tsx check
import { computed, createContext, inject, provide, store } from "lumiose";

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

export function injectCart(): Cart {
  const cart = inject(CartContext);
  if (cart === undefined) throw new Error("injectCart() needs a <Shop> above it.");
  return cart;
}

export function Shop() {
  provide(CartContext, createCart());
  return (
    <main>
      <AddButton id="pen" />
      <CartCount />
    </main>
  );
}

function AddButton({ id }: { id: string }) {
  const cart = injectCart();
  return <button onClick={() => cart.add(id)}>Add {id}</button>;
}

function CartCount() {
  const cart = injectCart();
  return <p>{cart.count()} items</p>;
}
```

### State shared by islands

Put the signal in a module that the islands import. In the browser there is one value per page.
On the server the module is shared by every request, so write it only in handlers and effects,
which never run there.

```ts check file=lib/cart-count.ts
import { signal } from "lumiose";

export const cartCount = signal(0);
```

```stsx check file=components/CartIslands.stsx
import { cartCount } from "../lib/cart-count.ts";

export function AddToCart() {
  return <button onClick={() => cartCount.update((n) => n + 1)}>Add to cart</button>;
}

export function CartBadge() {
  return <span class="badge">{cartCount()}</span>;
}
```

```stsx check file=routes/shop-islands.stsx
import { AddToCart, CartBadge } from "../components/CartIslands.stsx";

export default function ShopPage() {
  return (
    <main>
      <header>
        Cart <CartBadge client:idle />
      </header>
      <AddToCart client:visible />
    </main>
  );
}
```

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
  a server path leaks one request's state into the next (`LUM4008`). Write it in handlers and
  effects, or keep it in context.
- **Injecting page context inside an island.** Each island starts a new context root, on the
  server as in the browser, so `inject()` inside it does not see what the page provided outside
  it and returns the context's default (`LUM4010` warns in dev). Pass the value as an island prop,
  provide the context inside the island, or share module-scope state.
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
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM2002](../errors/LUM2002.md): signal write during render.

See also: [Signals and reactivity](signals.md), [Islands](islands.md), [Async components](async.md).
