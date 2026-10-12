# Components

> A component is a PascalCase function that returns JSX. Its body runs once, as setup; signals make the JSX update in place.

## Concept

**Files.** Components live in `.stsx` files (TSX plus raw-CSS `<style>` blocks) or plain `.tsx`
files. A file may export many components. Logic, tokens, endpoints and server code live in `.ts`.

| Extension | Contents                                                              |
| --------- | --------------------------------------------------------------------- |
| `.stsx`   | TSX plus `<style>` blocks. Use it for components with styles.         |
| `.tsx`    | Plain TSX. A `<style>` block here is `LUM1006` ("rename to `.stsx`"). |
| `.ts`     | Everything else.                                                      |

**Setup once.** The body of a component runs once per instance. There is no re-render: JSX
expressions that read signals become fine-grained bindings, and only those update. Local variables
are ordinary variables; state that changes lives in [signals](signals.md).

**Props.** Props are the single parameter. The compiler keeps them reactive, even when you
destructure them: `({ title, count = 0 })` is rewritten to reads of `props.title` and
`props.count`, so a parent passing a signal value keeps the child up to date. `...rest` stays
reactive too.

On the server, where nothing is reactive, a prop expression is evaluated **lazily and at most once
per component instance** (decision-28): the first read runs it, later reads reuse the value, and a
prop the component never reads never runs. `<Filters labels={listLabels()} />` queries the labels
once per render however often `Filters` reads `props.labels`. In the browser props stay live: each
read re-evaluates the expression, so keep prop expressions free of side effects.

**Children** are lazy: `children` is evaluated where you insert it. Insert it once; to render
something several times, take a render function as a prop. Named slots are ordinary props that hold
JSX.

**Refs.** `ref` takes a callback `(el) => void`. `ref<T>()` returns such a callback that can also be
read like a signal.

**Async.** Any component may be `async` and `await` data in its body; see
[Async components](async.md).

## API

| API                                     | Use                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `function Name(props) { return <… /> }` | A component. PascalCase, returns JSX.                                           |
| `children` prop                         | Lazy content passed between the tags. Insert once.                              |
| `ref<T>()`                              | A ref callback that reads like a signal (`input()`), `undefined` until mounted. |
| `useId()`                               | A unique id for `id`/`for` and `aria-*` pairs, the same after hydration.        |
| `onMount(fn)`, `onCleanup(fn)`          | Run after mount; run when the component is disposed.                            |
| `<Dynamic component={X} … />`           | Render a component (or tag name) chosen at runtime.                             |
| `<Portal mount={node}>`                 | Render children elsewhere in the document.                                      |

Types: a component's return type is `JSX.Element`. Props are a plain interface; `children?:
JSX.Element` for content.

## Example

```stsx check
import { onMount, ref, signal } from "lumiose";

interface Props {
  label: string;
  initial?: string;
  children?: JSX.Element;
}

export function SearchBox({ label, initial = "", children }: Props) {
  const query = signal(initial);
  const input = ref<HTMLInputElement>();

  onMount(() => input()?.focus());

  return (
    <form class="search" onSubmit={(event) => event.preventDefault()}>
      <label>
        {label}
        <input ref={input} bind:value={query} />
      </label>
      <p>Searching for “{query()}”</p>
      {children}
    </form>
  );
}

export function Page() {
  return (
    <SearchBox label="Books">
      <small>Try “Dune”.</small>
    </SearchBox>
  );
}

<style>
  .search { display: grid; gap: 0.5rem; }
</style>
```

Both components share the `<style>` block at the end of the file: by convention, each `.stsx`
file has one, after its components ([Styles](styles.md)).

## Common mistakes

- **Reading a signal once in setup and expecting it to update.** `const doubled = count() * 2`
  is computed once. Use a function or `computed`: `const doubled = () => count() * 2`. The compiler
  warns with `LUM2001`.
- **Returning early on reactive state.** `if (!user()) return <Login />` runs once. Put the
  condition in the JSX: `{user() ? <Profile /> : <Login />}` (`LUM2003`).
- **Calling a component as a function.** `{Card({ title })}` skips the component's owner and
  props handling. Write `<Card title={title} />` (`LUM2004`).
- **Inserting `children` twice.** The second insert moves or re-creates the nodes. Take a render
  prop such as `renderItem: () => JSX.Element` instead (`LUM2005`).
- **Writing a signal in the component body.** Setup runs during render; a write there
  (`count.set(…)`) re-triggers bindings mid-render. Write in handlers or effects (`LUM2002`).
- **Expecting React re-renders.** There are no hooks rules and no dependency arrays: nothing
  re-runs except bindings and effects that read signals.
- **`className`, `htmlFor`.** Use `class` and `for`; the React names are type errors.

## Related diagnostics

- [LUM1006](../errors/LUM1006.md): raw CSS in a `.tsx` file.
- [LUM2001](../errors/LUM2001.md): stale derived value.
- [LUM2002](../errors/LUM2002.md): signal write during render.
- [LUM2003](../errors/LUM2003.md): reactive early return.
- [LUM2004](../errors/LUM2004.md): component called as a function.
- [LUM2005](../errors/LUM2005.md): children inserted twice.

See also: [JSX](jsx.md), [Signals](signals.md), [reference: components](../reference/components.md).
