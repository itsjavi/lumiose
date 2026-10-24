# Virtual Table

> A long table that renders only the rows near its scroller's viewport, in islands: a `<table>` with `aria-rowcount`, your head, and a body whose `<tr aria-rowindex>` rows sit between two spacer rows, by [createVirtualizer](virtualizer.md). The children function renders a row's cells once; a row kept under its key updates in place. The server renders the first `initial` rows and a spacer for the rest. 2.3 kB brotli with the virtualizer.

```ts
import { VirtualTable } from "@lumiose/ui"; // or "@lumiose/ui/virtualizer"
```

## Anatomy

```tsx
<VirtualTable
  items={releases()}
  itemKey={(release) => release.id}
  size={32}
  scroller={() => box}
  head={
    <thead>
      <tr aria-rowindex={1}>
        <th scope="col">Version</th>
      </tr>
    </thead>
  }
>
  {(row) => <td>{row.item.version}</td>}
</VirtualTable>
```

| Part           | Renders                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `VirtualTable` | `<table aria-rowcount>`, `head`, and a `<tbody>` of `<tr data-row aria-rowindex>` rows between `<tr aria-hidden data-spacer>` rows |

## API

### VirtualTable

| Prop          | Type                                   | Default |                                                                                                         |
| ------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `items`       | `readonly T[]`                         |         | The items.                                                                                              |
| `itemKey`     | `(item: T) => string \| number`        |         | The item's identity: a row stays while its key does.                                                    |
| `children`    | `(row: VirtualItem<T>) => JSX.Element` |         | A row's cells, rendered once per row; `row.item` and `row.index` are getters.                           |
| `size`        | `number \| (row: number) => number`    |         | A row's height in px: fixed, or with `measure` the estimate. It must match the CSS's row height.        |
| `measure`     | `boolean`                              | `false` | Measures the rendered rows: their heights replace `size`.                                               |
| `scroller`    | `() => Element \| null \| undefined`   | window  | The element that scrolls, usually a `role="region"` box around the table.                               |
| `head`        | `JSX.Element`                          |         | What comes before the body: `<caption>`, `<colgroup>`, `<thead>`. Give its rows `aria-rowindex` from 1. |
| `headerRows`  | `number`                               | `1`     | How many rows `head` has: `aria-rowcount` is the items plus these, and the body's indexes follow.       |
| `colSpan`     | `number`                               | `1`     | The columns a spacer row spans.                                                                         |
| `empty`       | `JSX.Element`                          |         | A row shown in the body while there are no items.                                                       |
| `overscan`    | `number`                               | `4`     | Rows rendered past each edge of the viewport.                                                           |
| `initial`     | `number`                               | `0`     | The rows rendered before mount: the server's HTML.                                                      |
| `rowProps`    | `(item: T, index: number) => tr props` |         | Attributes of each row: data attributes, a title.                                                       |
| `virtualizer` | `(virtualizer: Virtualizer) => void`   |         | Receives the [virtualizer](virtualizer.md), for `scrollToIndex()`.                                      |

Every other `<table>` prop passes through: `class`, `aria-label`, `id`.

## Example

```tsx check
import { VirtualTable } from "@lumiose/ui";

type Release = { id: string; version: string; downloads: number };

export function Releases(props: { releases: Release[] }) {
  let box: HTMLDivElement | undefined;
  return (
    <div
      ref={(el) => (box = el)}
      role="region"
      aria-label="Releases"
      tabindex={0}
      style={{ "max-block-size": "20rem", overflow: "auto" }}
    >
      <VirtualTable
        items={props.releases}
        itemKey={(release) => release.id}
        size={32}
        scroller={() => box}
        initial={15}
        colSpan={2}
        head={
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col">Version</th>
              <th scope="col">Downloads</th>
            </tr>
          </thead>
        }
        empty={
          <tr>
            <td colspan={2}>No releases yet.</td>
          </tr>
        }
      >
        {(row) => (
          <>
            <td>{row.item.version}</td>
            <td>{row.item.downloads}</td>
          </>
        )}
      </VirtualTable>
    </div>
  );
}
```

## Styling

Unstyled. Rows stay in the table's flow, so the table lays out its columns as usual; set the rows'
height in CSS to match `size` (`block-size` on the rows, or a custom property that `size` reads).
The spacer rows (`[data-spacer]`) have no padding or border. The rows are the component's `<tr>`s:
reach them from the table's class with `:deep()`, as in `.releases :deep(tr[data-row])`. The cells
you render are yours to style; a sticky `<thead>` works as in any scroller.

## Keyboard and focus

Focus the scroller (`tabindex="0"`) and the arrow keys, Page Up and Down, Home and End scroll it; the
rows follow. Rows are keyed by the record, so a link focused in a row keeps focus through a sort or
a refetch while it stays in the window. The table has no `keepFocused` (decision-84): a row outside the window
cannot sit between the spacers.

## Without JavaScript

The server renders the head, the first `initial` rows and a spacer for the rest, so the scroller has
its full height. See [Virtualizer](virtualizer.md#server-rendering) for tables that must be complete
in the HTML.

## Browser support

ResizeObserver: every supported browser.

## Related

- [Virtualizer](virtualizer.md): the primitive the table runs on.
- [Virtual List](virtual-list.md) and [Virtual Grid](virtual-grid.md).
