// Virtualizer (TASK-565, a proposal): renders only the rows of a long list, table or grid that are
// near the viewport. Headless: it computes which rows to render and where they go; the component
// renders them, places them (absolutely from `start(row)`, or in flow between `before()` and
// `after()`), and styles them.
//
// - Rows are the unit: a list is a grid of one column. Each row's size is fixed or estimated
//   (`size`), and measured once a rendered row carries `attach={[v.measure]}` and `data-row`.
//   Several measured elements may share a row (a grid's cells): the row is the tallest.
// - One ResizeObserver measures every row, and one observer callback writes all its sizes at once:
//   a size per row, or a write per row, would render the list once per row.
// - `rows()` and `items()` are arrays of indexes that keep their identity while the window does
//   not move, so a measurement or a scroll inside the overscan renders no list.
// - Before it mounts (on the server, and while an island hydrates) it reads nothing from the
//   browser: it renders the first `initial` items, so both render the same HTML. Once mounted it
//   measures, and takes over the same keyed rows.
import { batch, computed, onMount, signal } from "lumiose";

/** A value, or a function that returns it (read reactively). */
export type VirtualizerValue<T> = T | (() => T);

export interface VirtualizerOptions {
  /** How many items. */
  count: VirtualizerValue<number>;
  /**
   * The size of a row along the scroll axis, in px: fixed, or the estimate of rows not measured
   * yet. A function gets the row's index, and may read signals (`v.itemWidth()`).
   */
  size: number | ((row: number) => number);
  /**
   * Items per row. A number, or `{ minWidth }`: as many items of at least `minWidth` px as the
   * container's width fits, with `columnGap` between them (CSS's `repeat(auto-fill, minmax(…))`),
   * and at least `min` (default 1). Default 1, a list.
   */
  columns?: VirtualizerValue<number> | { minWidth: VirtualizerValue<number>; min?: number };
  /** The px between rows. Default 0. */
  gap?: VirtualizerValue<number>;
  /** The px between columns, for `columns: { minWidth }` and `itemWidth()`. Default `gap`. */
  columnGap?: VirtualizerValue<number>;
  /** Rows rendered past each edge of the viewport. Default 4. */
  overscan?: VirtualizerValue<number>;
  /** The scrolling element, read once mounted. Default: the window. */
  scroller?: () => Element | null | undefined;
  /**
   * How many items render before the virtualizer mounts: the server's HTML, and hydration's.
   * Default 0.
   */
  initial?: VirtualizerValue<number>;
  /**
   * Keeps the row that holds focus rendered (the closest `[data-row]` of the focused element), so
   * scrolling away does not drop focus to the page. Only for rows placed from `start(row)`: an
   * in-flow window cannot hold a row outside it. Default `false`.
   */
  keepFocused?: boolean;
}

export interface VirtualizerScrollOptions {
  /** Where the row ends up: `"auto"` (default) scrolls only as far as it takes to show it. */
  align?: "auto" | "start" | "center" | "end";
  behavior?: ScrollBehavior;
}

export interface Virtualizer {
  /** `ref={v.container}`: the element that holds the rows. Its top is where row 0 starts. */
  container: (element: HTMLElement) => void;
  /**
   * `attach={[v.measure]}` on a row element with `data-row={row}`: its size replaces the estimate.
   * Several elements may carry the same row (a grid's cells): the row is as tall as the tallest.
   */
  measure: (element: HTMLElement) => () => void;
  /** Whether the virtualizer runs in the browser yet (`false` on the server and while hydrating). */
  mounted: () => boolean;
  /** Items per row. */
  columns: () => number;
  /** The container's width in px (0 until mounted). */
  width: () => number;
  /** The width of an item in a grid: the container's width, less the column gaps, per column. */
  itemWidth: () => number;
  /** The indexes of the rows to render, in order. */
  rows: () => number[];
  /** The indexes of the items to render, in order: the items of `rows()`. */
  items: () => number[];
  /** The items of the window, `[start, end)` (without a kept focused row). */
  range: () => { start: number; end: number };
  /** Where a row starts, in px from the container's top. */
  start: (row: number) => number;
  /** A row's size: measured, or the estimate. */
  size: (row: number) => number;
  /** The size of every row and gap: the container's height. */
  total: () => number;
  /** The px of the rows before the window, for a spacer or a padding. */
  before: () => number;
  /** The px of the rows after the window. */
  after: () => number;
  /** Scrolls the scroller to show the item at `index`. */
  scrollToIndex: (index: number, options?: VirtualizerScrollOptions) => void;
}

