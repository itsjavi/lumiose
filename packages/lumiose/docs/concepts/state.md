# Sharing state

> Where state should live: in a component, passed down with context, or shared by a page and its islands, with recipes for common store patterns.

## Concept

### A store with actions (Zustand-style)

A function creates the state and returns it with the functions that change it. Provide one
instance through context: every component below shares it, each request on the server gets its
own, and tests call `createCart()` directly.

```tsx check
import { computed, createContext, store, useContext } from "lumiose";

export function createCart() {
  const state = store({
    items: [] as { id: string; qty: number }[],
  });
  return {
    state,
    count: computed(() => state.items.reduce((n, item) => n + item.qty, 0)),
    add(id: string) {
      const item = state.items.find((item) => item.id === id);
      if (item) item.qty += 1;
      else state.items.push({ id, qty: 1 });
    },
  };
}

const CartContext = createContext<ReturnType<typeof createCart>>();

function getCart() {
  const cart = useContext(CartContext);
  if (cart === undefined) throw new Error("No <Shop> above.");
  return cart;
}

export function Shop() {
  return (
    <CartContext value={createCart()}>
      <AddButton id="pen" />
      <CartCount />
    </CartContext>
  );
}

function AddButton(props: { id: string }) {
  const cart = getCart();
  return <button onClick={() => cart.add(props.id)}>Add</button>;
}

function CartCount() {
  const cart = getCart();
  return <p>{cart.count()} items</p>;
}
```

### Where state lives

Pick the narrowest place that works. Only the code that reads a signal or a store property
re-runs, so no state library, selectors or re-render tuning are needed
([what the libraries' features map to](../reference/reactivity.md#state-libraries-mapped)).

| Where                                            | Lives as long as          | Shared with                                 | On the server                              |
| ------------------------------------------------ | ------------------------- | ------------------------------------------- | ------------------------------------------ |
| A component (`signal`, `store` in setup)         | the component             | its children, through props                 | one per request: safe                      |
| Context (`<Ctx value>` / `useContext`)           | the provider              | everything rendered inside it               | one per request: safe                      |
| Scoped state (`export const s = defineState(…)`) | the page (in the browser) | every component and island that calls `s()` | one per request, sent to the islands: safe |
| Module scope (`export const s = signal()`)       | the page (in the browser) | every component and island that imports it  | one per process: never write it during SSR |

### State shared by islands (defineState)

Each [island](islands.md) hydrates as its own root, so the page's context does not reach it.
Define the state at module scope with `defineState` and call its accessor wherever it is used:
the factory runs once per request on the server, and the islands start from the server's values
and share one instance in the browser.

```ts check file=lib/cart.ts
import { computed, cookies, defineState, isServer, store } from "lumiose";

export interface CartItem {
  id: string;
  qty: number;
}

export const cart = defineState(() => {
  // Request APIs exist only on the server.
  const saved = isServer ? cookies().get("cart") : undefined;
  const items: CartItem[] = saved ? JSON.parse(saved) : [];
  const state = store({ items });
  return {
    state, // a store: sent to the browser
    count: computed(() => state.items.reduce((n, item) => n + item.qty, 0)), // derived again in the browser
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

> **Details:** sent values are plain data and **public**: never put secrets in a state that
> islands use. What is sent and when, how states are named, and scoped state in tests:
> [Scoped state on the server and in tests](../reference/reactivity.md#scoped-state-on-the-server-and-in-tests).

### An external store (zustand/vanilla, a Jotai store, Redux)

Mirror any store with `getState()` and `subscribe()` into a signal. Call it in a component (or
under another owner) so the subscription ends with it.

```ts check
import { onCleanup, signal } from "lumiose";

export interface ExternalStore<T> {
  getState(): T;
  subscribe(listener: () => void): () => void;
}

export function fromStore<T>(source: ExternalStore<T>) {
  const state = signal(source.getState());
  const update = () => state.set(source.getState());
  onCleanup(source.subscribe(update));
  return (): T => state();
}
```

> **Details:** a `zustand/vanilla` store fits as it is: `fromStore(bearStore)`. For a Jotai
> store, adapt one atom:
> `fromStore({ getState: () => jotai.get(countAtom), subscribe: (fn) => jotai.sub(countAtom, fn) })`.
> Derive slices with `computed(() => state().bears)`.

### More recipes

In the reference: [families](../reference/reactivity.md#families-atomfamily) (`atomFamily`),
[fresh data into a store](../reference/reactivity.md#fresh-data-into-a-store-reconcile)
(`reconcile`) and
[a persisted signal](../reference/reactivity.md#a-persisted-signal-atomwithstorage-persist)
(`atomWithStorage`, `persist`).

## API

| API                                                        | Use it for                                            |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `signal(v)`, `computed(fn)`, `store(obj)`                  | The state itself and what derives from it.            |
| `createContext<T>()`, `<Ctx value={v}>`, `useContext(ctx)` | One instance per subtree, and per request.            |
| `defineState(factory)`                                     | One instance per page and request; shared by islands. |
| `effect(fn)`, `onMount(fn)`                                | Syncing with storage or logging; browser only.        |
| `onCleanup(fn)`                                            | Ending a subscription with its owner.                 |
| `snapshot(value)`                                          | A plain, untracked copy of a store.                   |
| `reconcile(store, data, { key })`                          | Patching fresh data in, keeping unchanged items.      |

See [Signals and reactivity](signals.md) for each API.

## Example

The page that uses the cart state: two islands and the server's own read share it.

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

## Common mistakes

- **Writing module-scope state during SSR** (`LUM4008`). Use `defineState` or context.
- **Reading page context inside an island** (`LUM4010`). Pass a prop or share scoped state.
- **Request APIs in a state's factory without `isServer`.** The factory also runs in the browser.
- **Secrets or class instances in a state that islands use** (`LUM4011`).
- **A state created inside a function,** or its accessor called at module scope on the server.
- **`localStorage` in the setup of a server-rendered component** (`LUM4006`). Use `onMount`.
- **Copying state between stores with `effect`.** Derive with `computed`.
- **A fetch result assigned over a store's array.** Use `reconcile(state.rows, data)`.
- **A class instance, `Map` or `Set` in `store()`.** Only plain objects and arrays are reactive.

The long forms, with `snapshot()` in effects:
[Common mistakes when sharing state](../reference/reactivity.md#common-mistakes-when-sharing-state).

## Related diagnostics

- [LUM4008](../errors/LUM4008.md): module-scope signal written during SSR.
- [LUM4011](../errors/LUM4011.md): non-serializable scoped state value.
- [LUM4010](../errors/LUM4010.md): island reads context provided by the page.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM2002](../errors/LUM2002.md): signal write during render.

See also: [Signals and reactivity](signals.md), [Islands](islands.md), [Async components](async.md).
