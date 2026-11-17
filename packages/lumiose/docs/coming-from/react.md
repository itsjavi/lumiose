# Coming from React

> Lumiose JSX reads like React, but components run once and never re-render, render on the server by default, and ship JavaScript only where a page asks for it.

## Mental model

```tsx
// React 19
function Counter() {
  console.log("runs on every click");
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((n) => n + 1)}>{count}</button>;
}
```

```tsx check
// Lumiose
import { signal } from "lumiose";

export function Counter() {
  console.log("runs once");
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
```

React re-runs the component function on a state change. Lumiose runs the body **once per
instance**: `signal(0)` returns one function, where `count()` reads and `count.set(1)` or
`count.update(fn)` writes, and the JSX that reads it updates its part of the DOM in place
([Components](../concepts/components.md), [Signals](../concepts/signals.md)).

> **Scope:** this page maps React 19 habits to Lumiose's current API. Using a React framework
> too? [Coming from Next.js](nextjs.md) and [Coming from React Router](react-router.md) cover
> its side.

> **Exception:** an **async component**. When a prop or signal read in its body changes, the body
> runs again, and signals created in the body start fresh
> ([Async components](../concepts/async.md)).

### Server first

Every component renders on the server unless a page says otherwise, as React Server Components
do. A page ships no JavaScript until a usage site adds a `client:*` directive
(`<Clock client:load />` makes that one instance an [island](../concepts/islands.md)) or the route
is an `spa` route, whose whole subtree hydrates and navigates on the client
([Rendering modes](../concepts/rendering-modes.md)). There is no `"use client"` file boundary: the
same component is static on one page and interactive on another.

### What goes away

| In React           | Why Lumiose does not need it                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The rules of hooks | `signal`, `computed`, `effect`, `onCleanup` and `useContext` are ordinary functions: call them in conditions, loops and helper functions. Nothing depends on call order.                                   |
| Dependency arrays  | Effects and computeds subscribe to the signals they read, and collect them again on every run, so a dependency cannot be missing, and a branch that stops reading a signal stops depending on it.          |
| Stale closures     | A handler or a timer callback calls `count()` when it runs, so it gets the current value. There is no closure from an older render to capture. Local variables are ordinary variables.                     |
| Memoization        | `useMemo`, `useCallback` and `React.memo` exist to limit re-renders, and there are none. Use `computed` only to cache an expensive derivation.                                                             |
| Context re-renders | A context change does not re-render its consumers: provide a signal or a store, and only the code that reads it updates. When a signal changes, only the bindings, computeds and effects that read it run. |

## From React to Lumiose

### Derived values

```tsx
// React 19
function Cart() {
  const [price] = useState(5);
  const [qty, setQty] = useState(2);
  const total = useMemo(() => price * qty, [price, qty]);
  return <button onClick={() => setQty(qty + 1)}>{total}</button>;
}
```

```tsx check
// Lumiose
import { computed, signal } from "lumiose";

export function Cart() {
  const price = signal(5);
  const qty = signal(2);
  const total = computed(() => price() * qty());
  return <button onClick={() => qty.update((n) => n + 1)}>{total()}</button>;
}
```

`useMemo(() => a * b, [a, b])` is `computed(() => a() * b())`, without the array. For a cheap
derivation, a plain function `() => a() * b()` is enough.

### Effects

```tsx
// React 19
function Ticker({ ms }: { ms: number }) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTicks((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  useEffect(() => {
    console.log("mounted");
  }, []);
  return <p>{ticks}</p>;
}
```

```tsx check
// Lumiose
import { effect, onMount, signal } from "lumiose";

export function Ticker(props: { ms: number }) {
  const ticks = signal(0);
  effect(() => {
    const id = setInterval(() => ticks.update((n) => n + 1), props.ms);
    return () => clearInterval(id);
  });
  onMount(() => console.log("mounted"));
  return <p>{ticks()}</p>;
}
```

`useEffect(fn, [deps])` is `effect(fn)`: it tracks what it reads, and returns a cleanup as in
React. `useEffect(fn, [])` is `onMount(fn)`: it runs once, untracked, after mount, and may return
a cleanup. For a cleanup returned from `useEffect` or an `AbortController`, there are also
`onCleanup(fn)` and `getAbortSignal()`, aborted when the owner is disposed or the effect re-runs.

### Refs