const read = <T>(value: VirtualizerValue<T>): T =>
  typeof value === "function" ? (value as () => T)() : value;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The top of a scroller's viewport on screen (the window's without one), and its height. */
const viewport = (scroller: Element | undefined) =>
  scroller
    ? [scroller.getBoundingClientRect().top + scroller.clientTop, scroller.clientHeight]
    : [0, innerHeight];

/** The row of the closest `[data-row]` element around `node`, or -1. */
const rowOf = (node: EventTarget | null) =>
  Number((node as Element | null)?.closest?.("[data-row]")?.getAttribute("data-row") ?? -1);

/** The `data-row` of a measured element, or NaN without one. */
const rowAt = (element: Element) => Number(element.getAttribute("data-row") ?? Number.NaN);

/**
 * Creates a virtualizer in a component: call it in the component's body, give the rows'
 * container `ref={v.container}`, and render `v.rows()` (or `v.items()`) keyed by the record's id.
 *
 * @example
 * const list = createVirtualizer({ count: () => props.people.length, size: 48 });
 * <ul ref={list.container} style={{ position: "relative", height: `${list.total()}px` }}>
 *   {list.items().map((i) => (
 *     <li key={props.people[i]!.id} style={{ position: "absolute", top: `${list.start(i)}px` }}>
 *       {props.people[i]!.name}
 *     </li>
 *   ))}
 * </ul>
 */
