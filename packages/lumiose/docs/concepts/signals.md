# Signals and reactivity

> State lives in signals: read with `count()`, write with `count.set(v)`. Computeds derive, effects react, and only the code that read a signal re-runs.

## Concept

Lumiose's reactive core is a push-pull signal graph (the alien-signals algorithm). Reading a signal
inside a tracked scope (a JSX binding, a `computed`, an `effect`) subscribes that scope; writing
the signal marks it dirty and re-runs only what depends on it.

- **Reads are synchronous.** `count()` always returns the current value, even right after a write.
- **Writes are batched.** Writes inside a delegated event handler are batched for the duration of
  the handler. Any other write schedules a microtask flush. `flush()` flushes immediately.
- **Flush order:** computeds are pulled, then DOM bindings run (parents before children), then user
  effects.
- **Owners.** Every component, effect and root is an _owner_. Owners scope cleanups
  (`onCleanup`), context (`<Ctx value>`/`useContext`), error handling and `getAbortSignal()`. Disposing an owner
  disposes everything created under it.
- **Equality.** A write that is `Object.is`-equal to the current value is not a change. Pass
  `{ equals }` to customize, or `{ equals: false }` to treat every write as a change.
- **On the server** signals are plain cells, computeds run once, and effects never run.

## API

| API                                                             | Shape                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `signal(value, { equals? })`                                    | `s()` reads, `s.set(v)` and `s.update(fn)` write, `s.peek()` reads untracked.                                                               |
| `computed(fn, { equals? })`                                     | `c()` reads. Lazy, cached and glitch-free; `fn` receives the previous value.                                                                |
| `effect(fn)`                                                    | Runs after the DOM updates and again when what it read changes. `fn` may return a cleanup. Returns a disposer.                              |
| `onMount(fn)`                                                   | Runs `fn` once, untracked, after the owner's DOM is mounted. May return a cleanup.                                                          |
| `onCleanup(fn)`                                                 | Runs `fn` when the current owner is disposed or re-runs.                                                                                    |
| `store(obj)`                                                    | Deep, mutable reactive proxy over a plain object or array (like Valtio's `proxy` or Solid's `createMutable`): mutate it directly.           |
| `snapshot(value)`                                               | A deep plain copy of a store, for `structuredClone`, `postMessage` and saving.                                                              |
| `untrack(fn)`                                                   | Runs `fn` without subscribing to what it reads.                                                                                             |
| `batch(fn)`                                                     | Groups writes; dependents run once at the end.                                                                                              |
| `flush()`                                                       | Runs pending bindings and effects now.                                                                                                      |
| `getAbortSignal()`                                              | An `AbortSignal` aborted when the owner is disposed, an effect re-runs, or an async run is superseded. On the server, the request's signal. |
| `createContext(default?)`, `<Ctx value={v}>`, `useContext(ctx)` | Values passed down the owner tree; they survive `await`. The provider reads `value` once: provide a signal or store for changing state.     |
| `resource(fetcher)`                                             | Low-level on-demand loading with `loading()`, `error()`, `refetch()`. Prefer [async components](async.md).                                  |

In-flight state (`isPending()`, `isBusy()`, `isSubmitting()`, `isNavigating()`) is covered in
[Async components](async.md) and [Data and actions](data-and-actions.md).

## Example

```tsx check
import { computed, createContext, effect, signal, store, useContext } from "lumiose";

const Theme = createContext<"light" | "dark">("light");

export function Cart() {
  const items = store([{ name: "Pen", price: 2, qty: 1 }]);
  const discount = signal(0);
  const total = computed(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0) * (1 - discount()),
  );

  effect(() => {
    document.title = `Cart: ${total().toFixed(2)}`;
  });

  return (
    <Theme value="dark">
      <section>
        <button onClick={() => items.push({ name: "Ink", price: 5, qty: 1 })}>Add ink</button>
        <button onClick={() => (items[0]!.qty += 1)}>One more pen</button>
        <button onClick={() => discount.set(0.1)}>Apply 10%</button>
        <p>Total: {total().toFixed(2)}</p>
        <ThemeLabel />
      </section>
    </Theme>
  );
}

function ThemeLabel() {
  const theme = useContext(Theme);
  return <small>Theme: {theme}</small>;
}
```

## Common mistakes

- **Destructuring or copying a signal's value in setup.** `const n = count()` freezes the value.
  Read `count()` where you need it, or derive: `const double = () => count() * 2` (`LUM2001`).
- **Calling `set` with the same object after mutating it.** `list().push(x); list.set(list())` is
  not a change (`Object.is`). Write a new value (`list.update((l) => [...l, x])`), use `store()`,
  or create the signal with `{ equals: false }`.
- **Writing signals in the component body or in a `computed`.** That is a write during render
  (`LUM2002`). Computeds must be pure; write in handlers and effects.
- **Using `effect` to derive state.** `effect(() => b.set(a() * 2))` adds a frame of staleness and
  an extra flush. Use `computed(() => a() * 2)`.
- **Expecting an effect to run synchronously.** Effects run after the DOM updates. In tests, call
  `flush()` after a write before asserting.
- **Module-scope signals in server code.** On the server, a signal at module scope is shared by
  every request. Keep request data in components or context (`LUM4008`).
- **Posting a store to a worker.** `postMessage()` and `structuredClone()` throw on proxies: send
  `snapshot(state)`.
- **Expecting `store()` to wrap class instances, `Map`s or `Set`s.** Only plain objects and arrays
  become reactive; other values are returned as is.

## Related diagnostics

- [LUM2001](../errors/LUM2001.md): stale derived value.
- [LUM2002](../errors/LUM2002.md): signal write during render.
- [LUM2007](../errors/LUM2007.md): own signal read in an async body.
- [LUM4008](../errors/LUM4008.md): module-scope signal written during SSR.

See also: [reference: reactivity](../reference/reactivity.md), [JSX bindings](jsx.md), [Sharing state](state.md).
