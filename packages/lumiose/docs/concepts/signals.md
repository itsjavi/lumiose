# Signals and reactivity

> State lives in signals: read with `count()`, write with `count.set(v)`, and only the code that read a signal re-runs.

## Concept

### Read, write, derive

`qty()` reads, `update` writes, `computed` derives. A click re-runs only the text that read
them.

```tsx check
import { computed, signal } from "lumiose";

export function Price() {
  const qty = signal(1);
  const total = computed(() => qty() * 5);

  return (
    <button onClick={() => qty.update((n) => n + 1)}>
      {qty()} × 5 = {total()}
    </button>
  );
}
```

### Effects

An effect runs after the DOM updates, and again when a signal it read changes.

```tsx check
import { effect, signal } from "lumiose";

export function Search() {
  const query = signal("");
  effect(() => {
    document.title = `Search: ${query()}`;
  });
  return <input bind:value={query} />;
}
```

> **Timing:** reads are synchronous. Writes in an event handler render together when it returns
> ([batch](../reference/reactivity.md#batch)); others flush in a microtask
> ([flush](../reference/reactivity.md#flush)). On the server, effects never run.
> [Owners](../reference/reactivity.md#owners) scope cleanups and context.

## API

| API                                                 | Use                                            |
| --------------------------------------------------- | ---------------------------------------------- |
| `signal(value, { equals? })`                        | `s()`, `s.set(v)`, `s.update(fn)`, `s.peek()`. |
| `computed(fn, { equals? })`                         | Lazy, cached derived value.                    |
| `effect(fn)`                                        | Side effect; may return a cleanup.             |
| `onMount(fn)`, `onCleanup(fn)`                      | After mount; on disposal.                      |
| `store(obj)`, `snapshot(value)`                     | Deep mutable proxy; its plain copy.            |
| `untrack(fn)`, `batch(fn)`, `flush()`               | Read untracked; group writes; run pending now. |
| `getAbortSignal()`                                  | Aborted when the owner is disposed or re-runs. |
| `createContext()`, `<Ctx value>`, `useContext(ctx)` | Values passed down the tree.                   |
| `resource(fetcher)`                                 | Prefer [async components](async.md).           |

Signatures: [reference](../reference/reactivity.md). In-flight state (`isPending()`, `isBusy()`,
`isSubmitting()`, `isNavigating()`): [Async components](async.md),
[Data and actions](data-and-actions.md).

## Example

A store is mutated directly; a context passes a value down.

```tsx check
import { computed, createContext, store, useContext } from "lumiose";

const Currency = createContext("EUR");

export function Cart() {
  const items = store([{ name: "Pen", price: 2, qty: 1 }]);
  const total = computed(() => items.reduce((sum, item) => sum + item.price * item.qty, 0));

  return (
    <Currency value="USD">
      <button onClick={() => items.push({ name: "Ink", price: 5, qty: 1 })}>Add ink</button>
      <Total amount={total()} />
    </Currency>
  );
}

function Total(props: { amount: number }) {
  const currency = useContext(Currency);
  return (
    <p>
      {props.amount} {currency}
    </p>
  );
}
```

## Common mistakes

- **Copying a value in setup.** `const n = count()` freezes it (`LUM2001`).
- **Writing in the component body or a `computed`** (`LUM2002`). Write in handlers and effects.
- **Mutating, then `set` with the same object.** Not a change:
  [signal](../reference/reactivity.md#signal).
- **Deriving or measuring in effects:** [effect](../reference/reactivity.md#effect).
- **Module-scope signals in server code** are shared by every request (`LUM4008`).
- **Stores:** `postMessage()` needs `snapshot(state)`; class instances, `Map`s and `Set`s are not
  wrapped ([store](../reference/reactivity.md#store)).

## Related diagnostics

- [LUM2007](../errors/LUM2007.md): own signal read in an async body.
- The mistakes above: [LUM2001](../errors/LUM2001.md), [LUM2002](../errors/LUM2002.md),
  [LUM4008](../errors/LUM4008.md).

See also: [JSX bindings](jsx.md), [Sharing state](state.md).
