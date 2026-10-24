// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import {
  computed,
  effect,
  flush,
  onCleanup,
  reconcile,
  signal,
  store,
  type Signal,
} from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner, type Owner } from "../core/internal.ts";
import { attach, bind, branch, insert, list, listValue, setText, template } from "./index.ts";
import { longestIncreasingSubsequence } from "./list.ts";

interface Item {
  id: number;
}

const tLi = template(`<li> `);

function root(fn: () => void): Owner {
  const owner = createOwner(undefined);
  runWithOwner(owner, fn);
  return owner;
}

/** Counts DOM mutations made through `parent` (removals done by a `textContent` clear excluded). */
function spyMutations(parent: Node): { inserts: number; removes: number; clears: number } {
  const counts = { inserts: 0, removes: 0, clears: 0 };
  let clearing = false;
  const insertBefore = parent.insertBefore.bind(parent);
  const removeChild = parent.removeChild.bind(parent);
  let proto = Object.getPrototypeOf(parent) as object;
  while (!Object.hasOwn(proto, "textContent")) {
    proto = Object.getPrototypeOf(proto) as object;
  }
  const textContent = Object.getOwnPropertyDescriptor(proto, "textContent")!;
  parent.insertBefore = <T extends Node>(node: T, ref: Node | null): T => {
    counts.inserts++;
    return insertBefore(node, ref);
  };
  parent.removeChild = <T extends Node>(node: T): T => {
    counts.removes += clearing ? 0 : 1;
    return removeChild(node);
  };
  Object.defineProperty(parent, "textContent", {
    get: () => textContent.get!.call(parent),
    set: (value: string) => {
      counts.clears++;
      clearing = true;
      textContent.set!.call(parent, value);
      clearing = false;
    },
  });
  return counts;
}

/**
 * What `update` does to `parent`: the MutationObserver records under it, and the nodes passed to
 * each `insertBefore` on it (happy-dom reports a fragment's insertion as one record per node, where
 * browsers report one record).
 */
function observe(parent: Node, update: () => void) {
  const inserted: Node[] = [];
  const insertBefore = parent.insertBefore.bind(parent);
  parent.insertBefore = <T extends Node>(node: T, ref: Node | null): T => {
    inserted.push(node);
    return insertBefore(node, ref);
  };
  const observer = new MutationObserver(() => {});
  observer.observe(parent, { childList: true, subtree: true });
  update();
  const records = observer.takeRecords();
  observer.disconnect();
  return { records, inserted };
}

function items(...ids: number[]): Item[] {
  return ids.map((id) => ({ id }));
}

function renderItem(item: Item): Node {
  const li = tLi();
  li.firstChild!.nodeValue = String(item.id);
  return li;
}

function text(el: Node): string[] {
  return Array.from(el.childNodes, (n) => n.textContent ?? "");
}

