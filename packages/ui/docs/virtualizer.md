# Virtualizer

> A headless virtualizer for long lists, tables and grids in islands: `createVirtualizer()` computes which rows are near the viewport and where they go, and your component renders, places and styles them. The window or an element scrolls; rows have a fixed or an estimated size, or are measured as they render (one ResizeObserver for all of them); grids fit their columns to the container's width. The server renders the first items, and the island takes those same keyed rows over. 1.6 kB brotli, no script and no CSS of its own. For a list, a grid of cells or a table, start with [Virtual List](virtual-list.md), [Virtual Grid](virtual-grid.md) or [Virtual Table](virtual-table.md), which run on it.

```ts
import { createVirtualizer } from "@lumiose/ui"; // or "@lumiose/ui/virtualizer"
```

## Usage

A virtualizer works in rows (decision-84): a list is a grid of one column, where each item is a row. Call it in a
component's body, give the element that holds the rows `ref={v.container}`, and render the rows it
lists, keyed by the record's id:

```tsx
const v = createVirtualizer({ count: () => items().length, size: 48 });

<ul ref={v.container} style={{ position: "relative", height: `${v.total()}px` }}>
  {v.items().map((i) => (
    <li
      key={items()[i]!.id}
      style={{ position: "absolute", inset: "0 0 auto", transform: `translateY(${v.start(i)}px)` }}
    >
      {items()[i]!.name}
    </li>
  ))}
</ul>;
```

| Piece                       | What it is                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref={v.container}`         | The element that holds the rows. Its top is where row 0 starts; its width sets `{ minWidth }` columns.                                                                        |
| `v.rows()`, `v.items()`     | The indexes to render: rows (for a row element around several items) or items, in order.                                                                                      |
| `v.start(row)`, `v.total()` | Placed rows: each row's offset from the container's top, and the container's height.                                                                                          |
| `v.before()`, `v.after()`   | Rows in flow: the px of the rows before and after the window, for spacers or a padding.                                                                                       |
| `data-row={row}`            | On a row element that is measured, or that `keepFocused` keeps: the row's index. Several elements may share a row (a grid's cells): a measured row is as tall as its tallest. |
| `attach={[v.measure]}`      | On a measured row: its size replaces the estimate.                                                                                                                            |

## API

### createVirtualizer(options)

A value marked `Value<T>` is the value or a function that returns it, read reactively: a function
that reads signals or props recomputes the window when they change.

| Option        | Type                                                         | Default |                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `count`       | `Value<number>`                                              |         | How many items.                                                                                                                                                                                                     |
| `size`        | `number \| (row: number) => number`                          |         | A row's size along the scroll axis, in px: fixed, or the estimate of a row not measured yet. A function gets the row's index and may read signals (`v.itemWidth()`).                                                |
| `columns`     | `Value<number> \| { minWidth: Value<number>; min?: number }` | `1`     | Items per row. `{ minWidth }` fits as many items of at least `minWidth` px as the container's width does, with `columnGap` between them, and at least `min` (default 1), like CSS's `repeat(auto-fill, minmax(…))`. |
| `gap`         | `Value<number>`                                              | `0`     | The px between rows.                                                                                                                                                                                                |
| `columnGap`   | `Value<number>`                                              | `gap`   | The px between columns, for `{ minWidth }` and `itemWidth()`.                                                                                                                                                       |
| `overscan`    | `Value<number>`                                              | `4`     | Rows rendered past each edge of the viewport.                                                                                                                                                                       |
| `scroller`    | `() => Element \| null \| undefined`                         | window  | The element that scrolls, read once mounted.                                                                                                                                                                        |
| `initial`     | `Value<number>`                                              | `0`     | How many items render before the virtualizer mounts: in the server's HTML and while the island hydrates (see [Server rendering](#server-rendering)).                                                                |
| `keepFocused` | `boolean`                                                    | `false` | Keeps the row that holds focus rendered while the window scrolls away from it. For placed rows only (see [Keyboard and focus](#keyboard-and-focus)).                                                                |

### The virtualizer

| Member                       | Returns                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`                  | A `ref` callback for the element that holds the rows.                                                                                                                                                                                                                                                                                        |
| `measure`                    | An `attach` function for a measured row element, which carries `data-row`.                                                                                                                                                                                                                                                                   |
| `rows()`                     | The indexes of the rows to render, in order. The same array while the window does not move, so measuring or scrolling inside the overscan renders no list.                                                                                                                                                                                   |
| `items()`                    | The indexes of the items of those rows, in order, never past `count`.                                                                                                                                                                                                                                                                        |
| `range()`                    | `{ start, end }`: the window's items, `end` excluded (without a kept focused row), for `array.slice(start, end)`.                                                                                                                                                                                                                            |
| `start(row)`, `size(row)`    | Where a row starts, in px from the container's top, and its size (measured, or the estimate).                                                                                                                                                                                                                                                |
| `total()`                    | Every row and gap: the container's height.                                                                                                                                                                                                                                                                                                   |
| `before()`, `after()`        | The px of the rows before and after the window, gaps included.                                                                                                                                                                                                                                                                               |
| `columns()`                  | Items per row.                                                                                                                                                                                                                                                                                                                               |
| `width()`, `itemWidth()`     | The container's width (0 until mounted), and an item's: the width less the column gaps, per column.                                                                                                                                                                                                                                          |
| `mounted()`                  | `false` on the server and while hydrating, then `true`: switch between the server's layout and the virtual one with it.                                                                                                                                                                                                                      |
| `scrollToIndex(i, options?)` | Scrolls the scroller to show item `i`. `align`: `"auto"` (default: only as far as it takes), `"start"`, `"center"` or `"end"`; `behavior` as in `scrollTo`. It honours the scroller's `scroll-padding` (a sticky header), and checks the position again for a few frames while rows on the way are measured (not with `behavior: "smooth"`). |