```tsx
// React 19
function Search() {
  const input = useRef<HTMLInputElement>(null);
  const clicks = useRef(0);
  const focus = () => {
    clicks.current++;
    input.current?.focus();
  };
  return (
    <label>
      <input ref={input} />
      <button onClick={focus}>Focus</button>
    </label>
  );
}
```

```tsx check
// Lumiose
import { ref } from "lumiose";

export function Search() {
  const input = ref<HTMLInputElement>();
  let clicks = 0;
  const focus = () => {
    console.log(++clicks);
    input()?.focus();
  };
  return (
    <label>
      <input ref={input} />
      <button onClick={focus}>Focus</button>
    </label>
  );
}
```

`useRef<HTMLInputElement>(null)` is `ref<HTMLInputElement>()`, read by calling it. A `useRef(value)`
for a mutable value is a `let` variable in the component body: the body runs once.

### Data

```tsx
// React 19
function BookTitle({ id }: { id: string }) {
  const book = use(fetchBook(id));
  return <h2>{book.title}</h2>;
}
```

```tsx check
// Lumiose
import { fetchJSON } from "lumiose";

export async function BookTitle(props: { id: string }) {
  const url = `/api/books/${props.id}`;
  const book = await fetchJSON<{ title: string }>(url);
  return <h2>{book.title}</h2>;
}
```

`use(promise)`, fetching in `useEffect` and TanStack Query become an `async` component that awaits
`fetchJSON()` or `query()` ([Async components](../concepts/async.md)), or
[`@lumiose/query`](../reference/query.md) for client-side polling and retries.

### Everything else

