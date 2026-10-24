// VirtualList, VirtualGrid and VirtualTable (TASK-565, decision-84): thin components on
// createVirtualizer for the three layouts a long collection takes, each rendering its container
// and one element per item, which carries the item's key, its place and its ARIA; the children
// function renders the element's content.
//
// - Rows are keyed by `itemKey`, so a kept row keeps its DOM and its components while its item
//   updates in place (decision-83): the children function runs once per row, with an item whose
//   `item` and `index` are getters, read like props.
// - Before mount (the server, hydration) the first `initial` items render in flow; once mounted the
//   list and the grid place them, keeping the same keyed elements, and the table fills its spacer
//   rows.
import { computed, effect, untrack } from "lumiose";
import { createVirtualizer, type Virtualizer } from "./virtualizer.ts";

export { createVirtualizer } from "./virtualizer.ts";
export type {
  Virtualizer,
  VirtualizerOptions,
  VirtualizerScrollOptions,
  VirtualizerValue,
} from "./virtualizer.ts";

/** What the children function gets: the item and its index, read like props (getters). */
export interface VirtualItem<T> {
  readonly item: T;
  readonly index: number;
}

/** The props the three components share. */
export interface VirtualProps<T> {
  /** The items. */
  items: readonly T[];
  /** The item's identity, such as its record's id: a kept key keeps its row. */
  itemKey: (item: T) => string | number;
  /** Renders an item's content, once per row: read `row.item` and `row.index` where they are used. */
  children: (row: VirtualItem<T>) => JSX.Element;
  /**
   * A row's size along the scroll axis, in px: fixed, or with `measure` the estimate of a row not
   * measured yet. A function gets the row's index.
   */
  size: number | ((row: number) => number);
  /** Measures the rendered rows: their sizes replace `size`. */
  measure?: boolean;
  /** Rows rendered past each edge of the viewport. Default 4. */
  overscan?: number;
  /** The element that scrolls. Default: the window. */
  scroller?: () => Element | null | undefined;
  /** How many items render before mount: the server's HTML. Default 0. */
  initial?: number;
  /** Receives the virtualizer, for `scrollToIndex()`. */
  virtualizer?: (virtualizer: Virtualizer) => void;
}

/**
 * The window's items, in order: a new array when the window or the items change, which the keyed
 * rows reconcile against (an array of indexes would keep rows by position).
 */
const shownOf = <T,>(virtualizer: Virtualizer, items: () => readonly T[]) =>
  computed(() => virtualizer.items().map((index) => items()[index]!));

/**
 * The getters a row's children function reads. The item goes through a computed, which tracks the
 * row's item as any read does: a binding that reads the item lazily, as decision-83's rows let it,
 * misses the item's change when it also reads a computed the same write leaves unchanged, such as
 * the index (TASK-567).
 */
const rowOf = <T,>(item: () => T, index: () => number): VirtualItem<T> => {
  const current = computed(item);
  return {
    get item() {
      return current();
    },
    get index() {
      return index();
    },
  };
};

/**
 * The container's `ref`. With `measure`, it observes the container's rows: after each change of the
 * window, an effect observes the rows that appeared and lets go of the ones that left. (An `attach`
 * on the row would not survive the spread of `itemProps` next to it, TASK-568.)
 */
const containerRef = (virtualizer: Virtualizer, shown: () => unknown, measure?: boolean) => {
  let box: HTMLElement | undefined;
  if (measure) {
    const stops = new Map<Element, () => void>();
    effect(() => {
      shown();
      untrack(() => {
        for (const [row, stop] of stops) {
          if (row.parentNode !== box) {
            stop();
            stops.delete(row);
          }
        }
        for (const row of box?.querySelectorAll<HTMLElement>(":scope > [data-row]") ?? []) {
          if (!stops.has(row)) stops.set(row, virtualizer.measure(row));
        }
      });
    });
  }
  return (element: HTMLElement) => {
    box = element;
    virtualizer.container(element);
  };
};

const px = (value: number) => `${value}px`;

/** `VirtualList`'s props: a `<ul>`'s, and the shared ones. */
export type VirtualListProps<T> = Omit<JSX.IntrinsicElements["ul"], symbol | "children"> &
  VirtualProps<T> & {
    /** The px between rows. */
    gap?: number;
    /** Keeps the row that holds focus rendered while the list scrolls away from it. Default `true`. */
    keepFocused?: boolean;
    /** Props of each item's `<li>` (no `style`): a class, data attributes. */
    itemProps?: (item: T, index: number) => JSX.IntrinsicElements["li"];
  };