## Example

A list of people the server renders the first 20 of; the island takes them over:

```tsx check
import { createVirtualizer } from "@lumiose/ui";

type Person = { id: string; name: string };

export function People(props: { people: Person[] }) {
  const list = createVirtualizer({ count: () => props.people.length, size: 40, initial: 20 });
  return (
    <ul
      ref={list.container}
      aria-label="People"
      style={{
        "padding-block-start": `${list.before()}px`,
        "padding-block-end": `${list.after()}px`,
      }}
    >
      {props.people.slice(list.range().start, list.range().end).map((person, offset) => (
        <li
          key={person.id}
          aria-setsize={props.people.length}
          aria-posinset={list.range().start + offset + 1}
          style={{ height: "40px" }}
        >
          {person.name}
        </li>
      ))}
    </ul>
  );
}
```

A grid of cards whose rows have different heights, as many columns of at least 12rem as fit:

```tsx check
import { createVirtualizer } from "@lumiose/ui";

type Card = { id: string; title: string; body: string };

export function Cards(props: { cards: Card[] }) {
  const grid = createVirtualizer({
    count: () => props.cards.length,
    columns: { minWidth: 192 },
    gap: 16,
    size: 120, // the estimate, until a row is measured
  });
  const cardsOf = (row: number) =>
    props.cards.slice(row * grid.columns(), (row + 1) * grid.columns());
  return (
    <div
      ref={grid.container}
      role="list"
      aria-label="Cards"
      style={{ position: "relative", height: `${grid.total()}px` }}
    >
      {grid.rows().map((row) => (
        <div
          key={row}
          role="none"
          data-row={row}
          attach={[grid.measure]}
          style={{
            position: "absolute",
            inset: "0 0 auto",
            display: "grid",
            gap: "16px",
            "grid-template-columns": `repeat(${grid.columns()}, minmax(0, 1fr))`,
            transform: `translateY(${grid.start(row)}px)`,
          }}
        >
          {cardsOf(row).map((card, i) => (
            <div
              key={card.id}
              role="listitem"
              aria-setsize={props.cards.length}
              aria-posinset={row * grid.columns() + i + 1}
            >
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

A table in its own scroller, with spacer rows:

```tsx check
import { createVirtualizer } from "@lumiose/ui";

type Release = { id: string; version: string };

