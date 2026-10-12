# Coming from React

> Lumiose JSX reads like React, but a component's body runs once, as setup, and never re-renders. The rules of hooks, dependency arrays, stale closures and memoization go away. A few new mistakes take their place, and the compiler flags most of them.

This page maps React habits to Lumiose. The linked pages have the full rules.

## Mental model

In React, a state change re-runs the component function. Hooks keep their state between runs
by call order, and effects list their dependencies so React knows when to re-run them.

In Lumiose, the component body runs **once per instance**: it creates signals, effects and
handlers, then returns JSX. JSX expressions that read signals compile to bindings that update
their part of the DOM in place. When a signal changes, only the bindings, computeds and effects
that read it run again. Local variables are ordinary variables, and a closure reads the current
value because it calls `count()` when it runs ([Components](concepts/components.md),
[Signals](concepts/signals.md)).

The exception is an **async component**: when a prop or signal read in its body changes, the body
runs again, and signals created in the body start fresh ([Async components](concepts/async.md)).

## From React to Lumiose

| React                                                 | Lumiose                                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `const [count, setCount] = useState(0)`               | `const count = signal(0)`: read `count()`, write `count.set(1)` or `count.update((n) => n + 1)`.                                                |
| `useReducer(reducer, init)`                           | A `store()` plus the functions that change it ([a store with actions](concepts/state.md#a-store-with-actions-zustand-style)).                   |
| `useMemo(() => a * b, [a, b])`                        | `computed(() => a() * b())`, or a plain function `() => a() * b()` for cheap derivations.                                                       |
| `useCallback(fn, deps)`, `React.memo(Component)`      | Not needed: functions are created once and components don't re-render.                                                                          |
| `useEffect(fn, [deps])`                               | `effect(fn)`: it tracks what it reads. Return a cleanup, as in React.                                                                           |
| `useEffect(fn, [])`                                   | `onMount(fn)`: runs once, untracked, after mount. It may return a cleanup.                                                                      |
| `useLayoutEffect(fn, deps)`                           | `effect(fn)` or `onMount(fn)`: there is one kind of effect, and it runs after the DOM writes of the same flush.                                 |
| Cleanup returned from `useEffect`, `AbortController`  | `onCleanup(fn)`, and `getAbortSignal()`, aborted when the owner is disposed or the effect re-runs.                                              |
| `useRef<HTMLInputElement>(null)`                      | `const input = ref<HTMLInputElement>()`, then `<input ref={input} />` and `input()?.focus()`.                                                   |
| `useRef(value)` for a mutable value                   | A `let` variable in the component body: the body runs once.                                                                                     |
| `<Ctx.Provider value={v}>`, `useContext(Ctx)`         | `<Ctx value={v}>`, `useContext(Ctx)`. The provider reads `value` once: provide a signal or a store for state that changes.                      |
| `useId()`, `identifierPrefix`                         | `useId()`, and `idPrefix` on `render()` and `renderToStream()` ([useId](reference/reactivity.md#useid)).                                        |
| `useSyncExternalStore(subscribe, get)`                | A signal set from the store's `subscribe` ([an external store](concepts/state.md#an-external-store-zustandvanilla-a-jotai-store-redux)).        |
| Fetching in `useEffect`, TanStack Query               | An `async` component that awaits `fetchJSON()` or `query()` ([Async components](concepts/async.md)), or [`@lumiose/query`](reference/query.md). |
| `useTransition`, `isPending`                          | `isPending()` inside an async component, and `isBusy()` for anything in flight.                                                                 |
| `useOptimistic(state, update)`                        | `optimistic(source)` ([Data and actions](concepts/data-and-actions.md)).                                                                        |
| `<Suspense>`, error boundary classes                  | `<Suspense fallback={…}>` and `<ErrorBoundary fallback={(error, reset) => …}>`.                                                                 |
| `createPortal(children, node)`                        | `<Portal mount={node}>`.                                                                                                                        |
| `{items.map((item) => <Row key={item.id} />)}`        | The same, with `items()`. It compiles to a keyed list; `key` is optional ([JSX](concepts/jsx.md)).                                              |
| `className`, `htmlFor`, `style={{ fontWeight: 600 }}` | `class`, `for`, `style={{ "font-weight": 600 }}` (kebab-case keys).                                                                             |
| `dangerouslySetInnerHTML={{ __html: html }}`          | `innerHTML={html}`.                                                                                                                             |
| `onChange` on a text input (fires on every keystroke) | `onInput`, or `bind:value={signal}`. Handlers get native events, so `onChange` fires when the value is committed.                               |

## What goes away

- **The rules of hooks.** `signal`, `computed`, `effect` and `onCleanup` are ordinary functions:
  call them in conditions, loops and helper functions. Nothing depends on call order.
- **Dependency arrays.** Effects and computeds subscribe to the signals they read, and collect them
  again on every run, so a dependency cannot be missing, and a branch that stops reading a signal
  stops depending on it.
- **Stale closures.** A handler or a timer callback calls `count()` when it runs, so it gets the
  current value. There is no closure from an older render to capture.
- **Memoization.** `useMemo`, `useCallback` and `React.memo` exist to limit re-renders, and there
  are none. Use `computed` only to cache an expensive derivation.
- **Context re-renders.** A context change does not re-render its consumers: provide a signal or a
  store, and only the code that reads it updates.

## Mistakes that replace them

| React habit                                                 | What happens in Lumiose                                 | Instead                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `const doubled = count() * 2` in the body                   | Computed once, never updates.                           | `const doubled = () => count() * 2`, or `computed` ([LUM2001](errors/LUM2001.md)).         |
| `if (!user()) return <Login />`                             | Checked once, at setup.                                 | `{user() ? <Profile /> : <Login />}` in the JSX ([LUM2003](errors/LUM2003.md)).            |
| `count.set(…)` in the body                                  | A write during render.                                  | Write in handlers and effects ([LUM2002](errors/LUM2002.md)).                              |
| `effect(() => b.set(a() * 2))` to sync state                | A frame of staleness and an extra flush.                | `const b = computed(() => a() * 2)`.                                                       |
| Reading a signal in an effect only to use its current value | The effect re-runs whenever that signal changes.        | `untrack(() => s())` or `s.peek()` reads without subscribing.                              |
| Asserting right after a write in a test                     | Effects run after the DOM updates, not synchronously.   | Call `flush()` before asserting.                                                           |
| `{Card({ title })}`                                         | Skips the component's owner and props handling.         | `<Card title={title} />` ([LUM2004](errors/LUM2004.md)).                                   |
| `{children}` inserted twice                                 | The second insert moves or re-creates the nodes.        | Take a render prop such as `renderItem: () => JSX.Element` ([LUM2005](errors/LUM2005.md)). |
| A signal created and read in an async component's body      | The read re-runs the body, which re-creates the signal. | Read it in JSX, handlers or effects ([LUM2007](errors/LUM2007.md)).                        |
| A module-scope signal written on the server                 | Shared by every request.                                | Component state, context or `defineState` ([LUM4008](errors/LUM4008.md)).                  |

Destructuring props is fine: `({ title })` compiles to reads of `props.title`, which stay reactive.
Copying a signal's value into a variable is what freezes it.

## Example

A clock that pauses, in React:

```tsx
function Clock({ label }: { label: string }) {
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    document.title = `${label}: ${new Date(now).toLocaleTimeString()}`;
  }, [label, now]);

  const toggle = useCallback(() => setPaused((p) => !p), []);
  return <button onClick={toggle}>{paused ? "Resume" : "Pause"}</button>;
}
```

The same clock in Lumiose. The effects list no dependencies, and the handler needs no
`useCallback`:

```tsx check
import { effect, signal } from "lumiose";

export function Clock({ label }: { label: string }) {
  const now = signal(Date.now());
  const paused = signal(false);

  // Reads paused(): re-runs, after clearing the interval, when it flips.
  effect(() => {
    if (paused()) return;
    const id = setInterval(() => now.set(Date.now()), 1000);
    return () => clearInterval(id);
  });

  // Reads label (props.label) and now(): re-runs when either changes.
  effect(() => {
    document.title = `${label}: ${new Date(now()).toLocaleTimeString()}`;
  });

  return <button onClick={() => paused.update((p) => !p)}>{paused() ? "Resume" : "Pause"}</button>;
}
```

## Related

- [Components](concepts/components.md): setup once, props, children and refs.
- [Signals and reactivity](concepts/signals.md): `signal`, `computed`, `effect`, owners and scheduling.
- [JSX](concepts/jsx.md): bindings, compiled `.map()` and ternaries, and the React prop names that differ.
- [Sharing state](concepts/state.md): context, `defineState`, and what replaces Jotai, Zustand and Valtio.
- [Async components](concepts/async.md): data loading, re-runs, `<Suspense>` and `isPending()`.