/**
 * A `<ul>` of rows placed from the virtualizer, each an `<li>` with `aria-posinset` and
 * `aria-setsize`.
 *
 * @example
 * <VirtualList items={people()} itemKey={(p) => p.id} size={40} aria-label="People">
 *   {(row) => <a href={`/people/${row.item.id}`}>{row.item.name}</a>}
 * </VirtualList>
 */
export function VirtualList<T>({
  items,
  itemKey,
  children,
  size,
  measure,
  gap,
  overscan,
  scroller,
  initial,
  keepFocused,
  virtualizer,
  itemProps,
  ...rest
}: VirtualListProps<T>) {
  const list = createVirtualizer({
    count: () => items.length,
    size: (row) => (typeof size === "function" ? size(row) : size),
    gap: () => gap ?? 0,
    overscan: () => overscan ?? 4,
    scroller: () => scroller?.(),
    initial: () => initial ?? 0,
    keepFocused: keepFocused ?? true,
  });
  virtualizer?.(list);
  const shown = shownOf(list, () => items);
  return (
    <ul
      {...rest}
      ref={containerRef(list, shown, measure)}
      data-mounted={list.mounted() ? "" : undefined}
      style={
        list.mounted()
          ? { position: "relative", height: px(list.total()) }
          : { "padding-block-end": px(list.after()) }
      }
    >
      {shown().map((item, position) => {
        const index = () => list.items()[position]!;
        return (
          <li
            key={itemKey(item)}
            {...itemProps?.(item, index())}
            data-row={index()}
            aria-setsize={items.length}
            aria-posinset={index() + 1}
            style={{
              position: list.mounted() ? "absolute" : undefined,
              inset: list.mounted() ? "0 0 auto" : undefined,
              transform: list.mounted() ? `translateY(${px(list.start(index()))})` : undefined,
              height: measure ? undefined : px(list.size(index())),
            }}
          >
            {untrack(() => children(rowOf(() => item, index)))}
          </li>
        );
      })}
    </ul>
  );
}

/** `VirtualGrid`'s props: a `<ul>`'s, and the shared ones. */
export type VirtualGridProps<T> = Omit<JSX.IntrinsicElements["ul"], symbol | "children"> &
  VirtualProps<T> & {
    /** Items per row; or leave it out and give `minItemWidth`. */
    columns?: number;
    /** As many columns of at least this many px as the width fits (CSS's `auto-fill`). */
    minItemWidth?: number;
    /** The fewest columns with `minItemWidth`. Default 1. */
    minColumns?: number;
    /** The px between rows. */
    gap?: number;
    /** The px between columns. Default `gap`. */
    columnGap?: number;
    /** Keeps the row that holds focus rendered while the grid scrolls away from it. Default `true`. */
    keepFocused?: boolean;
    /** Props of each item's `<li>` (no `style`): a class, data attributes. */
    itemProps?: (item: T, index: number) => JSX.IntrinsicElements["li"];
  };

/**
 * A `<ul>` whose items are placed in rows of columns, each an `<li>` as wide as a column. Before
 * mount the items are in flow: lay them out with CSS (`:not([data-mounted])`), such as a grid with
 * the same columns.
 *
 * @example
 * <VirtualGrid items={cards()} itemKey={(c) => c.id} minItemWidth={192} gap={16} size={160} measure>
 *   {(cell) => <Card card={cell.item} />}
 * </VirtualGrid>
 */
