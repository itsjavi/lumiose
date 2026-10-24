// The Lumiose page of scripts/rows-ab.ts (TASK-555): keyed rows of 8 keyed cards, each card with
// an image, two type icons and a conditional, as a virtual grid renders its visible window. Each
// build registers itself on `globalThis.lumioseRows`, in script order.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { copies, entries, imgUrl, makeItems, pad, type Entry, type Item } from "./data.ts";

function Icon(props: { id: string; class?: string; label?: string }) {
  return (
    <svg
      class={["icon", props.class]}
      viewBox="0 0 24 24"
      aria-hidden={props.label ? undefined : true}
      role={props.label ? "img" : undefined}
      aria-label={props.label}
    >
      <use href={`#${props.id}`} />
    </svg>
  );
}

function TypeIcon(props: { type: string | null | undefined }) {
  return (
    <>
      {props.type ? (
        <span title={props.type} class={["type", `t-${props.type}`]}>
          <Icon id={`${props.type}-sv`} class="glyph" />
        </span>
      ) : null}
    </>
  );
}

function Card(props: { item: Item; compact?: boolean }) {
  const p = () => props.item;
  return (
    <a href={`/items/${p().id}`} class={["card", { compact: props.compact }]}>
      <figure class="tile">
        <img src={imgUrl(p().nid)} alt="" loading="lazy" class={{ auto: !props.compact }} />
      </figure>
      {props.compact ? null : (
        <span class="types">
          <span class="dex">#{pad(p().dexNum)}</span>
          <span class="type-icons">
            <TypeIcon type={p().type1} />
            <TypeIcon type={p().type2} />
          </span>
        </span>
      )}
      <span class="names">
        <span class="species">{p().speciesName}</span>
        {p().formName ? (
          <span class="form">{p().formName}</span>
        ) : props.compact ? null : (
          <span class="blank">&nbsp;</span>
        )}
      </span>
    </a>
  );
}

const rows = signal<Entry[]>([]);
let items: Item[] = [];

function Grid() {
  return (
    <div class="rows">
      {rows().map((entry) => (
        <div
          key={entry.key}
          class="row"
          style={{ transform: `translateY(${entry.index * 260}px)` }}
        >
          {entry.row.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}

let dispose: (() => void) | undefined;

const api = {
  mount(root: Element): void {
    items = makeItems();
    rows.set(entries(items));
    dispose = render(() => <Grid />, root);
    flush();
  },
  /** New ids: every row and card is new. */
  replace(): void {
    items = makeItems();
    rows.set(entries(items));
    flush();
  },
  /** The same items in new row entries, as re-deriving the visible window does. */
  rederive(): void {
    rows.set(entries(items));
    flush();
  },
  /** New item objects with the same ids (a refetch), in new row entries. */
  refetch(): void {
    items = copies(items);
    rows.set(entries(items));
    flush();
  },
  unmount(): void {
    dispose?.();
    dispose = undefined;
    rows.set([]);
    flush();
  },
};

const registry = globalThis as { lumioseRows?: (typeof api)[] };
(registry.lumioseRows ??= []).push(api);
