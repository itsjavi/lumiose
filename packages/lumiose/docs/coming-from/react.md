# Coming from React

> Lumiose JSX reads like React, but components run once and never re-render, render on the server by default, and ship JavaScript only where a page asks for it.

This page maps React 19 habits to Lumiose's current API. The linked pages have the full rules.
Using a React framework too? [Coming from Next.js](nextjs.md) and
[Coming from React Router](react-router.md) cover its side.

## Mental model

In React, a state change re-runs the component function. Hooks keep their state between runs
by call order, and effects list their dependencies so React knows when to re-run them.

In Lumiose, the component body runs **once per instance**: it creates signals, effects and
handlers, then returns JSX. JSX expressions that read signals compile to bindings that update
their part of the DOM in place. When a signal changes, only the bindings, computeds and effects
that read it run again. Local variables are ordinary variables, and a closure reads the current
value because it calls `count()` when it runs ([Components](../concepts/components.md),
[Signals](../concepts/signals.md)).

The exception is an **async component**: when a prop or signal read in its body changes, the body
runs again, and signals created in the body start fresh ([Async components](../concepts/async.md)).

**Server first.** Every component renders on the server unless a page says otherwise, as React
Server Components do. A page ships no JavaScript until a usage site adds a `client:*` directive
(`<Clock client:load />` makes that one instance an [island](../concepts/islands.md)) or the route
is an `spa` route, whose whole subtree hydrates and navigates on the client
([Rendering modes](../concepts/rendering-modes.md)). There is no `"use client"` file boundary: the
same component is static on one page and interactive on another.

### What goes away

- **The rules of hooks.** `signal`, `computed`, `effect`, `onCleanup` and `useContext` are ordinary
  functions: call them in conditions, loops and helper functions. Nothing depends on call order.
- **Dependency arrays.** Effects and computeds subscribe to the signals they read, and collect them
  again on every run, so a dependency cannot be missing, and a branch that stops reading a signal
  stops depending on it.
- **Stale closures.** A handler or a timer callback calls `count()` when it runs, so it gets the
  current value. There is no closure from an older render to capture.
- **Memoization.** `useMemo`, `useCallback` and `React.memo` exist to limit re-renders, and there
  are none. Use `computed` only to cache an expensive derivation.
- **Context re-renders.** A context change does not re-render its consumers: provide a signal or a
  store, and only the code that reads it updates.

## From React to Lumiose

