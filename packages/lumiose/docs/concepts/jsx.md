# JSX

> JSX reads like React but compiles to cloned templates with fine-grained bindings, so only the expressions that read signals update.

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
| `{items().map((item, i) => <Row key={item.id} />)}` | A keyed list. `key` is optional (items are keyed by reference otherwise). `i` becomes a reactive index only if you use it. See [Lists and keys](#lists-and-keys).                                                                     |
| `item.id === selected()` inside `.map`              | An O(1) selector: a selection change touches two rows.                                                                                                                                                                                |
| `{c() ? <A /> : <B />}`, `{c() && <A />}`           | A memoised branch: switches only when the condition flips.                                                                                                                                                                            |
| `{count() * 2}`, ``{`#${id}`}``, `{String(x)}`      | Provably text: a text node of the template, updated with `setText` (written once when nothing reactive is read). Applies to sole children and to children between elements; a `const` initialised with such an expression counts too. |
| `{row.label()}`, `{id}`, `{props.title}`            | Maybe text, alone between nodes (or the only child): also a text node of the template, written by `insertText`. Text values update the node in place; nodes, arrays and other values render in a region before it.                    |
| `{fn()}` next to text or another `{…}`              | A dynamic insert (a region), since adjacent text nodes would merge when the HTML is parsed.                                                                                                                                           |

**Elements.**

| Prop                         | Rule                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`                      | A string, an array, or a `{ name: boolean }` record (nested arrays allowed). `className` is a type error.                                                                                                                                                                                                                                                                                                    |
| `style`                      | A string, or an object with **kebab-case** keys, including `--custom` properties. Each key updates on its own.                                                                                                                                                                                                                                                                                               |
| `aria-*`, `spellcheck`, …    | Booleans are written as `"true"`/`"false"` (`aria-pressed={false}` renders `aria-pressed="false"`): `aria-*`, `contenteditable`, `draggable`, `spellcheck` and the other enumerated attributes, static or not. Other attributes: `true` adds the attribute empty (`hidden`); `false`, `null` and `undefined` leave it out.                                                                                   |
| `onClick`, `onKeyDown`, …    | camelCase handlers. Bubbling events are delegated (one listener per type at `document`); non-bubbling ones (`onFocus`, `onMouseEnter`, `onScroll`) get a direct listener.                                                                                                                                                                                                                                    |
| `on:click`, `on:my-event`    | A native `addEventListener` listener with the exact event name. Use it for custom and web-component events. Like `onX` handlers, it runs inside a batch: its writes render together, and the DOM is current when the event returns.                                                                                                                                                                          |
| Props of a custom element    | The element's property when it defines one (arrays and objects as they are), else the attribute, as in React 19. See [Web components](../guides/web-components.md).                                                                                                                                                                                                                                          |
| `bind:value`, `bind:checked` | Two-way binding to a writable signal, on `input`, `select` and `textarea`. `bind:x` also works on components and custom elements (below).                                                                                                                                                                                                                                                                    |
| `attach={[fn]}`              | Runs `fn(el)` with the element in a tracked scope, once the element is in the document (below); it may return a cleanup.                                                                                                                                                                                                                                                                                     |
| `ref={fn}`                   | Called with the element. `ref<T>()` makes a callback you can read like a signal.                                                                                                                                                                                                                                                                                                                             |
| `innerHTML`                  | Sets unescaped HTML. The lint rule `no-unsafe-html` warns. Only as a written prop: a spread drops `innerHTML`, `textContent` and `srcdoc`, on the server and the client, so an object from JSON cannot inject markup. Written next to a spread (`<div {...rest} innerHTML={html} />`), they apply as written, and replace the spread's `children`.                                                           |
| `key`                        | Allowed on intrinsic elements and components (list identity).                                                                                                                                                                                                                                                                                                                                                |
| `<script>`, `<style>` text   | Raw text: written as it is, never `&lt;`; the character after a `<` that could open a tag is escaped (`<\u0069mg`, in a style `<\69 mg`; `<\/`, `<\!`), so a value can neither end the element nor open a tag inside `<svg>` or `<math>`. In a JSON script every `<` is `\u003c`. See [Security](security.md), and [Head](head.md) for JSON-LD.                                                              |
| `{...props}`, `children`     | A spread applies every prop it carries, in order with the other attributes. An element without content of its own renders the `children` of its spreads or of a `children` attribute, as in React: `<button {...props} />` renders what the caller passed. Written content wins. When the spread has no `children` prop at all, the element's content is left alone, so a script or the browser may fill it. |
| `client:*`                   | Island directives, on components only. See [Islands](islands.md).                                                                                                                                                                                                                                                                                                                                            |

Handlers receive the **native** event, with `currentTarget` typed as the element. There are no
synthetic events.

**When `attach` runs.** An attachment is an effect: it runs after the update that created its
element has written all of its DOM, so the element is already inserted and can be measured. A new
list row goes into the document complete, with its nested lists, conditionals and components, in
one insertion, and only then do the attachments inside it run. The exception is content that a
`<Suspense>` holds back while it shows its fallback: it waits in a fragment, so its attachments run
before it is in the document (`el.isConnected` is `false`), and do not run again when it appears.

The attachments and effects that one update queues all run before the DOM shows their own writes.
When each attachment measures (`getBoundingClientRect`) and then sets a signal the page renders,
every measurement reads the same layout, and the writes reach the DOM together after the last
attachment has run: N elements cost one layout, not N. Reading the signal still returns the new
value at once; only the DOM lags. To measure what such a write renders, read the signal in an
effect (it re-runs once the DOM shows the write), or measure in the next frame or in a
`ResizeObserver`.

**`bind:` on components and custom elements.** `bind:x={signal}` works on any component with an
`x` prop and an `onXChange` callback, like `bind:value` on inputs: `bind:open` on `Dialog.Root`,
`bind:value` on `Combobox.Root`, `bind:checked` on `Menu.CheckboxItem`. The compiler expands it to
both props, `x={signal()}` and `onXChange={(value) => signal.set(value)}`, in server and client
output. An `onXChange` written next to it still runs, after the signal is set. The types come from
the component's props: a component without `x` or without `onXChange` has no `bind:x`, so the
attribute is a type error.

On a custom element (a tag with a dash), `bind:x` sets the element's `x` property and reads it back
into the signal when the element dispatches `input`, `change` or `xchange` (lowercase:
`openchange`, `checkedchange`); events bubbling up from its children are ignored. The server
renders the signal's value as the attribute (`<lu-menu open>`). Declare `bind:x` on a typed custom
element (`"bind:open"?: Signal<boolean>`); undeclared ones accept it untyped.

```tsx check
import { signal } from "lumiose";

function Disclosure(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}) {
  return (
    <details open={props.open} onToggle={(event) => props.onOpenChange?.(event.currentTarget.open)}>
      {props.children}
    </details>
  );
}