export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  let element: HTMLElement | undefined;
  let observer: ResizeObserver | undefined;
  let frame = 0;
  /** Measured sizes by row; `version` changes once per observer callback that changed any. */
  const measured: number[] = [];
  /** The measured elements and their last sizes. */
  const observed = new Map<Element, number>();
  let measuredColumns = 0;
  const version = signal(0);
  const mounted = signal(false);
  const width = signal(0);
  /** The scroller's viewport, from the container's top: `[top, bottom]`. */
  const view = signal([0, 0]);
  const focused = signal(-1);

  const count = () => Math.max(0, read(options.count));
  const gap = () => read(options.gap ?? 0);
  const columnGap = () => read(options.columnGap ?? options.gap ?? 0);
  const columns = computed(() => {
    const given = options.columns ?? 1;
    if (typeof given !== "object") return Math.max(1, Math.floor(read(given)));
    const between = columnGap();
    const fit = Math.floor((width() + between) / (read(given.minWidth) + between));
    return Math.max(given.min ?? 1, fit || 0);
  });
  const itemWidth = () => Math.max(0, (width() - columnGap() * (columns() - 1)) / columns());

  const layout = computed(() => {
    version();
    const perRow = columns();
    if (perRow !== measuredColumns) {
      // Other columns regroup the items: the sizes measured belong to rows that are gone. The
      // rendered rows are observed again, so the ones that stay report their sizes too.
      measuredColumns = perRow;
      measured.length = 0;
      for (const row of observed.keys()) {
        observer!.unobserve(row);
        observer!.observe(row);
      }
    }
    const rows = Math.ceil(count() / perRow);
    const between = gap();
    const size = options.size;
    const sizes = new Float64Array(rows);
    const starts = new Float64Array(rows + 1);
    for (let row = 0; row < rows; row++) {
      sizes[row] = measured[row] ?? (typeof size === "number" ? size : size(row));
      starts[row + 1] = starts[row]! + sizes[row]! + between;
    }
    return { rows, sizes, starts, total: rows ? starts[rows]! - between : 0 };
  });

  /** The rows of the window, `[first, last)`, overscan included. */
  const span = computed(
    () => {
      const { rows, starts } = layout();
      if (!mounted()) return [0, Math.min(rows, Math.ceil(read(options.initial ?? 0) / columns()))];
      // How many rows start at or before `y`.
      const find = (y: number) => {
        let low = 0;
        let high = rows;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (starts[middle]! <= y) low = middle + 1;
          else high = middle;
        }
        return low;
      };
      const [top, bottom] = view();
      const overscan = read(options.overscan ?? 4);
      return [Math.max(0, find(top!) - 1 - overscan), Math.min(rows, find(bottom!) + overscan)];
    },
    { equals: same },
  );

  const rows = computed(
    () => {
      const [first, last] = span() as [number, number];
      const kept = options.keepFocused ? focused() : -1;
      const out: number[] = kept >= 0 && kept < first ? [kept] : [];
      for (let row = first; row < last; row++) out.push(row);
      if (kept >= last && kept < layout().rows) out.push(kept);
      return out;
    },
    { equals: same },
  );

  const items = computed(
    () => {
      const perRow = columns();
      const total = count();
      const out: number[] = [];
      for (const row of rows()) {
        for (let i = row * perRow; i < Math.min(total, row * perRow + perRow); i++) out.push(i);
      }
      return out;
    },
    { equals: same },
  );

  const start = (row: number) => layout().starts[row] ?? 0;
  const size = (row: number) => layout().sizes[row] ?? 0;
  const scrollerOf = () => options.scroller?.() ?? undefined;

  const update = () => {
    frame = 0;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const [top, height] = viewport(scrollerOf()) as [number, number];
    batch(() => {
      width.set(box.width);
      view.set([top - box.top, top - box.top + height]);
    });
  };
  const schedule = () => {
    frame ||= requestAnimationFrame(update);
  };
  const onFocusIn = (event: FocusEvent) => focused.set(rowOf(event.target));
  const onFocusOut = (event: FocusEvent) => {
    if (!element?.contains(event.relatedTarget as Node | null)) focused.set(-1);
  };

  onMount(() => {
    const scroller = scrollerOf();
    const target = scroller ?? window;
    const resize = new ResizeObserver(schedule);
    for (const box of [element, scroller]) if (box) resize.observe(box);
    target.addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    if (options.keepFocused) {
      element?.addEventListener("focusin", onFocusIn);
      element?.addEventListener("focusout", onFocusOut);
    }
    batch(() => {
      update();
      mounted.set(true);
    });
    return () => {
      resize.disconnect();
      observer?.disconnect();
      target.removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      element?.removeEventListener("focusin", onFocusIn);
      element?.removeEventListener("focusout", onFocusOut);
      cancelAnimationFrame(frame);
    };
  });

  return {
    container: (el) => {
      element = el;
    },
    measure: (el) => {
      observer ??= new ResizeObserver((entries) => {
        const touched = new Set<number>();
        for (const { target, borderBoxSize } of entries) {
          observed.set(target, borderBoxSize[0]!.blockSize);
          touched.add(rowAt(target));
        }
        let changed = false;
        for (const row of touched) {
          let tallest = 0;
          for (const [target, height] of observed)
            if (rowAt(target) === row) tallest = Math.max(tallest, height);
          if (row >= 0 && !(Math.abs((measured[row] ?? -1) - tallest) < 0.5)) {
            measured[row] = tallest;
            changed = true;
          }
        }
        if (changed) version.set(version.peek() + 1);
      });
      observer.observe(el);
      observed.set(el, 0);
      return () => {
        observer!.unobserve(el);
        observed.delete(el);
      };
    },
    mounted,
    columns,
    width,
    itemWidth,
    rows,
    items,
    range: () => {
      const [first, last] = span() as [number, number];
      return { start: first * columns(), end: Math.min(count(), last * columns()) };
    },
    start,
    size,
    total: () => layout().total,
    before: () => start(span()[0]!),
    after: () => {
      const { total, starts } = layout();
      const last = span()[1]!;
      return last ? Math.max(0, total - starts[last]! + gap()) : total;
    },
    scrollToIndex: (index, { align = "auto", behavior } = {}) => {
      let tries = 0;
      const go = () => {
        if (!element) return;
        const scroller = scrollerOf();
        const style = getComputedStyle(scroller ?? document.documentElement);
        const padTop = Number.parseFloat(style.scrollPaddingTop) || 0;
        const padBottom = Number.parseFloat(style.scrollPaddingBottom) || 0;
        const [viewTop, height] = viewport(scroller) as [number, number];
        const row = Math.floor(index / columns());
        // The row's edges from the viewport's, past the scroll padding (a sticky header).
        const top = element.getBoundingClientRect().top + start(row) - viewTop - padTop;
        const bottom = top + size(row) - (height - padTop - padBottom);
        if (align === "auto") {
          if (top >= 0 && bottom <= 0) return;
          align = top < 0 ? "start" : "end";
        }
        const delta = align === "start" ? top : align === "end" ? bottom : (top + bottom) / 2;
        if (Math.abs(delta) < 1) return;
        (scroller ?? window).scrollBy({ top: delta, behavior });
        // Rows measured on the way can move the target: check it again for a few frames.
        if (behavior !== "smooth" && ++tries < 5) requestAnimationFrame(go);
      };
      go();
    },
  };
}
