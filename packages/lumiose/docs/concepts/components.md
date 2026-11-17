# Components

> A component is a function that returns JSX: its body runs once, as setup, and signals update the JSX in place.

## Concept

### Setup runs once

The body runs once per instance. Nothing re-renders: only JSX that reads a
[signal](signals.md) updates.

```tsx check
import { signal } from "lumiose";

export function Likes() {
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>♥ {count()}</button>;
}
```

### Props stay reactive

Props are the single parameter. Destructured props stay live: the child follows the parent's
signal.

```tsx check
import { signal } from "lumiose";

function Badge({ label, count = 0 }: { label: string; count?: number }) {
  return (
    <span>
      {label}: {count}
    </span>
  );
}

export function Inbox() {
  const unread = signal(3);
  return <Badge label="Unread" count={unread()} />;
}
```

> **Details:** [props](../reference/components.md#props): `...rest`, nested destructuring, lazy
> server props.

### Children

`children` is lazy: it renders where you insert it, once. Spreading props onto an empty element
renders them too.

```tsx check
function Button(props: JSX.HTMLProps<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

export function Save() {
  return <Button class="primary">Save</Button>;
}
```

> **Also:** [named slots](../reference/components.md#children),
> [file types](../reference/components.md#file-types), [async components](async.md).

## API

| API                                      | Use                                        |
| ---------------------------------------- | ------------------------------------------ |
| `function Name(props) { return <… /> }`  | A component: PascalCase, returns JSX.      |
| `children` prop                          | Lazy content. Insert once.                 |
| `ref<T>()`                               | A `ref` callback that reads like a signal. |
| `useId()`                                | A unique id, the same after hydration.     |
| `onMount(fn)`, `onCleanup(fn)`           | Run after mount; run on disposal.          |
| `viewTransition(fn)`, `<ViewTransition>` | Animate a state update.                    |
| `<Dynamic component={X} />`              | A component or tag chosen at runtime.      |
| `<Portal mount={node}>`                  | Render children elsewhere.                 |

Signatures: [reference: components](../reference/components.md).

## Example

`ref()` reads as the element once it is mounted; `onMount` runs then.

```stsx check
import { onMount, ref, signal } from "lumiose";

export function SearchBox(props: { label: string }) {
  const query = signal("");
  const input = ref<HTMLInputElement>();

  onMount(() => input()?.focus());

  return (
    <label class="search">
      {props.label}
      <input ref={input} bind:value={query} />
      <span>Searching for “{query()}”</span>
    </label>
  );
}

<style>
  .search { display: grid; gap: 0.5rem; }
</style>
```

## Common mistakes

- **Reading a signal once in setup.** `const doubled = count() * 2` never updates. Use
  `() => count() * 2` or `computed` (`LUM2001`).
- **Returning early on reactive state.** Put the condition in the JSX:
  `{user() ? <Profile /> : <Login />}` (`LUM2003`).
- **Calling a component as a function.** Write `<Card title={title} />` (`LUM2004`).
- **Inserting `children` twice.** Take a render prop instead (`LUM2005`).
- **Writing a signal in the body.** Write in handlers or effects (`LUM2002`).
- **React habits.** No hooks rules or dependency arrays; `class` and `for`, not `className` and
  `htmlFor` ([Coming from React](../coming-from/react.md)).

## Related diagnostics

- [LUM1006](../errors/LUM1006.md): CSS in `.tsx`.
- The mistakes above: [LUM2001](../errors/LUM2001.md), [LUM2002](../errors/LUM2002.md),
  [LUM2003](../errors/LUM2003.md), [LUM2004](../errors/LUM2004.md),
  [LUM2005](../errors/LUM2005.md).

See also: [JSX](jsx.md), [Styles](styles.md).