export function Releases(props: { releases: Release[] }) {
  let scroller: HTMLDivElement | undefined;
  const table = createVirtualizer({
    count: () => props.releases.length,
    size: 32,
    scroller: () => scroller,
    initial: 15,
  });
  return (
    <div
      ref={(el) => (scroller = el)}
      role="region"
      aria-label="Releases"
      tabindex={0}
      style={{ height: "16rem", overflow: "auto" }}
    >
      <table aria-rowcount={props.releases.length + 1} style={{ "border-collapse": "collapse" }}>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col">Version</th>
          </tr>
        </thead>
        <tbody ref={table.container}>
          {table.before() > 0 ? (
            <tr aria-hidden="true">
              <td style={{ height: `${table.before()}px`, padding: "0" }} />
            </tr>
          ) : null}
          {props.releases.slice(table.range().start, table.range().end).map((release, offset) => (
            <tr
              key={release.id}
              aria-rowindex={table.range().start + offset + 2}
              style={{ height: "32px" }}
            >
              <td>{release.version}</td>
            </tr>
          ))}
          {table.after() > 0 ? (
            <tr aria-hidden="true">
              <td style={{ height: `${table.after()}px`, padding: "0" }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
```

## Styling

Nothing is styled: the virtualizer only computes. Lay the rows out one of two ways.

- **Placed rows**: the container is `position: relative` and `total()` tall; each row is
  `position: absolute` at `transform: translateY(${start(row)}px)` (a cell of a grid adds its
  column: `translate(${column * (itemWidth() + gap)}px, …)`). A row out of order (`keepFocused`)
  still sits in its place, and a size that changes moves only the rows after it.
- **Rows in flow**: the rows of the window stay in the document's flow between `before()` and
  `after()`, as a padding of the container or as spacer elements. Tables need this (a `<tr>` cannot
  be placed), and it is the simplest server-rendered list: the same layout before and after mount.
  In a CSS grid, use a padding: a spacer element would add a gap.

Measured rows are placed in the frame they are measured in, before it paints: the observer's
callback writes their sizes and the rows move at once, so they never show at their estimates. A
row rendered by that move (the window grew) is measured in the next frame, which browsers report
as an `error` event, "ResizeObserver loop completed with undelivered notifications". It is
harmless, and error trackers ignore it.

`size` must match the CSS: a fixed size is exactly the row's height, without the gap (that is
`gap`), and an estimate only has to be close (measured rows correct it). When the CSS sets the
height, such as a custom property that a breakpoint changes, keep it in a signal that a
ResizeObserver updates, and return that from `size`.

## Server rendering

Before it mounts, on the server and while an island hydrates, the virtualizer reads nothing from
the browser: `mounted()` is `false`, `width()` is 0, `{ minWidth }` columns are `min`, and it
renders the first `initial` items (in whole rows). Both sides render the same HTML, so hydration
matches. Once mounted it measures the container and the viewport, and renders the window instead:
rows keyed by the same ids are kept, so the server's elements stay and only move. Options that
change the pre-mount window (`count`, `initial`, `columns`) must not read the browser either.

- **No layout jump.** The server's rows should take the place the virtual layout gives them. With
  rows in flow and a fixed size, it holds by itself: render `after()` as a padding before mount too.
  A server-only layout (a CSS grid with `auto-fill`, say) works when its geometry is the
  virtualizer's: switch the container's class or style on `mounted()`, keep the same keyed rows.
- **Every item on the server.** For a list that must be complete in the HTML (indexing, find in
  page, no JavaScript), render all of it on the server into an island's `children` slot and let the
  island virtualize once its data loads, or skip the virtualizer and give the rows
  `content-visibility: auto` with a `contain-intrinsic-size`: the browser skips their rendering
  while they are off screen, with no script.

## Keyboard and focus

- **Key rows by the record's id**, never by the index: a kept row is the same record, so its
  focus, selection and typed text stay with it ([Lists and keys](https://lumiose.dev/docs/concepts/jsx/#lists-and-keys)).
  A row element that only wraps a grid's items may be keyed by its row index (`key={row}`): its
  items keep their own keys.
- **Tab** moves through the rendered rows in DOM order; the browser scrolls the next one into view,
  and the window follows it. The overscan keeps the next rows rendered.
- **`keepFocused`**: scrolled away with the wheel or the scrollbar, a focused row would leave the
  document and focus would fall back to the page. With `keepFocused`, the row of the focused
  element (its closest `[data-row]`) stays in `rows()` until focus leaves the container, placed
  where it belongs. Rows in flow cannot hold a row outside their window: leave it off there.
- **`scrollToIndex`** moves the scroller, not focus: focus the row afterwards when the user asked
  to go to it.

## Accessibility

- **Lists**: give each rendered item `aria-setsize` (the count) and `aria-posinset` (its position
  from 1), so assistive technology announces "3 of 1,000" rather than the rows rendered.
- **Tables**: `aria-rowcount` on the table (rows plus the header rows) and `aria-rowindex` on every
  row, the header's too. Spacer rows are `aria-hidden="true"`.
- **Grids of items**: a row element that only lays out items gets `role="none"`, so the items are
  the list's (`role="list"` on the container, `role="listitem"` on the items).
- Find in page and assistive technology reach only the rendered rows. Render everything on the
  server when they must reach every row (above).

## Without JavaScript

Only the server's first `initial` items render. Link to a full page, or render every item on the
server, when the list must work without JavaScript.

## Browser support

ResizeObserver with `borderBoxSize`, and `scroll-padding`: every supported browser. The virtualizer
scrolls along the block axis only (vertical in horizontal writing modes).

## Related

- [Virtual List](virtual-list.md), [Virtual Grid](virtual-grid.md) and
  [Virtual Table](virtual-table.md): the three layouts as components on this primitive.
- [Scroll Area](scroll-area.md): custom scrollbars over a scroller; give its `Viewport` as `scroller`.
- [Lists and keys](https://lumiose.dev/docs/concepts/jsx/#lists-and-keys): how keyed rows update in place.