describe("list", () => {
  it("creates, appends, removes and clears rows in order", () => {
    const ul = document.createElement("ul");
    const source = signal(items(1, 2, 3));
    root(() => list(ul, null, source, renderItem));
    expect(text(ul)).toEqual(["1", "2", "3"]);
    source.set([...source(), ...items(4, 5)]);
    flush();
    expect(text(ul)).toEqual(["1", "2", "3", "4", "5"]);
    source.set(source().filter((i) => i.id % 2));
    flush();
    expect(text(ul)).toEqual(["1", "3", "5"]);
    source.set([]);
    flush();
    expect(ul.childNodes.length).toBe(0);
  });

  it("treats null and undefined sources as empty", () => {
    const ul = document.createElement("ul");
    const source = signal<Item[] | null>(null);
    root(() => list(ul, null, source, renderItem));
    expect(ul.childNodes.length).toBe(0);
    source.set(items(1));
    flush();
    expect(text(ul)).toEqual(["1"]);
    source.set(null);
    flush();
    expect(ul.childNodes.length).toBe(0);
  });

  it("renders before its marker, next to static siblings", () => {
    const el = template(`<div><b>head</b><!><i>tail`)();
    const marker = el.childNodes[1]!;
    const source = signal(items(1, 2));
    root(() => list(el, marker, source, renderItem));
    expect(text(el)).toEqual(["head", "1", "2", "", "tail"]);
    source.set(items(3).concat(source().toReversed()));
    flush();
    expect(text(el)).toEqual(["head", "3", "2", "1", "", "tail"]);
    source.set([]);
    flush();
    expect(text(el)).toEqual(["head", "", "tail"]);
  });

  it("clears through textContent when it owns the parent, and keeps its marker", () => {
    const el = template(`<div><!>`)();
    const marker = el.firstChild!;
    const source = signal(items(1, 2, 3));
    root(() => list(el, marker, source, renderItem));
    const counts = spyMutations(el);
    source.set([]);
    flush();
    expect(counts).toMatchObject({ removes: 0, clears: 1 });
    expect(el.childNodes.length).toBe(1);
    expect(el.firstChild).toBe(marker);
    source.set(items(4));
    flush();
    expect(text(el)).toEqual(["4", ""]);
  });

  it("replaces every row with one clear and n inserts", () => {
    const ul = document.createElement("ul");
    const source = signal(items(1, 2, 3, 4));
    root(() => list(ul, null, source, renderItem));
    const counts = spyMutations(ul);
    source.set(items(5, 6, 7, 8));
    flush();
    expect(text(ul)).toEqual(["5", "6", "7", "8"]);
    expect(counts).toEqual({ inserts: 4, removes: 0, clears: 1 });
  });

  it("swaps two rows with two moves (js-framework-benchmark swap)", () => {
    const ul = document.createElement("ul");
    const data = items(...Array.from({ length: 1000 }, (_, i) => i));
    const source = signal(data);
    root(() => list(ul, null, source, renderItem));
    const second = ul.childNodes[1];
    const counts = spyMutations(ul);
    const next = data.slice();
    [next[1], next[998]] = [next[998]!, next[1]!];
    source.set(next);
    flush();
    expect(counts).toEqual({ inserts: 2, removes: 0, clears: 0 });
    expect(ul.childNodes[998]).toBe(second);
    expect(ul.childNodes[1]!.textContent).toBe("998");
  });

  it("moves only rows outside the longest increasing subsequence", () => {
    const ul = document.createElement("ul");
    const data = items(1, 2, 3, 4, 5, 6);
    const source = signal(data);
    root(() => list(ul, null, source, renderItem));
    const counts = spyMutations(ul);
    const [a, b, c, d, e, f] = data as [Item, Item, Item, Item, Item, Item];
    source.set([b, f, c, d, a, e]);
    flush();
    expect(text(ul)).toEqual(["2", "6", "3", "4", "1", "5"]);
    // 2,3,4,5 stay; 6 and 1 move.
    expect(counts).toEqual({ inserts: 2, removes: 0, clears: 0 });
  });

  it("removes one row with one removal", () => {
    const ul = document.createElement("ul");
    const source = signal(items(1, 2, 3, 4));
    root(() => list(ul, null, source, renderItem));
    const counts = spyMutations(ul);
    source.set(source().filter((i) => i.id !== 3));
    flush();
    expect(counts).toEqual({ inserts: 0, removes: 1, clears: 0 });
  });

  describe("rows with nested dynamic content (TASK-522)", () => {
    interface Card {
      id: number;
      tag: boolean;
    }
    interface GridRow {
      cards: Card[];
    }
    const tGrid = template(`<div><hr><hr>`);
    const tRow = template(`<div>`);
    const tCard = template(`<article> <!>`);
    const tTag = template(`<b>`);

    // A card with a conditional; a row's cards are a nested keyed list inside a range (what a
    // fragment or a component's children compile to).
    function card(c: Card): Node {
      const el = tCard();
      el.firstChild!.nodeValue = String(c.id);
      branch(el, el.lastChild, () => c.tag, tTag);
      return el;
    }
    const cards = (row: GridRow) =>
      listValue(
        () => row.cards,
        (c) => card(c.v),
        (c) => c.id,
      );

    let nextId = 0;
    function rows(count: number): GridRow[] {
      return Array.from({ length: count }, () => ({
        cards: Array.from({ length: 4 }, () => ({ id: nextId++, tag: nextId % 2 === 0 })),
      }));
    }

    /** Renders `render`'s rows between two spacers (so the list never owns its parent). */
    function mount(render: (row: GridRow) => Node) {
      const grid = tGrid();
      const source = signal(rows(3));
      root(() => list(grid, grid.lastChild, source, render));
      return { grid, source };
    }

    it("inserts and removes each row with a root once", () => {
      const { grid, source } = mount((row) => {
        const el = tRow();
        insert(el, cards(row));
        return el;
      });
      const before = Array.from(grid.childNodes).slice(1, -1);
      const { records, inserted } = observe(grid, () => {
        source.set(rows(3));
        flush();
      });
      // Nothing is written inside a row in the document: each new row was complete when inserted.
      expect(records.every((record) => record.target === grid)).toBe(true);
      expect(inserted.map((node) => node.nodeName)).toEqual(["DIV", "DIV", "DIV"]);
      expect(records.flatMap((record) => Array.from(record.removedNodes))).toEqual(before);
      expect(grid.textContent).toBe(
        source()
          .flatMap((row) => row.cards.map((c) => c.id))
          .join(""),
      );
    });

    it("inserts each row that renders several nodes with one insertion", () => {
      const { grid, source } = mount(cards);
      const before = Array.from(grid.childNodes).slice(1, -1);
      const { records, inserted } = observe(grid, () => {
        source.set(rows(3));
        flush();
      });
      expect(records.every((record) => record.target === grid)).toBe(true);
      // One insertion per row, the fragment holding the whole row: its range's markers and its 4
      // cards. A row without a root of its own still leaves node by node.
      expect(inserted.map((node) => node.nodeType)).toEqual([11, 11, 11]);
      expect(records.filter((record) => record.addedNodes.length > 0)).toHaveLength(18);
      expect(records.flatMap((record) => Array.from(record.removedNodes))).toEqual(before);
      expect(grid.querySelectorAll("article")).toHaveLength(12);
      expect(grid.querySelectorAll("b")).toHaveLength(6);
      expect(grid.textContent).toBe(
        source()
          .flatMap((row) => row.cards.map((c) => c.id))
          .join(""),
      );
    });

    it("runs a row's attachments once every new row is in the document (docs: JSX)", () => {
      const seen: string[] = [];
      const { grid, source } = mount((row) => {
        const el = tRow();
        insert(el, cards(row));
        attach(el, () => [
          (node) => {
            seen.push(`${node.isConnected} ${grid.querySelectorAll("article").length}`);
          },
        ]);
        return el;
      });
      document.body.append(grid);
      flush();
      seen.length = 0;
      source.set(rows(3));
      flush();
      expect(seen).toEqual(["true 12", "true 12", "true 12"]);
      grid.remove();
    });
  });

  it("creates the index signal only when render declares it, and keeps it current", () => {
    const ul = document.createElement("ul");
    const data = items(1, 2, 3);
    const source = signal(data);
    let indexes = 0;
    root(() =>
      list(ul, null, source, (item: Item, index: () => number) => {
        indexes++;
        const li = tLi();
        bind(li.firstChild as Text, () => `${index()}:${item.id}`, setText);
        return li;
      }),
    );
    expect(text(ul)).toEqual(["0:1", "1:2", "2:3"]);
    source.set([data[2]!, data[0]!, data[1]!]);
    flush();
    expect(text(ul)).toEqual(["0:3", "1:1", "2:2"]);
    expect(indexes).toBe(3);
    let declared = 0;
    const ol = document.createElement("ol");
    root(() =>
      list(ol, null, source, (item: Item, ...rest: unknown[]) => {
        declared += rest.length;
        return renderItem(item);
      }),
    );
    expect(declared).toBe(0);
  });

  it("allocates row owners lazily and disposes them with their rows", () => {
    const ul = document.createElement("ul");
    const log: number[] = [];
    const source = signal(items(1, 2, 3));
    const owner = root(() =>
      list(ul, null, source, (item: Item) => {
        if (item.id === 2) {
          onCleanup(() => log.push(item.id));
        }
        return renderItem(item);
      }),
    );
    // One list binding under the root; one materialized row owner under it.
    const binding = owner.firstChild!;
    let rowOwners = 0;
    for (let child = binding.firstChild; child; child = child.nextSibling) {
      rowOwners++;
    }
    expect(rowOwners).toBe(1);
    source.set(source().filter((i) => i.id !== 2));
    flush();
    expect(log).toEqual([2]);
    expect(binding.firstChild).toBeUndefined();
  });

  it("keeps a row whose item changed under its key and updates it in place (decision-83)", () => {
    const ul = document.createElement("ul");
    const source = signal([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    const log: string[] = [];
    let renders = 0;
    root(() =>
      list(
        ul,
        null,
        source,
        (item) => {
          renders++;
          const li = tLi();
          const count = signal(0);
          bind(li.firstChild as Text, () => `${item.v.name}${count()}`, setText);
          // Setup reads the first item; the binding and the cleanup see the current one.
          const first = item.v.name;
          onCleanup(() => log.push(`${first}>${item.v.name}`));
          return li;
        },
        (item) => item.id,
      ),
    );
    const [li1, li2] = [ul.children[0], ul.children[1]];
    const mutations = spyMutations(ul);
    source.set([source()[0]!, { id: 2, name: "B" }]);
    flush();
    expect(text(ul)).toEqual(["a0", "B0"]);
    expect([ul.children[0], ul.children[1]]).toEqual([li1, li2]);
    expect(renders).toBe(2);
    expect(log).toEqual([]);
    expect(mutations).toEqual({ inserts: 0, removes: 0, clears: 0 });

    // New objects for every row, moved: the same nodes, reordered, with the new items.
    source.set([
      { id: 2, name: "B2" },
      { id: 1, name: "A2" },
    ]);
    flush();
    expect(text(ul)).toEqual(["B20", "A20"]);
    expect([ul.children[0], ul.children[1]]).toEqual([li2, li1]);
    expect(renders).toBe(2);
    source.set([{ id: 1, name: "A3" }]);
    flush();
    expect(log).toEqual(["b>B2"]);
  });

  it("updates a kept row's computeds, effects and later-created bindings, change after change", () => {
    const ul = document.createElement("ul");
    const source = signal([{ id: 1, name: "a" }]);
    const show = signal(false);
    const seen: string[] = [];
    root(() =>
      list(
        ul,
        null,
        source,
        (item) => {
          const li = tLi();
          const upper = computed(() => item.v.name.toUpperCase());
          bind(li.firstChild as Text, () => upper(), setText);
          effect(() => {
            seen.push(item.v.name);
          });
          branch(li, null, show, () => () => `+${item.v.name}`);
          return li;
        },
        (item) => item.id,
      ),
    );
    flush();
    for (const v of ["b", "c"]) {
      source.set([{ id: 1, name: v }]);
      flush();
    }
    expect(ul.textContent).toBe("C");
    expect(seen).toEqual(["a", "b", "c"]);
    show.set(true);
    flush();
    source.set([{ id: 1, name: "d" }]);
    flush();
    expect(ul.textContent).toBe("D+d");
  });

  it("updates a kept row's binding that also reads a computed the same write leaves unchanged (TASK-567)", () => {
    const ul = document.createElement("ul");
    const source = signal([{ id: 1, name: "a" }]);
    const count = computed(() => source().length);
    root(() =>
      list(
        ul,
        null,
        source,
        (item) => {
          const li = tLi();
          bind(li.firstChild as Text, () => `${count()}-${item.v.name}`, setText);
          return li;
        },
        (item) => item.id,
      ),
    );
    // The first change reruns the binding, which tracks the item from then on.
    for (const name of ["b", "c"]) {
      source.set([{ id: 1, name }]);
      flush();
      expect(ul.textContent).toBe(`1-${name}`);
    }
  });

  it("passes the key function the index; a keyed render without parameters needs no accessor", () => {
    const ul = document.createElement("ul");
    const source = signal(["x", "y"]);
    const seen: unknown[] = [];
    root(() =>
      list(
        ul,
        null,
        source,
        (...args: unknown[]) => {
          seen.push(typeof args[0]);
          return tLi();
        },
        (item, i) => `${i}:${item}`,
      ),
    );
    expect(seen).toEqual(["string", "string"]);
    // Keyed by position: both rows stay.
    const [li1, li2] = [ul.children[0], ul.children[1]];
    source.set(["x", "y"]);
    flush();
    expect([ul.children[0], ul.children[1]]).toEqual([li1, li2]);
    source.set(["y", "x"]);
    flush();
    expect(ul.children.length).toBe(2);
    expect(ul.children[0]).not.toBe(li1);
  });

  it("matches unkeyed rows by reference: a new object makes a new row", () => {
    const ul = document.createElement("ul");
    const source = signal(items(1, 2));
    root(() => list(ul, null, source, renderItem));
    const [li1, li2] = [ul.children[0], ul.children[1]];
    source.set([source()[0]!, { id: 2 }]);
    flush();
    expect(text(ul)).toEqual(["1", "2"]);
    expect(ul.children[0]).toBe(li1);
    expect(ul.children[1]).not.toBe(li2);
  });

  it("updates a nested keyed list when its row's item changes in place", () => {
    interface Group {
      id: number;
      cards: Item[];
    }
    const div = document.createElement("div");
    const source = signal<Group[]>([{ id: 1, cards: items(1, 2) }]);
    let rows = 0;
    let cards = 0;
    root(() =>
      list(
        div,
        null,
        source,
        (group) => {
          rows++;
          const ul = document.createElement("ul");
          list(
            ul,
            null,
            () => group.v.cards,
            (card) => {
              cards++;
              const li = tLi();
              bind(li.firstChild as Text, () => card.v.id, setText);
              return li;
            },
            (card) => card.id,
          );
          return ul;
        },
        (group) => group.id,
      ),
    );
    const ul = div.firstChild;
    const li1 = ul!.firstChild;
    // A refetch: new objects with the same ids, one card more.
    source.set([{ id: 1, cards: items(1, 2, 3) }]);
    flush();
    expect(div.firstChild).toBe(ul);
    expect(ul!.firstChild).toBe(li1);
    expect(text(ul!)).toEqual(["1", "2", "3"]);
    expect([rows, cards]).toEqual([1, 3]);
  });

  it("supports rows that render several nodes, text or dynamic content", () => {
    const ul = document.createElement("div");
    const label = signal("x");
    const source = signal(["a", "b", "c"]);
    root(() =>
      list(ul, null, source, (item): Renderable => {
        if (item === "a") {
          return [template(`<i>`)(), item];
        }
        if (item === "b") {
          return () => `${item}${label()}`;
        }
        return item;
      }),
    );
    expect(ul.textContent).toBe("abxc");
    label.set("y");
    flush();
    expect(ul.textContent).toBe("abyc");
    source.set(["c", "b", "a"]);
    flush();
    expect(ul.textContent).toBe("cbya");
    source.set(["b"]);
    flush();
    expect(ul.textContent).toBe("by");
    expect(ul.querySelector("i")).toBeNull();
  });

  it("follows in-place mutations and store arrays", () => {
    const ul = document.createElement("ul");
    const data = items(1, 2);
    const source = signal(data, { equals: false });
    root(() => list(ul, null, source, renderItem));
    data.push({ id: 3 });
    source.set(data);
    flush();
    expect(text(ul)).toEqual(["1", "2", "3"]);

    const state = store({ rows: items(1, 2) });
    const ol = document.createElement("ol");
    root(() =>
      list(
        ol,
        null,
        () => state.rows,
        (item) => renderItem(item.v),
        (i) => i.id,
      ),
    );
    state.rows.push({ id: 3 });
    flush();
    expect(text(ol)).toEqual(["1", "2", "3"]);
    state.rows[0] = { id: 9 };
    flush();
    expect(text(ol)).toEqual(["9", "2", "3"]);
  });

  it("keeps keyed rows, their DOM and their local state across a reconcile", () => {
    const ul = document.createElement("ul");
    const books = store([
      { id: 1, title: "Dune" },
      { id: 2, title: "Emma" },
    ]);
    const counters: Signal<number>[] = [];
    let renders = 0;
    root(() =>
      list(
        ul,
        null,
        () => books,
        (book) => {
          renders++;
          const li = tLi();
          const count = signal(0);
          counters.push(count);
          bind(li.firstChild as Text, () => `${book.title}:${count()}`, setText);
          return li;
        },
      ),
    );
    const [li1, li2] = [ul.children[0], ul.children[1]];
    counters[1]!.set(5);
    flush();
    const mutations = spyMutations(ul);

    // Fresh objects from the server: equal row 1, a changed title on row 2.
    reconcile(books, [
      { id: 1, title: "Dune" },
      { id: 2, title: "Emma (2nd ed.)" },
    ]);
    flush();
    expect(renders).toBe(2);
    expect(ul.children[0]).toBe(li1);
    expect(ul.children[1]).toBe(li2);
    expect(text(ul)).toEqual(["Dune:0", "Emma (2nd ed.):5"]);
    expect(mutations).toEqual({ inserts: 0, removes: 0, clears: 0 });

    // A keyed move reorders the same nodes, and a new row renders once.
    reconcile(books, [
      { id: 3, title: "Ulysses" },
      { id: 2, title: "Emma (2nd ed.)" },
      { id: 1, title: "Dune" },
    ]);
    flush();
    expect(renders).toBe(3);
    expect(ul.children[1]).toBe(li2);
    expect(ul.children[2]).toBe(li1);
    expect(text(ul)).toEqual(["Ulysses:0", "Emma (2nd ed.):5", "Dune:0"]);
  });

  it("disposes every row with the list's owner", () => {
    const ul = document.createElement("ul");
    const log: number[] = [];
    const source = signal(items(1, 2));
    const owner = root(() =>
      list(ul, null, source, (item: Item) => {
        onCleanup(() => log.push(item.id));
        return renderItem(item);
      }),
    );
    disposeOwner(owner);
    expect(log.toSorted()).toEqual([1, 2]);
    source.set(items(3));
    flush();
    expect(text(ul)).toEqual(["1", "2"]);
  });
});

describe("longestIncreasingSubsequence", () => {
  it("skips unmatched entries", () => {
    expect(longestIncreasingSubsequence(Int32Array.from([2, -1, 0, 1, 5, 3, 4]))).toEqual([
      2, 3, 5, 6,
    ]);
    expect(longestIncreasingSubsequence(Int32Array.from([-1, -1]))).toEqual([]);
    expect(longestIncreasingSubsequence(Int32Array.from([3, 2, 1]))).toHaveLength(1);
  });
});

// ---- property test ----------------------------------------------------------------------------

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Op = (xs: Item[], random: () => number, fresh: () => Item) => Item[];

const ops: Op[] = [
  (xs, _r, fresh) => [...xs, fresh(), fresh()],
  (xs, _r, fresh) => [fresh(), ...xs],
  (xs, r) => xs.filter(() => r() > 0.3),
  (xs, r, fresh) => {
    const out = xs.slice();
    out.splice(Math.floor(r() * (out.length + 1)), 0, fresh(), fresh());
    return out;
  },
  (xs, r) => {
    const out = xs.slice();
    const i = Math.floor(r() * out.length);
    const j = Math.floor(r() * out.length);
    if (out.length > 1) {
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  },
  (xs) => xs.toReversed(),
  (xs, r) => {
    const out = xs.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  },
  (xs, r) => {
    const out = xs.slice();
    if (out.length > 1) {
      const [moved] = out.splice(Math.floor(r() * out.length), 1);
      out.splice(Math.floor(r() * (out.length + 1)), 0, moved!);
    }
    return out;
  },
  (xs, r, fresh) => xs.map((x) => (r() > 0.7 ? fresh() : x)),
  (_xs, r, fresh) => Array.from({ length: Math.floor(r() * 8) }, fresh),
  () => [],
];

describe("list (property)", () => {
  for (const variant of ["parent", "marker", "ranges", "indexed"] as const) {
    it(`matches the expected order and preserves node identity (${variant})`, () => {
      const random = rng(variant.length * 7919);
      let nextId = 0;
      const fresh = (): Item => ({ id: nextId++ });
      const container = template(`<div><b>head</b><!><i>tail`)();
      const marker = variant === "parent" ? null : container.childNodes[1]!;
      const parent = variant === "parent" ? document.createElement("div") : container;
      const live = new Set<number>();
      const source: Signal<Item[]> = signal<Item[]>([]);
      const render = (item: Item, index?: () => number): Renderable => {
        live.add(item.id);
        onCleanup(() => live.delete(item.id));
        if (variant === "ranges") {
          return [String(item.id), template(`<u>`)()];
        }
        const li = tLi();
        if (index !== undefined) {
          bind(li.firstChild as Text, () => `${item.id}@${index()}`, setText);
        } else {
          li.firstChild!.nodeValue = String(item.id);
        }
        return li;
      };
      root(() =>
        list(
          parent,
          marker,
          source,
          variant === "indexed"
            ? (item: Item, index: () => number) => render(item, index)
            : (item: Item) => render(item),
        ),
      );
      const rowNodes = (): Node[] => {
        const all = Array.from(parent.childNodes);
        const rows = marker === null ? all : all.slice(1, all.indexOf(marker as ChildNode));
        return variant === "ranges" ? rows.filter((n) => n.nodeName === "U") : rows;
      };
      let nodeOf = new Map<number, Node>();
      for (let step = 0; step < 400; step++) {
        const op = ops[Math.floor(random() * ops.length)]!;
        const next = op(source(), random, fresh);
        source.set(next);
        flush();
        const nodes = rowNodes();
        expect(nodes.length).toBe(next.length);
        const seen = new Map<number, Node>();
        next.forEach((item, i) => {
          const node = nodes[i]!;
          if (variant === "ranges") {
            expect(node.previousSibling!.textContent).toBe(String(item.id));
          } else {
            expect(node.textContent).toBe(
              variant === "indexed" ? `${item.id}@${i}` : String(item.id),
            );
          }
          const before = nodeOf.get(item.id);
          if (before !== undefined) {
            expect(node).toBe(before);
          }
          seen.set(item.id, node);
        });
        nodeOf = seen;
        expect([...live].toSorted((x, y) => x - y)).toEqual(
          next.map((i) => i.id).toSorted((x, y) => x - y),
        );
        if (marker !== null) {
          expect(parent.firstChild!.textContent).toBe("head");
          expect(parent.lastChild!.textContent).toBe("tail");
        }
      }
    });
  }
});
