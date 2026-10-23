// The page of scripts/measure-ab.ts (TASK-527): N keyed rows of 8 cards whose `attach` measures
// the row (getBoundingClientRect) and then writes a signal the page renders: the row's
// min-height, and the list's total height through a computed, as a virtual list that measures
// its rows does. Each build registers itself on `globalThis.lumioseMeasure`, in script order.
import { computed, flush, signal, type Signal } from "lumiose";
import { render } from "lumiose/dom";

interface RowData {
  key: number;
  label: string;
  size: Signal<number>;
}

const COLUMNS = 8;
const names = ["Lamp", "Chair", "Desk", "Shelf", "Rug", "Clock", "Vase", "Mirror", "Stool", "Bench", "Sofa"]; // prettier-ignore

let nextKey = 1;

function buildRows(count: number): RowData[] {
  return Array.from({ length: count }, () => {
    const key = nextKey++;
    return { key, label: `${names[key % names.length]} ${key}`, size: signal(0) };
  });
}

function Row(props: { row: RowData }) {
  const measure = (el: Element) => {
    props.row.size.set(Math.ceil(el.getBoundingClientRect().height) + 1);
  };
  return (
    <div class="row" style={{ "min-height": `${props.row.size()}px` }} attach={[measure]}>
      {Array.from({ length: COLUMNS }, (_, column) => (
        <article class="card">
          <span class="thumb" />
          <span class="name">{`${props.row.label}.${column}`}</span>
          <footer>{props.row.key % 5} / 5</footer>
        </article>
      ))}
    </div>
  );
}

const rows = signal<RowData[]>([]);
const total = computed(() => rows().reduce((sum, row) => sum + row.size(), 0));
let count = 10;
let dispose: (() => void) | undefined;

function List() {
  return (
    <div class="rows">
      <div class="spacer" />
      {rows().map((row) => (
        <Row key={row.key} row={row} />
      ))}
      <div class="total" style={{ height: `${total() % 7}px` }} data-total={total()} />
    </div>
  );
}

const api = {
  /** Renders `n` fresh rows into `root` and runs their attachments. */
  mount(root: Element, n: number): void {
    count = n;
    rows.set(buildRows(count));
    dispose = render(() => <List />, root);
    flush();
  },
  /** Replaces every row (new keys): the new rows' attachments measure, then write. */
  replace(): void {
    rows.set(buildRows(count));
    flush();
  },
  unmount(): void {
    dispose?.();
    dispose = undefined;
  },
  total: () => total(),
};

const registry = globalThis as { lumioseMeasure?: (typeof api)[] };
(registry.lumioseMeasure ??= []).push(api);
