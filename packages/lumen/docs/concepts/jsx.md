# JSX

> JSX reads like React (`.map()`, ternaries, `onClick`) but compiles to cloned templates with fine-grained bindings. Only expressions that read signals update.

## Concept

**Bindings.** The compiler looks at each JSX expression:

- Literals and plain identifiers are **static**: written once.
- Calls and member access (`count()`, `user.name`, `props.title`) become **bindings** that re-run
  when a signal they read changes, and write only the part of the DOM they own.
- `untrack(() => …)` opts an expression out.

**Compiled idioms.** There are no `<For>` or `<Show>` components; ordinary JavaScript compiles to
the efficient form:

| Source                                              | Compiled to                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{items().map((item, i) => <Row key={item.id} />)}` | A keyed list. `key` is optional (items are keyed by reference otherwise). `i` becomes a reactive index only if you use it.                                                                                                            |
| `item.id === selected()` inside `.map`              | An O(1) selector: a selection change touches two rows.                                                                                                                                                                                |
| `{c() ? <A /> : <B />}`, `{c() && <A />}`           | A memoised branch: switches only when the condition flips.                                                                                                                                                                            |
| `{count() * 2}`, ``{`#${id}`}``, `{String(x)}`      | Provably text: a text node of the template, updated with `setText` (written once when nothing reactive is read). Applies to sole children and to children between elements; a `const` initialised with such an expression counts too. |
| `{row.label()}`, `{id}`, `{props.title}`            | Maybe text, alone between nodes (or the only child): also a text node of the template, written by `insertText`. Text values update the node in place; nodes, arrays and other values render in a region before it.                    |
| `{fn()}` next to text or another `{…}`              | A dynamic insert (a region), since adjacent text nodes would merge when the HTML is parsed.                                                                                                                                           |

**Elements.**

| Prop                         | Rule                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                      | A string, an array, or a `{ name: boolean }` record (nested arrays allowed). `className` is a type error.                                                                                                                                                                                                                  |
| `style`                      | A string, or an object with **kebab-case** keys, including `--custom` properties. Each key updates on its own.                                                                                                                                                                                                             |
| `aria-*`, `spellcheck`, …    | Booleans are written as `"true"`/`"false"` (`aria-pressed={false}` renders `aria-pressed="false"`): `aria-*`, `contenteditable`, `draggable`, `spellcheck` and the other enumerated attributes, static or not. Other attributes: `true` adds the attribute empty (`hidden`); `false`, `null` and `undefined` leave it out. |
| `onClick`, `onKeyDown`, …    | camelCase handlers. Bubbling events are delegated (one listener per type at `document`); non-bubbling ones (`onFocus`, `onMouseEnter`, `onScroll`) get a direct listener.                                                                                                                                                  |
| `on:click`, `on:my-event`    | A native `addEventListener` listener with the exact event name. Use it for custom and web-component events.                                                                                                                                                                                                                |
| `bind:value`, `bind:checked` | Two-way binding to a writable signal, on `input`, `select` and `textarea`.                                                                                                                                                                                                                                                 |
| `attach={[fn]}`              | Runs `fn(el)` with the element in a tracked scope; it may return a cleanup.                                                                                                                                                                                                                                                |
| `ref={fn}`                   | Called with the element. `ref<T>()` makes a callback you can read like a signal.                                                                                                                                                                                                                                           |
| `innerHTML`                  | Sets unescaped HTML. The lint rule `no-unsafe-html` warns.                                                                                                                                                                                                                                                                 |
| `key`                        | Allowed on intrinsic elements and components (list identity).                                                                                                                                                                                                                                                              |
| `client:*`                   | Island directives, on components only. See [Islands](islands.md).                                                                                                                                                                                                                                                          |

Handlers receive the **native** event, with `currentTarget` typed as the element. There are no
synthetic events.

## API

JSX types come from `lumen/jsx-runtime` (via `jsxImportSource: "lumen"`) and the global `JSX`
namespace from `lumen/env`:

| Type                     | Meaning                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `JSX.Element`            | Anything JSX can render: nodes, strings, numbers, arrays, functions, `null`. |
| `JSX.ClassValue`         | The `class` prop value.                                                      |
| `JSX.CSSProperties`      | The `style` object (kebab-case keys and `--custom` properties).              |
| `JSX.EventHandler<E, T>` | A handler: the native event `E` with `currentTarget: T`.                     |
| `JSX.Ref<T>`             | The value of `ref<T>()`.                                                     |
| `JSX.HTMLProps<T>`       | Props of an HTML element, for wrappers and custom elements.                  |

See [JSX types and tsconfig](../reference/jsx.md) for custom elements and the full rules.

## Example

```tsx check
import { signal } from "lumen";

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
  const progress = signal(40);

  const add = (event: SubmitEvent) => {
    event.preventDefault();
    todos.update((list) => [...list, { id: Date.now(), title: draft() }]);
    draft.set("");
  };

  return (
    <section style={{ "--progress": `${progress()}%`, "max-inline-size": "40rem" }}>
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

- **React prop names.** `className` → `class`, `htmlFor` → `for`, `onclick`/`onKeydown` →
  `onClick`/`onKeyDown` (camelCase after `on`). The wrong forms are type errors.
- **camelCase style keys.** `style={{ fontWeight: 600 }}` is a type error; write
  `{ "font-weight": 600 }`, as in CSS. Numbers get no units: write `"12px"`.
- **Passing a value to `bind:value`.** It needs the signal itself: `bind:value={draft}`, not
  `bind:value={draft()}`.
- **Custom events with `onX`.** `onMyEvent` is not an event prop; write `on:my-event`.
- **Using the index outside the row.** The `i` of `.map((item, i) => …)` is a reactive index that
  belongs to its row; storing it in an outer variable or closure that outlives the row is
  `LUM2006`.
- **Wrapping lists in helper components.** `{items().map(…)}` already compiles to a keyed list;
  there is no `<For>`.
- **`innerHTML` with user input.** It is not escaped. Prefer text children.

## Related diagnostics

- [LUM2004](../errors/LUM2004.md): component called as a function.
- [LUM2005](../errors/LUM2005.md): children inserted twice.
- [LUM2006](../errors/LUM2006.md): reactive index escapes its callback.
- [LUM1001](../errors/LUM1001.md): syntax error.

See also: [Components](components.md), [Styles](styles.md), [reference: JSX types](../reference/jsx.md).