export function VirtualGrid<T>({
  items,
  itemKey,
  children,
  size,
  measure,
  columns,
  minItemWidth,
  minColumns,
  gap,
  columnGap,
  overscan,
  scroller,
  initial,
  keepFocused,
  virtualizer,
  itemProps,
  ...rest
}: VirtualGridProps<T>) {
  const grid = createVirtualizer({
    count: () => items.length,
    size: (row) => (typeof size === "function" ? size(row) : size),
    columns:
      minItemWidth === undefined
        ? () => columns ?? 1
        : { minWidth: () => minItemWidth ?? 0, min: minColumns },
    gap: () => gap ?? 0,
    columnGap: () => columnGap ?? gap ?? 0,
    overscan: () => overscan ?? 4,
    scroller: () => scroller?.(),
    initial: () => initial ?? 0,
    keepFocused: keepFocused ?? true,
  });
  virtualizer?.(grid);
  const shown = shownOf(grid, () => items);
  const rowAt = (index: number) => Math.floor(index / grid.columns());
  const left = (index: number) =>
    px((index % grid.columns()) * (grid.itemWidth() + (columnGap ?? gap ?? 0)));
  return (
    <ul
      {...rest}
      ref={containerRef(grid, shown, measure)}
      data-mounted={grid.mounted() ? "" : undefined}
      style={grid.mounted() ? { position: "relative", height: px(grid.total()) } : undefined}
    >
      {shown().map((item, position) => {
        const index = () => grid.items()[position]!;
        return (
          <li
            key={itemKey(item)}
            {...itemProps?.(item, index())}
            data-row={rowAt(index())}
            aria-setsize={items.length}
            aria-posinset={index() + 1}
            style={
              grid.mounted()
                ? {
                    position: "absolute",
                    top: "0",
                    // The column by layout (`left`), which snaps fractional px as a CSS grid's
                    // tracks do; a translated x would blur the cell's edges.
                    left: left(index()),
                    width: px(grid.itemWidth()),
                    height: measure ? undefined : px(grid.size(rowAt(index()))),
                    transform: `translateY(${px(grid.start(rowAt(index())))})`,
                  }
                : undefined
            }
          >
            {untrack(() => children(rowOf(() => item, index)))}
          </li>
        );
      })}
    </ul>
  );
}

/** `VirtualTable`'s props: a `<table>`'s, and the shared ones. */
export type VirtualTableProps<T> = Omit<JSX.IntrinsicElements["table"], symbol | "children"> &
  VirtualProps<T> & {
    /** What comes before the body: `<caption>`, `<colgroup>`, `<thead>`. */
    head?: JSX.Element;
    /** How many rows `head` has, for `aria-rowcount` and the rows' `aria-rowindex`. Default 1. */
    headerRows?: number;
    /** The columns a spacer row spans. Default 1. */
    colSpan?: number;
    /** A row shown in the body while there are no items. */
    empty?: JSX.Element;
    /** Props of each item's `<tr>`: a class, data attributes. */
    rowProps?: (item: T, index: number) => JSX.IntrinsicElements["tr"];
  };

/**
 * A `<table>` whose body renders the rows near the scroller's viewport between two spacer rows,
 * with `aria-rowcount` on the table and `aria-rowindex` on every row. The children function renders
 * a row's cells.
 *
 * @example
 * <VirtualTable items={releases()} itemKey={(r) => r.id} size={32} scroller={() => box}
 *   head={<thead><tr aria-rowindex={1}><th scope="col">Version</th></tr></thead>}>
 *   {(row) => <td>{row.item.version}</td>}
 * </VirtualTable>
 */
export function VirtualTable<T>({
  items,
  itemKey,
  children,
  size,
  measure,
  overscan,
  scroller,
  initial,
  virtualizer,
  head,
  headerRows,
  colSpan,
  empty,
  rowProps,
  ...rest
}: VirtualTableProps<T>) {
  const table = createVirtualizer({
    count: () => items.length,
    size: (row) => (typeof size === "function" ? size(row) : size),
    overscan: () => overscan ?? 4,
    scroller: () => scroller?.(),
    initial: () => initial ?? 0,
  });
  virtualizer?.(table);
  const shown = shownOf(table, () => items);
  const header = () => headerRows ?? 1;
  return (
    <table {...rest} aria-rowcount={items.length + header()}>
      {head}
      <tbody ref={containerRef(table, shown, measure)}>
        {table.before() > 0 ? (
          <tr aria-hidden="true" data-spacer="">
            <td
              colspan={colSpan ?? 1}
              style={{ height: px(table.before()), padding: "0", border: "0" }}
            />
          </tr>
        ) : null}
        {shown().map((item, position) => {
          const index = () => table.items()[position]!;
          return (
            <tr
              key={itemKey(item)}
              {...rowProps?.(item, index())}
              data-row={index()}
              aria-rowindex={index() + header() + 1}
            >
              {untrack(() => children(rowOf(() => item, index)))}
            </tr>
          );
        })}
        {table.after() > 0 ? (
          <tr aria-hidden="true" data-spacer="">
            <td
              colspan={colSpan ?? 1}
              style={{ height: px(table.after()), padding: "0", border: "0" }}
            />
          </tr>
        ) : null}
        {items.length === 0 ? empty : null}
      </tbody>
    </table>
  );
}