| React                                                   | Lumiose                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useReducer(reducer, init)`                             | A `store()` plus the functions that change it ([a store with actions](../concepts/state.md#a-store-with-actions-zustand-style)).                                                                                                             |
| `useCallback(fn, deps)`, `React.memo(Component)`        | Not needed: functions are created once and components don't re-render.                                                                                                                                                                       |
| `useLayoutEffect(fn, deps)`                             | `effect(fn)` or `onMount(fn)`: there is one kind of effect, and it runs after the DOM writes of the same flush. As with layout effects, its writes render once every effect of that flush has run.                                           |
| `<Ctx value={v}>` (`<Ctx.Provider>`), `useContext(Ctx)` | `<Ctx value={v}>`, `useContext(Ctx)`. The provider reads `value` once: provide a signal or a store for state that changes.                                                                                                                   |
| `use(Context)`                                          | `useContext(Ctx)`, which may be called in conditions too.                                                                                                                                                                                    |
| `<Suspense>`, error boundary classes                    | `<Suspense fallback={…}>` and `<ErrorBoundary fallback={(error, reset) => …}>`.                                                                                                                                                              |
| `useTransition`, `isPending`                            | A re-run of an async component keeps the old UI until it resolves: `isPending()` inside it, and `isBusy()` for anything in flight.                                                                                                           |
| Server Components                                       | Every component, on `static` and `server` routes: it may be `async` and read server-only modules (`*.server.ts`).                                                                                                                            |
| `"use client"`                                          | A `client:*` directive where the component is used (`client:load`, `client:idle`, `client:visible`, …), or an `spa` route. Props must be serializable, as in React.                                                                          |
| `"use server"` functions, `<form action={fn}>`          | Form actions: `export const actions = { save(ctx) {…} }` in the page and `<form method="post" action="?/save">`, which works without JavaScript ([Data and actions](../concepts/data-and-actions.md)).                                       |
| `useActionState(fn, initial)`                           | `actionData<typeof actions>()`, the last result of the page's actions, or the result that `await submit(event)` resolves to.                                                                                                                 |
| `useActionState` per form instance                      | `submission<typeof actions.save>()` in the form's component: its own `isSubmitting()`, `result()` and `error()`, with `onSubmit={save.submit}` ([Data and actions](../concepts/data-and-actions.md)).                                        |
| `useFormStatus()`                                       | `isSubmitting()`, or `isSubmitting("save")` for one named action.                                                                                                                                                                            |
| `useOptimistic(state, update)`                          | `optimistic(source)`, with `.update(fn, submit(event))` ([optimistic updates](../concepts/data-and-actions.md)).                                                                                                                             |
| `<title>`, `<meta>`, `<link>` rendered in a component   | `<Title>`, `<Meta>` and `<Head>`: the deepest wins, and they work in server components too ([Head and document](../concepts/head.md)).                                                                                                       |
| `<ViewTransition>`, `startTransition` around it         | `<ViewTransition name? enter? exit?>`, and the update in `viewTransition(() => …)` ([reference](../reference/components.md#viewtransition)).                                                                                                 |
| `useId()`, `identifierPrefix`                           | `useId()`, and `idPrefix` on `render()` and `renderToStream()` ([useId](../reference/reactivity.md#useid)).                                                                                                                                  |
| `useSyncExternalStore(subscribe, get)`                  | A signal set from the store's `subscribe` ([an external store](../concepts/state.md#an-external-store-zustandvanilla-a-jotai-store-redux)).                                                                                                  |
| `createPortal(children, node)`                          | `<Portal mount={node}>`.                                                                                                                                                                                                                     |
| `createRoot(el).render(<App />)`, `hydrateRoot`         | `render(() => <App />, el)` from `lumiose/dom`; islands and `spa` routes hydrate on their own ([`lumiose/dom`](../reference/dom.md)).                                                                                                        |
| `{items.map((item) => <Row key={item.id} />)}`          | The same, with `items()`. It compiles to a keyed list: as in React, a row with the same key is kept and gets the new item, with its state. `key` is optional; without it rows match by reference ([JSX](../concepts/jsx.md#lists-and-keys)). |
| `className`, `htmlFor`, `style={{ fontWeight: 600 }}`   | `class`, `for`, `style={{ "font-weight": 600 }}` (kebab-case keys).                                                                                                                                                                          |
| `dangerouslySetInnerHTML={{ __html: html }}`            | `innerHTML={html}`.                                                                                                                                                                                                                          |
| `onChange` on a text input (fires on every keystroke)   | `onInput`, or `bind:value={signal}`. Handlers get native events, so `onChange` fires when the value is committed.                                                                                                                            |
| CSS Modules, CSS-in-JS                                  | A `<style>` block in the `.stsx` file, scoped by where it is placed ([Styles](../concepts/styles.md)).                                                                                                                                       |

## What has no equivalent

| React                                               | Instead                                                                                                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React component libraries (Radix, shadcn/ui, MUI)   | No React interop. Use native elements (`<dialog>`, `popover`, `<details>`), web components (with `on:event` listeners for their custom events) or framework-agnostic libraries.                       |
| `React.lazy()`                                      | None. Islands load their module when they hydrate, and `spa` routes load a chunk per page and layout; `<Dynamic component={…}>` renders a component chosen at runtime.                                |
| `useDeferredValue`, transition priorities           | None: updates are fine-grained, not scheduled by priority. Debounce expensive input in the handler.                                                                                                   |
| `React.Children`, `cloneElement`                    | None: `children` is lazy and inserted once. Take a render prop (`renderItem: (item) => JSX.Element`) when a component needs to render content several times.                                          |
| Class components and lifecycle methods              | Function components; `onMount`, `onCleanup` and `effect`.                                                                                                                                             |
| React DevTools (components, props, why it rendered) | The in-page inspector of `lumiose dev` (Alt+Shift+L): the component tree with props, signals and why a binding updated, islands, and Alt+click to the source ([Dev tools](../concepts/dev-tools.md)). |
| `<StrictMode>` double invocation                    | None: setup runs once by design. `lumiose check` reports the reactive mistakes that strict mode helps find in React (`LUM2xxx`).                                                                      |
| Context provided by the page, read inside an island | Islands start a new root, so page context does not reach them ([LUM4010](../errors/LUM4010.md)): pass a prop, or share scoped state with `defineState` ([Sharing state](../concepts/state.md)).       |

## Example

A clock that pauses, in React 19 and then in Lumiose. The effect lists no dependencies, the
handler needs no `useCallback`, and the title updates in place.

```tsx
function Clock({ label }: { label: string }) {
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const toggle = useCallback(() => setPaused((p) => !p), []);
  return (
    <>
      <title>{`${label}: ${new Date(now).toLocaleTimeString()}`}</title>
      <button onClick={toggle}>{paused ? "Resume" : "Pause"}</button>
    </>
  );
}
```

```tsx check file=components/Clock.tsx
// src/components/Clock.tsx
import { Title, effect, signal } from "lumiose";