| React                                                   | Lumiose                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `const [count, setCount] = useState(0)`                 | `const count = signal(0)`: read `count()`, write `count.set(1)` or `count.update((n) => n + 1)`.                                                                                                       |
| `useReducer(reducer, init)`                             | A `store()` plus the functions that change it ([a store with actions](../concepts/state.md#a-store-with-actions-zustand-style)).                                                                       |
| `useMemo(() => a * b, [a, b])`                          | `computed(() => a() * b())`, or a plain function `() => a() * b()` for cheap derivations.                                                                                                              |
| `useCallback(fn, deps)`, `React.memo(Component)`        | Not needed: functions are created once and components don't re-render.                                                                                                                                 |
| `useEffect(fn, [deps])`                                 | `effect(fn)`: it tracks what it reads. Return a cleanup, as in React.                                                                                                                                  |
| `useEffect(fn, [])`                                     | `onMount(fn)`: runs once, untracked, after mount. It may return a cleanup.                                                                                                                             |
| `useLayoutEffect(fn, deps)`                             | `effect(fn)` or `onMount(fn)`: there is one kind of effect, and it runs after the DOM writes of the same flush.                                                                                        |
| Cleanup returned from `useEffect`, `AbortController`    | `onCleanup(fn)`, and `getAbortSignal()`, aborted when the owner is disposed or the effect re-runs.                                                                                                     |
| `useRef<HTMLInputElement>(null)`                        | `const input = ref<HTMLInputElement>()`, then `<input ref={input} />` and `input()?.focus()`.                                                                                                          |
| `useRef(value)` for a mutable value                     | A `let` variable in the component body: the body runs once.                                                                                                                                            |
| `<Ctx value={v}>` (`<Ctx.Provider>`), `useContext(Ctx)` | `<Ctx value={v}>`, `useContext(Ctx)`. The provider reads `value` once: provide a signal or a store for state that changes.                                                                             |
| `use(Context)`                                          | `useContext(Ctx)`, which may be called in conditions too.                                                                                                                                              |
| `use(promise)`, fetching in `useEffect`, TanStack Query | An `async` component that awaits `fetchJSON()` or `query()` ([Async components](../concepts/async.md)), or [`@lumiose/query`](../reference/query.md) for client-side polling and retries.              |
| `<Suspense>`, error boundary classes                    | `<Suspense fallback={…}>` and `<ErrorBoundary fallback={(error, reset) => …}>`.                                                                                                                        |
| `useTransition`, `isPending`                            | A re-run of an async component keeps the old UI until it resolves: `isPending()` inside it, and `isBusy()` for anything in flight.                                                                     |
| Server Components                                       | Every component, on `static` and `server` routes: it may be `async` and read server-only modules (`*.server.ts`).                                                                                      |
| `"use client"`                                          | A `client:*` directive where the component is used (`client:load`, `client:idle`, `client:visible`, …), or an `spa` route. Props must be serializable, as in React.                                    |
| `"use server"` functions, `<form action={fn}>`          | Form actions: `export const actions = { save(ctx) {…} }` in the page and `<form method="post" action="?/save">`, which works without JavaScript ([Data and actions](../concepts/data-and-actions.md)). |
| `useActionState(fn, initial)`                           | `actionData<typeof actions>()`, the last result of the page's actions, or the result that `await submit(event)` resolves to.                                                                           |
| `useActionState` per form instance                      | `submission<typeof actions.save>()` in the form's component: its own `isSubmitting()`, `result()` and `error()`, with `onSubmit={save.submit}` ([Data and actions](../concepts/data-and-actions.md)).  |
| `useFormStatus()`                                       | `isSubmitting()`, or `isSubmitting("save")` for one named action.                                                                                                                                      |
| `useOptimistic(state, update)`                          | `optimistic(source)`, with `.update(fn, submit(event))` ([optimistic updates](../concepts/data-and-actions.md)).                                                                                       |
| `<title>`, `<meta>`, `<link>` rendered in a component   | `<Title>`, `<Meta>` and `<Head>`: the deepest wins, and they work in server components too ([Head and document](../concepts/head.md)).                                                                 |
| `<ViewTransition>`, `startTransition` around it         | `<ViewTransition name? enter? exit?>`, and the update in `viewTransition(() => …)` ([reference](../reference/components.md#viewtransition)).                                                           |
| `useId()`, `identifierPrefix`                           | `useId()`, and `idPrefix` on `render()` and `renderToStream()` ([useId](../reference/reactivity.md#useid)).                                                                                            |
| `useSyncExternalStore(subscribe, get)`                  | A signal set from the store's `subscribe` ([an external store](../concepts/state.md#an-external-store-zustandvanilla-a-jotai-store-redux)).                                                            |
| `createPortal(children, node)`                          | `<Portal mount={node}>`.                                                                                                                                                                               |
| `createRoot(el).render(<App />)`, `hydrateRoot`         | `render(() => <App />, el)` from `lumiose/dom`; islands and `spa` routes hydrate on their own ([`lumiose/dom`](../reference/dom.md)).                                                                  |
| `{items.map((item) => <Row key={item.id} />)}`          | The same, with `items()`. It compiles to a keyed list; `key` is optional ([JSX](../concepts/jsx.md)).                                                                                                  |
| `className`, `htmlFor`, `style={{ fontWeight: 600 }}`   | `class`, `for`, `style={{ "font-weight": 600 }}` (kebab-case keys).                                                                                                                                    |
| `dangerouslySetInnerHTML={{ __html: html }}`            | `innerHTML={html}`.                                                                                                                                                                                    |
| `onChange` on a text input (fires on every keystroke)   | `onInput`, or `bind:value={signal}`. Handlers get native events, so `onChange` fires when the value is committed.                                                                                      |
| CSS Modules, CSS-in-JS                                  | A `<style>` block in the `.stsx` file, scoped by where it is placed ([Styles](../concepts/styles.md)).                                                                                                 |

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

A clock that pauses, in React 19:

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

The same clock in Lumiose. The effect lists no dependencies, the handler needs no `useCallback`,
and the title updates in place:

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

On a page, the directive makes this one usage interactive; the rest of the page stays server
HTML without JavaScript:

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

## Common mistakes

| React habit                                                 | What happens in Lumiose                                 | Instead                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `const doubled = count() * 2` in the body                   | Computed once, never updates.                           | `const doubled = () => count() * 2`, or `computed` ([LUM2001](../errors/LUM2001.md)).         |
| `if (!user()) return <Login />`                             | Checked once, at setup.                                 | `{user() ? <Profile /> : <Login />}` in the JSX ([LUM2003](../errors/LUM2003.md)).            |
| `count.set(…)` in the body                                  | A write during render.                                  | Write in handlers and effects ([LUM2002](../errors/LUM2002.md)).                              |
| `effect(() => b.set(a() * 2))` to sync state                | A frame of staleness and an extra flush.                | `const b = computed(() => a() * 2)`.                                                          |
| Reading a signal in an effect only to use its current value | The effect re-runs whenever that signal changes.        | `untrack(() => s())` or `s.peek()` reads without subscribing.                                 |
| Asserting right after a write in a test                     | Effects run after the DOM updates, not synchronously.   | Call `flush()` before asserting.                                                              |
| `{Card({ title })}`                                         | Skips the component's owner and props handling.         | `<Card title={title} />` ([LUM2004](../errors/LUM2004.md)).                                   |
| `{children}` inserted twice                                 | The second insert moves or re-creates the nodes.        | Take a render prop such as `renderItem: () => JSX.Element` ([LUM2005](../errors/LUM2005.md)). |
| A signal created and read in an async component's body      | The read re-runs the body, which re-creates the signal. | Read it in JSX, handlers or effects ([LUM2007](../errors/LUM2007.md)).                        |
| A module-scope signal written on the server                 | Shared by every request.                                | Component state, context or `defineState` ([LUM4008](../errors/LUM4008.md)).                  |
| An interactive component on a page without `client:*`       | It renders on the server, and its handlers never run.   | Add a directive at the usage site, or make the route `spa`.                                   |
| Passing a function or a class instance to an island         | Island props are serialized into the page.              | Pass plain data, and keep handlers inside the island ([LUM4002](../errors/LUM4002.md)).       |
| Setting `document.title` in an effect                       | It fights with `<Title>`.                               | Render `<Title>`.                                                                             |

Destructuring props is fine: `({ title })` compiles to reads of `props.title`, which stay reactive.
Copying a signal's value into a variable is what freezes it.

## Related

- [Components](../concepts/components.md): setup once, props, children and refs.
- [Signals and reactivity](../concepts/signals.md): `signal`, `computed`, `effect`, owners and scheduling.
- [JSX](../concepts/jsx.md): bindings, compiled `.map()` and ternaries, and the React prop names that differ.
- [Islands](../concepts/islands.md): `client:*` directives, serializable props and slots.
- [Sharing state](../concepts/state.md): context, `defineState`, and what replaces Jotai, Zustand and Valtio.
- [Async components](../concepts/async.md): data loading, re-runs, `<Suspense>` and `isPending()`.
- [Data and actions](../concepts/data-and-actions.md): form actions, `submit()`, `actionData()` and `optimistic()`.
