# Virtual List

> **A proposal (TASK-565)**: its API waits for the user's sign-off. A long list that renders only the rows near the viewport, in islands: a `<ul>` whose rows are `<li>`s placed by [createVirtualizer](virtualizer.md), each keyed by `itemKey` and carrying `aria-posinset` and `aria-setsize`. The children function renders a row's content once; a row kept under its key keeps its DOM and state while its item updates in place. The server renders the first `initial` rows in flow. 2.2 kB brotli with the virtualizer.

```ts
import { VirtualList } from "@lumiose/ui"; // or "@lumiose/ui/virtualizer"
```

## Anatomy

```tsx
<VirtualList items={people()} itemKey={(person) => person.id} size={40}>
  {(row) => <a href={`/people/${row.item.id}`}>{row.item.name}</a>}
</VirtualList>
```

| Part          | Renders                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `VirtualList` | `<ul>`, `total()` tall and `position: relative` once mounted; an `<li data-row aria-posinset aria-setsize>` per row |

## API

### VirtualList

| Prop          | Type                                   | Default |                                                                                                                |
| ------------- | -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `items`       | `readonly T[]`                         |         | The items.                                                                                                     |
| `itemKey`     | `(item: T) => string \| number`        |         | The item's identity, such as its record's id: a row stays while its key does.                                  |
| `children`    | `(row: VirtualItem<T>) => JSX.Element` |         | A row's content, rendered once per row. `row.item` and `row.index` are getters: read them where they are used. |
| `size`        | `number \| (row: number) => number`    |         | A row's height in px: fixed (the `<li>` gets it), or with `measure` the estimate.                              |
| `measure`     | `boolean`                              | `false` | Measures the rendered rows (one ResizeObserver): their heights replace `size`.                                 |
| `gap`         | `number`                               | `0`     | The px between rows.                                                                                           |
| `overscan`    | `number`                               | `4`     | Rows rendered past each edge of the viewport.                                                                  |
| `scroller`    | `() => Element \| null \| undefined`   | window  | The element that scrolls.                                                                                      |
| `initial`     | `number`                               | `0`     | The rows rendered before mount: the server's HTML.                                                             |
| `keepFocused` | `boolean`                              | `true`  | Keeps the row that holds focus rendered while the list scrolls away from it.                                   |
| `itemProps`   | `(item: T, index: number) => li props` |         | Attributes of each `<li>`: data attributes, a title. Not `style`, which places the row.                        |
| `virtualizer` | `(virtualizer: Virtualizer) => void`   |         | Receives the [virtualizer](virtualizer.md), for `scrollToIndex()` and `range()`.                               |

Every other `<ul>` prop passes through: `class`, `aria-label`, `aria-labelledby`, `id`. A `style`
is replaced: the list sets its own.

## Example

```tsx check
import { VirtualList, type Virtualizer } from "@lumiose/ui";

type Person = { id: string; name: string };

export function People(props: { people: Person[] }) {
  let list: Virtualizer | undefined;
  return (
    <>
      <button type="button" onClick={() => list?.scrollToIndex(0)}>
        Back to the top
      </button>
      <VirtualList
        aria-label="People"
        items={props.people}
        itemKey={(person) => person.id}
        size={40}
        initial={20}
        virtualizer={(v) => (list = v)}
      >
        {(row) => (
          <a href={`/people/${row.item.id}`}>
            {row.index + 1}. {row.item.name}
          </a>
        )}
      </VirtualList>
    </>
  );
}
```

## Styling

Unstyled. Before mount the rows are in flow (each `size` tall, the rest of the list's height a
`padding-block-end`), so the server's list already has its full height. Once mounted the `<ul>`
gets `data-mounted`, `position: relative` and its total height, and each `<li>` `position:
absolute`, `inset: 0 0 auto` and a `transform`. Style with `class` on the list, `[data-mounted]`,
and the rows through the list's class: they are the component's elements, so a scoped selector
reaches them with `:deep()`, as in `.people :deep(li)`. The content you render is yours to style.

## Keyboard and focus

The rows are in DOM order, so Tab moves through them, and the browser scrolls the next one into
view. A focused row stays rendered while the list scrolls away from it (`keepFocused`), so focus
never falls back to the page. Rows are keyed by the record: a row's focus, typed text or toggled
state stays with its record when items are added, removed, reordered or fetched again.

## Without JavaScript

The server renders the first `initial` rows, in flow, with the list's full height reserved. See
[Virtualizer](virtualizer.md#server-rendering) for the takeover and for lists that must be
complete in the HTML.

## Browser support

ResizeObserver (for `measure`): every supported browser.

## Related

- [Virtualizer](virtualizer.md): the primitive the list runs on, for other layouts.
- [Virtual Grid](virtual-grid.md) and [Virtual Table](virtual-table.md).
