// The React reference page of scripts/rows-ab.ts (TASK-555), built only with `--react`: the same
// rows and cards in React (production), rows keyed by their entry key and cards memoized on their
// fields, as a React virtual grid does. It registers itself on `globalThis.reactRows`.
import { createElement as h, memo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { copies, entries, imgUrl, makeItems, pad, type Entry, type Item } from "./data.ts";

function Icon(props: { id: string; className?: string }) {
  return h(
    "svg",
    {
      className: ["icon", props.className].filter(Boolean).join(" "),
      viewBox: "0 0 24 24",
      "aria-hidden": true,
    },
    h("use", { href: `#${props.id}` }),
  );
}

function TypeIcon(props: { type: string | null | undefined }) {
  if (!props.type) return null;
  return h(
    "span",
    { title: props.type, className: `type t-${props.type}` },
    h(Icon, { id: `${props.type}-sv`, className: "glyph" }),
  );
}

function CardComponent(props: { item: Item; compact?: boolean }) {
  const p = props.item;
  return h(
    "a",
    { href: `/items/${p.id}`, className: props.compact ? "card compact" : "card" },
    h(
      "figure",
      { className: "tile" },
      h("img", {
        src: imgUrl(p.nid),
        alt: "",
        loading: "lazy",
        className: props.compact ? undefined : "auto",
      }),
    ),
    props.compact
      ? null
      : h(
          "span",
          { className: "types" },
          h("span", { className: "dex" }, "#", pad(p.dexNum)),
          h(
            "span",
            { className: "type-icons" },
            h(TypeIcon, { type: p.type1 }),
            h(TypeIcon, { type: p.type2 }),
          ),
        ),
    h(
      "span",
      { className: "names" },
      h("span", { className: "species" }, p.speciesName),
      p.formName
        ? h("span", { className: "form" }, p.formName)
        : props.compact
          ? null
          : h("span", { className: "blank" }, " "),
    ),
  );
}

const Card = memo(CardComponent, (a, b) => {
  const x = a.item;
  const y = b.item;
  return (
    a.compact === b.compact &&
    x.id === y.id &&
    x.nid === y.nid &&
    x.dexNum === y.dexNum &&
    x.type1 === y.type1 &&
    x.type2 === y.type2 &&
    x.speciesName === y.speciesName &&
    x.formName === y.formName
  );
});

function Row(props: { entry: Entry }): ReactNode {
  return h(
    "div",
    { className: "row", style: { transform: `translateY(${props.entry.index * 260}px)` } },
    props.entry.row.map((item) => h(Card, { key: item.id, item })),
  );
}

let setRows: ((rows: Entry[]) => void) | undefined;

function Grid(props: { initial: Entry[] }) {
  const [rows, set] = useState(props.initial);
  setRows = set;
  return h(
    "div",
    { className: "rows" },
    rows.map((entry) => h(Row, { key: entry.key, entry })),
  );
}

let root: Root | undefined;
let items: Item[] = [];

const api = {
  mount(element: Element): void {
    items = makeItems();
    root = createRoot(element);
    flushSync(() => root!.render(h(Grid, { initial: entries(items) })));
  },
  replace(): void {
    items = makeItems();
    flushSync(() => setRows!(entries(items)));
  },
  rederive(): void {
    flushSync(() => setRows!(entries(items)));
  },
  refetch(): void {
    items = copies(items);
    flushSync(() => setRows!(entries(items)));
  },
  unmount(): void {
    root?.unmount();
    root = undefined;
  },
};

(globalThis as { reactRows?: typeof api }).reactRows = api;
