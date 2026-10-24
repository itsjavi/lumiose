# Virtual Grid

> **A proposal (TASK-565)**: its API waits for the user's sign-off. A long grid that renders only the rows near the viewport, in islands: a `<ul>` of `<li>` cells placed in rows of as many columns as the width fits (`minItemWidth`, like CSS's `auto-fill`) or of `columns`, by [createVirtualizer](virtualizer.md). Rows have a fixed height, or each is as tall as its tallest measured cell. The server renders the first `initial` cells in flow for your CSS grid to lay out, and the island takes those same keyed cells over. 2.3 kB brotli with the virtualizer.

```ts
import { VirtualGrid } from "@lumiose/ui"; // or "@lumiose/ui/virtualizer"
```

## Anatomy

```tsx
<VirtualGrid items={cards()} itemKey={(card) => card.id} minItemWidth={192} gap={16} size={160}>
  {(cell) => <Card card={cell.item} />}
</VirtualGrid>
```

| Part          | Renders                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `VirtualGrid` | `<ul>`, `total()` tall once mounted; an `<li data-row aria-posinset aria-setsize>` per cell, a column wide |

## API

### VirtualGrid

| Prop           | Type                                    | Default |                                                                                                                                       |
| -------------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `items`        | `readonly T[]`                          |         | The items.                                                                                                                            |
| `itemKey`      | `(item: T) => string \| number`         |         | The item's identity: a cell stays while its key does.                                                                                 |
| `children`     | `(cell: VirtualItem<T>) => JSX.Element` |         | A cell's content, rendered once per cell; `cell.item` and `cell.index` are getters.                                                   |
| `size`         | `number \| (row: number) => number`     |         | A row's height in px: fixed (each cell gets it), or with `measure` the estimate. A function may read the virtualizer's `itemWidth()`. |
| `measure`      | `boolean`                               | `false` | Measures the cells: each row is as tall as its tallest.                                                                               |
| `minItemWidth` | `number`                                |         | As many columns of at least this many px as the container's width fits.                                                               |
| `minColumns`   | `number`                                | `1`     | The fewest columns with `minItemWidth`, before mount too.                                                                             |
| `columns`      | `number`                                | `1`     | A fixed number of columns, without `minItemWidth`.                                                                                    |
| `gap`          | `number`                                | `0`     | The px between rows.                                                                                                                  |
| `columnGap`    | `number`                                | `gap`   | The px between columns.                                                                                                               |
| `overscan`     | `number`                                | `4`     | Rows rendered past each edge of the viewport.                                                                                         |
| `scroller`     | `() => Element \| null \| undefined`    | window  | The element that scrolls.                                                                                                             |
| `initial`      | `number`                                | `0`     | The cells rendered before mount (in whole rows of `minColumns`): the server's HTML.                                                   |
| `keepFocused`  | `boolean`                               | `true`  | Keeps the row of the focused cell rendered while the grid scrolls away from it.                                                       |
| `itemProps`    | `(item: T, index: number) => li props`  |         | Attributes of each `<li>`. Not `style`, which places the cell.                                                                        |
| `virtualizer`  | `(virtualizer: Virtualizer) => void`    |         | Receives the [virtualizer](virtualizer.md): `scrollToIndex()`, `itemWidth()`, `columns()`.                                            |

Every other `<ul>` prop passes through. A `style` is replaced once mounted.

## Example

```tsx check
import { VirtualGrid } from "@lumiose/ui";

type Entry = { id: string; label: string };

// The server's first 48 cells sit in the CSS grid below; the island places the same cells.
export function Entries(props: { entries: Entry[] }) {
  return (
    <VirtualGrid
      class="entries"
      aria-label="Entries"
      items={props.entries}
      itemKey={(entry) => entry.id}
      minItemWidth={96}
      minColumns={2}
      gap={8}
      size={64}
      initial={48}
    >
      {(cell) => (
        <button type="button" class="entry">
          {cell.item.label}
        </button>
      )}
    </VirtualGrid>
  );
}
```

```css
.entries:not([data-mounted]) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.entry {
  inline-size: 100%;
  block-size: 64px;
}
```

## Styling

Unstyled. Before mount the cells are in flow: lay them out with a CSS grid under
`:not([data-mounted])`, with the columns and gaps the grid computes (`repeat(auto-fill,
minmax(<minItemWidth>px, 1fr))` and `gap`), and the cells take the same places once mounted.
Mounted, the `<ul>` gets `data-mounted`, `position: relative` and its total height, and each `<li>`
`position: absolute`, its column as `left`, the column's width, its row as a `translateY`, and with
a fixed `size` the row's height. Give the content `block-size: 100%` to fill a fixed cell. The cells
are the component's elements: reach them from the grid's class with `:deep()`
(`.entries :deep(li)`); `[data-row]` is each cell's row.

## Keyboard and focus

Cells are in DOM order, row by row, so Tab moves through them and the window follows. The row of
the focused cell stays rendered while the grid scrolls away (`keepFocused`). Cells are keyed by
the record, so focus and state stay with their record through a filter, a sort or a refetch.

## Without JavaScript

The server renders the first `initial` cells, which your CSS lays out. See
[Virtualizer](virtualizer.md#server-rendering) for grids that must be complete in the HTML.

## Browser support

ResizeObserver (for `measure` and the width): every supported browser. Cells are placed left to
right.

## Related

- [Virtualizer](virtualizer.md): the primitive the grid runs on.
- [Virtual List](virtual-list.md) and [Virtual Table](virtual-table.md).