export function Clock({ label }: { label: string }) {
  const now = signal(Date.now());
  const paused = signal(false);

  // Reads paused(): re-runs, after clearing the interval, when it flips.
  effect(() => {
    if (paused()) return;
    const id = setInterval(() => now.set(Date.now()), 1000);
    return () => clearInterval(id);
  });

  return (
    <>
      <Title>{`${label}: ${new Date(now()).toLocaleTimeString()}`}</Title>
      <button onClick={() => paused.update((p) => !p)}>{paused() ? "Resume" : "Pause"}</button>
    </>
  );
}
```

### On a page

```tsx check file=routes/clock/page.tsx
// src/routes/clock/page.tsx
import { Clock } from "../../components/Clock.tsx";

export default function ClockPage() {
  return (
    <main>
      <h1>Lunch break</h1>
      <Clock client:load label="Lunch" />
    </main>
  );
}
```

The directive makes this one usage interactive; the rest of the page stays server HTML without
JavaScript.

## Common mistakes

| React habit                                                 | What happens in Lumiose                                                                  | Instead                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `const doubled = count() * 2` in the body                   | Computed once, never updates.                                                            | `const doubled = () => count() * 2`, or `computed` ([LUM2001](../errors/LUM2001.md)).         |
| `if (!user()) return <Login />`                             | Checked once, at setup.                                                                  | `{user() ? <Profile /> : <Login />}` in the JSX ([LUM2003](../errors/LUM2003.md)).            |
| `const name = item.name` at the top of a `.map()` row       | Read once: a same-key item updates the row in place, and the copy keeps the first value. | Read `item.name` in the JSX, or put the field in the key ([LUM2001](../errors/LUM2001.md)).   |
| `count.set(…)` in the body                                  | A write during render.                                                                   | Write in handlers and effects ([LUM2002](../errors/LUM2002.md)).                              |
| `effect(() => b.set(a() * 2))` to sync state                | A frame of staleness and an extra flush.                                                 | `const b = computed(() => a() * 2)`.                                                          |
| Reading a signal in an effect only to use its current value | The effect re-runs whenever that signal changes.                                         | `untrack(() => s())` or `s.peek()` reads without subscribing.                                 |
| Asserting right after a write in a test                     | Effects run after the DOM updates, not synchronously.                                    | Call `flush()` before asserting.                                                              |
| `{Card({ title })}`                                         | Skips the component's owner and props handling.                                          | `<Card title={title} />` ([LUM2004](../errors/LUM2004.md)).                                   |
| `{children}` inserted twice                                 | The second insert moves or re-creates the nodes.                                         | Take a render prop such as `renderItem: () => JSX.Element` ([LUM2005](../errors/LUM2005.md)). |
| A signal created and read in an async component's body      | The read re-runs the body, which re-creates the signal.                                  | Read it in JSX, handlers or effects ([LUM2007](../errors/LUM2007.md)).                        |
| A module-scope signal written on the server                 | Shared by every request.                                                                 | Component state, context or `defineState` ([LUM4008](../errors/LUM4008.md)).                  |
| An interactive component on a page without `client:*`       | It renders on the server, and its handlers never run.                                    | Add a directive at the usage site, or make the route `spa`.                                   |
| Passing a function or a class instance to an island         | Island props are serialized into the page.                                               | Pass plain data, and keep handlers inside the island ([LUM4002](../errors/LUM4002.md)).       |
| Setting `document.title` in an effect                       | It fights with `<Title>`.                                                                | Render `<Title>`.                                                                             |

Destructuring props is fine: `({ title })` and `const { title, ...rest } = props` compile to reads
of `props.title`, which stay reactive. Copying a signal's value into a variable is what freezes it.
`<button {...props} />` renders `props.children`, as in React.

## Related

- [Components](../concepts/components.md): setup once, props, children and refs.
- [Signals and reactivity](../concepts/signals.md): `signal`, `computed`, `effect`, owners and scheduling.
- [JSX](../concepts/jsx.md): bindings, compiled `.map()` and ternaries, and the React prop names that differ.
- [Islands](../concepts/islands.md): `client:*` directives, serializable props and slots.
- [Sharing state](../concepts/state.md): context, `defineState`, and what replaces Jotai, Zustand and Valtio.
- [Async components](../concepts/async.md): data loading, re-runs, `<Suspense>` and `isPending()`.
- [Data and actions](../concepts/data-and-actions.md): form actions, `submit()`, `actionData()` and `optimistic()`.