export function Faq() {
  const open = signal(false);
  return (
    <>
      <Disclosure bind:open={open}>
        <summary>Shipping</summary>2 to 4 days.
      </Disclosure>
      <button onClick={() => open.set(!open())}>{open() ? "Collapse" : "Expand"}</button>
    </>
  );
}
```

### Lists and keys

`{items().map((item, i) => …)}` compiles to a list that reconciles its rows when the array changes:
it keeps, moves, creates and removes rows instead of rendering them all again.

- **With a `key`** on the element the callback returns, the key alone decides whether a row is
  kept, as in React, Vue or Svelte. A kept row whose item is a new object (a refetch, an array
  derived again) keeps its DOM, its components with their local state, and its effects; the item
  updates in place. Reads of the item in JSX, in props passed to components and in effects re-run,
  as reads of props do, and so do reads of a destructured item (`({ id, name }) => …`).
- **Without a key**, rows match by item reference: a row is kept while its item is the same
  object, and a new object makes a new row.

The callback itself runs once per row. A value it reads from the item at the top, outside JSX and
functions, is a copy taken when the row was created: `const label = format(item.name)` keeps the
first name when the item changes in place, which [LUM2001](../errors/LUM2001.md) reports where the
JSX uses it (and [LUM2003](../errors/LUM2003.md) an early return on the item). Read the item where
it is used instead (`{format(item.name)}`), or derive lazily (`const label = () => format(item.name)`,
called as `label()`). Copies of the key are fine (`const id = item.id` with `key={item.id}`): a
different id is a different row. To make a new row when some field changes (to reset a row's state,
or for setup code that must run again), put that field in the key:
`key={`${item.id}:${item.version}`}`.

The index stays reactive (`i` is compiled to `i()`), and a row keyed by its index
(`key={i}`) keeps its place while its item changes, like Solid's `<Index>`.

The compiler moves the key into a function that the list calls for every item, so the key may
read the item (or the bindings of its destructuring pattern), the index, bindings it declares
itself (`key={row.map((p) => p.id).join("|")}`), `const`s at the top of the callback that copy item
fields (`const id = item.id`), and anything declared outside the callback. A callback that returns
in several places keeps its key when every returned element carries the same one. A key the
compiler cannot use, such as one that reads a value computed in the row, is
[LUM2008](../errors/LUM2008.md), and the list matches rows by reference.

```tsx
<section class="grid">
  {entries().map(({ row, index }) => (
    <div key={`${index}:${row.map((card) => card.id).join("|")}`}>
      {row.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  ))}
</section>
```

Here a refetch that returns new card objects with the same ids keeps every row and every `Card`:
only the bindings whose values changed write to the DOM.

## API

JSX types come from `lumiose/jsx-runtime` (via `jsxImportSource: "lumiose"`) and the global `JSX`
namespace from `lumiose/env`:

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
- **`bind:x` on a component without `onXChange`.** The component must take both `x` and
  `onXChange`; otherwise pass `x={signal()}` and handle the change yourself. An island call site
  (`client:*`) has no `bind:`: a signal cannot be serialized.
- **Custom events with `onX`.** `onMyEvent` is not an event prop; write `on:my-event`.
- **Using the index outside the row.** The `i` of `.map((item, i) => …)` is a reactive index that
  belongs to its row; storing it in an outer variable or closure that outlives the row is
  `LUM2006`.
- **Reading the item once in a keyed row.** `const name = item.name` at the top of the callback
  keeps the first name when a same-key item replaces it (`LUM2001`). Read `item.name` in the JSX,
  or put the field in the key to make a new row when it changes.
- **Wrapping lists in helper components.** `{items().map(…)}` already compiles to a keyed list;
  there is no `<For>`.
- **`innerHTML` with user input.** It is not escaped. Prefer text children.

## Related diagnostics

- [LUM2001](../errors/LUM2001.md): stale derived value (also a keyed row's setup copy of its item).
- [LUM2004](../errors/LUM2004.md): component called as a function.
- [LUM2005](../errors/LUM2005.md): children inserted twice.
- [LUM2006](../errors/LUM2006.md): reactive index escapes its callback.
- [LUM2008](../errors/LUM2008.md): unsupported list key.
- [LUM1001](../errors/LUM1001.md): syntax error.

See also: [Components](components.md), [Styles](styles.md), [reference: JSX types](../reference/jsx.md).
