# JSX

> JSX reads like React but compiles to cloned templates with fine-grained bindings, so only the expressions that read signals update.

## Concept

### Expressions are bindings

A call or a member access (`count()`, `props.label`) re-runs when a signal it read changes, and
writes only its own part of the DOM. Literals and plain identifiers such as `step` are written
once.

```tsx check
import { signal } from "lumiose";

export function Clicker(props: { label: string }) {
  const count = signal(0);
  const step = 2;

  return (
    <button onClick={() => count.update((n) => n + step)}>
      {props.label}: {count()} (+{step})
    </button>
  );
}
```

> **Details:** `untrack(() => …)` opts an expression out. What each expression compiles to:
> [Bindings and compiled idioms](../reference/jsx.md#bindings-and-compiled-idioms).

### Conditions and lists

There is no `<For>` or `<Show>`. `.map` compiles to a keyed list, `? :` and `&&` to a branch that
switches only when its condition flips, and `tab.id === selected()` to an O(1) selector.

```tsx check
import { signal } from "lumiose";

export function Tabs() {
  const tabs = signal([
    { id: "home", label: "Home" },
    { id: "docs", label: "Docs" },
  ]);
  const selected = signal("home");

  return (
    <nav>
      {tabs().map((tab) => (
        <button
          key={tab.id}
          class={{ active: tab.id === selected() }}
          onClick={() => selected.set(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      {selected() === "docs" ? <p>Reading.</p> : null}
    </nav>
  );
}
```

### Lists and keys

With a `key`, the key alone decides whether a row is kept. Here the reload brings a new object
with the same id: the `<li>` and its checked box stay, and only the title updates. Without a key,
rows match by item reference, so a new object makes a new row.

```tsx check
import { signal } from "lumiose";

export function Todos() {
  const todos = signal([{ id: 1, title: "Write docs" }]);
  const reload = () => {
    todos.set([{ id: 1, title: "Write the docs" }]);
  };

  return (
    <>
      <ul>
        {todos().map((todo) => (
          <li key={todo.id}>
            <input type="checkbox" />
            <span>{todo.title}</span>
          </li>
        ))}
      </ul>
      <button onClick={reload}>Reload</button>
    </>
  );
}
```

> **Details:** key rows that hold user state by the record's id, never by the index. What a key
> may read, reactive indexes, and values copied at the top of the callback:
> [Lists and keys in depth](../reference/jsx.md#lists-and-keys-in-depth).

### Element props

`class` takes a string, an array or a record, and `style` an object with kebab-case keys.
`bind:value` binds a signal both ways, `ref` gives the element, and `attach` runs with the element
once it is in the document.

```tsx check
import { ref, signal } from "lumiose";

export function NameField() {
  const name = signal("");
  const input = ref<HTMLInputElement>();
  const focus = (el: HTMLInputElement) => el.focus();

  return (
    <label
      class={["field", { empty: name() === "" }]}
      style={{ "font-weight": name() === "" ? 400 : 600 }}
    >
      <input ref={input} bind:value={name} attach={[focus]} />
      <button onClick={() => input()?.select()}>Select</button>
    </label>
  );
}
```

> **Details:** every prop and its rules (boolean attributes, spreads, `innerHTML`, raw text):
> [Element props](../reference/jsx.md#element-props). `attach` timing:
> [When attach runs](../reference/jsx.md#when-attach-runs). `bind:x` on components and custom
> elements: [bind:](../reference/jsx.md#bind-on-components-and-custom-elements).

## API

| Prop                         | Rule                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `class`, `style`             | Not `className`; kebab-case style keys and `--custom` ones.  |
| `onClick`, `onKeyDown`       | camelCase handlers. They get the native event, never a copy. |
| `on:click`, `on:my-event`    | A native listener with the exact event name.                 |
| `bind:value`, `bind:checked` | Two-way binding to a signal; `bind:x` on components too.     |
| `ref={fn}`, `attach={[fn]}`  | The element; an effect on the element, with a cleanup.       |
| `key`                        | List identity, on elements and components.                   |
| `innerHTML`                  | Unescaped HTML ([Security](security.md)).                    |
| `{...props}`                 | Applies each prop in order, `children` included.             |
| `client:*`                   | Island directives, on components ([Islands](islands.md)).    |

Types come from `lumiose/jsx-runtime` (`jsxImportSource: "lumiose"`) and the global `JSX`
namespace of `lumiose/env`: `JSX.Element`, `JSX.ClassValue`, `JSX.CSSProperties`,
`JSX.EventHandler<E, T>`, `JSX.Ref<T>` and `JSX.HTMLProps<T>`. Their meaning, custom elements and
the tsconfig: [JSX types and tsconfig](../reference/jsx.md).

## Example

```tsx check
import { signal } from "lumiose";

interface Todo {
  id: number;
  title: string;
}

export function TodoList() {
  const todos = signal<Todo[]>([
    { id: 1, title: "Write docs" },
    { id: 2, title: "Ship" },
  ]);
  const selected = signal(1);
  const draft = signal("");

  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const todo = { id: Date.now(), title: draft() };
    todos.update((list) => [...list, todo]);
    draft.set("");
  };

  return (
    <section style={{ "max-inline-size": "40rem" }}>
      <form onSubmit={add}>
        <input bind:value={draft} on:focus={(event) => event.currentTarget.select()} />
        <button disabled={draft() === ""}>Add</button>
      </form>
      {todos().length === 0 ? (
        <p>Nothing to do.</p>
      ) : (
        <ul>
          {todos().map((todo) => (
            <li
              key={todo.id}
              class={["todo", { active: todo.id === selected() }]}
              onClick={() => selected.set(todo.id)}
            >
              {todo.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

## Common mistakes

- **React prop names.** `className`, `htmlFor`, `onclick` and camelCase style keys are type
  errors: write `class`, `for`, `onClick`, `"font-weight"`.
- **`bind:value={draft()}`.** Pass the signal itself: `bind:value={draft}`.
- **Custom events with `onX`.** Write `on:my-event`.
- **Using the index outside its row** (`LUM2006`).
- **Copying the item at the top of a keyed row** (`LUM2001`). Read `item.name` in the JSX.
- **`innerHTML` with user input.** It is not escaped.

The full list: [Common JSX mistakes](../reference/jsx.md#common-jsx-mistakes).

## Related diagnostics

- [LUM2001](../errors/LUM2001.md): stale derived value (also a keyed row's setup copy of its item).
- [LUM2004](../errors/LUM2004.md): component called as a function.
- [LUM2005](../errors/LUM2005.md): children inserted twice.
- [LUM2006](../errors/LUM2006.md): reactive index escapes its callback.
- [LUM2008](../errors/LUM2008.md): unsupported list key.
- [LUM1001](../errors/LUM1001.md): syntax error.

See also: [Components](components.md), [Styles](styles.md), [reference: JSX types](../reference/jsx.md).
