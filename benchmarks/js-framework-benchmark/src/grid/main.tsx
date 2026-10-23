// The page of scripts/grid-ab.ts (TASK-522): a virtual grid's visible window, 10 keyed rows of 8
// keyed cards, each card with a conditional, two small child components and an event handler.
// Two shapes: `fragment` rows are runs of cards in one CSS grid (a row has no element of its
// own), `element` rows each have a root element. Both lists sit between two spacers, as in a
// virtual grid, so a list never owns its parent. Each build registers itself on
// `globalThis.lumioseGrid`, in script order.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";

interface CardData {
  id: number;
  name: string;
  price: number;
  rating: number;
  tag: string | undefined;
}

interface RowData {
  key: number;
  cards: CardData[];
}

type Shape = "fragment" | "element";

const ROWS = 10;
const COLUMNS = 8;
const names = ["Lamp", "Chair", "Desk", "Shelf", "Rug", "Clock", "Vase", "Mirror", "Stool", "Bench", "Sofa"]; // prettier-ignore
const tags = ["New", "Sale", undefined, undefined, "Rare"];

let nextId = 1;

function buildRows(): RowData[] {
  const rows: RowData[] = [];
  for (let r = 0; r < ROWS; r++) {
    const cards: CardData[] = [];
    for (let c = 0; c < COLUMNS; c++) {
      const id = nextId++;
      cards.push({
        id,
        name: `${names[id % names.length]} ${id}`,
        price: (id * 37) % 500,
        rating: id % 5,
        tag: tags[id % tags.length],
      });
    }
    rows.push({ key: cards[0]!.id, cards });
  }
  return rows;
}

function Tag(props: { label: string }) {
  return <span class="tag">{props.label}</span>;
}

function Price(props: { value: number }) {
  return <span class="price">{props.value.toFixed(2)} €</span>;
}

function Card(props: { card: CardData; onPick: (id: number) => void }) {
  return (
    <article class="card" data-id={props.card.id}>
      <button type="button" class="pick" onClick={() => props.onPick(props.card.id)}>
        <span class="thumb" />
        <span class="name">{props.card.name}</span>
      </button>
      {props.card.tag ? <Tag label={props.card.tag} /> : null}
      <footer>
        <Price value={props.card.price} />
        <span class="rating">{props.card.rating} / 5</span>
      </footer>
    </article>
  );
}

function FragmentGrid(props: { rows: () => RowData[]; onPick: (id: number) => void }) {
  return (
    <div class="grid">
      <div class="spacer" />
      {props.rows().map((row) => (
        <>
          {row.cards.map((card) => (
            <Card key={card.id} card={card} onPick={props.onPick} />
          ))}
        </>
      ))}
      <div class="spacer" />
    </div>
  );
}

function ElementGrid(props: { rows: () => RowData[]; onPick: (id: number) => void }) {
  return (
    <div class="rows">
      <div class="spacer" />
      {props.rows().map((row) => (
        <div class="row" key={row.key}>
          {row.cards.map((card) => (
            <Card key={card.id} card={card} onPick={props.onPick} />
          ))}
        </div>
      ))}
      <div class="spacer" />
    </div>
  );
}

const rows = signal<RowData[]>([]);
let picked = 0;
const onPick = (id: number) => {
  picked = id;
};
let dispose: (() => void) | undefined;

const api = {
  /** Renders the grid with fresh rows into `root`. */
  mount(root: Element, shape: Shape): void {
    rows.set(buildRows());
    dispose = render(
      () =>
        shape === "fragment" ? (
          <FragmentGrid rows={rows} onPick={onPick} />
        ) : (
          <ElementGrid rows={rows} onPick={onPick} />
        ),
      root,
    );
  },
  /** Replaces every row (new keys, new cards), as clearing a search does. */
  replace(): void {
    rows.set(buildRows());
    flush();
  },
  unmount(): void {
    dispose?.();
    dispose = undefined;
  },
  picked: () => picked,
};

const registry = globalThis as { lumioseGrid?: (typeof api)[] };
(registry.lumioseGrid ??= []).push(api);
