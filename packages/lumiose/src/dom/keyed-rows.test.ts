// @vitest-environment happy-dom
// Keyed rows against real compiler output (decision-83, TASK-554): the key alone decides whether a
// row is kept. A kept row whose item is a new object keeps its DOM, components, local state and
// effects, and what reads the item updates. Unkeyed lists still match rows by reference.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumiose/compiler";
import { afterEach, describe, expect, it } from "vitest";
import { flush } from "../core/index.ts";
import { render } from "./index.ts";

const src = resolve(import.meta.dirname, "..");
const IMPORTS = { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" } as const;
// Compiled modules go to packages/lumiose/test/out (ignored), inside the Vite root.
const out = resolve(src, "../test/out/keyed-rows");
mkdirSync(out, { recursive: true });
let counter = 0;

type Module = Record<string, any>;

/** Compiles `source` for the client and imports it. */
async function load(source: string): Promise<Module> {
  const result = compile(source, `/src/case${counter}.tsx`, {
    target: "client",
    styleImport: false,
    sourceMap: false,
  });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  let code = result.code;
  for (const [specifier, file] of Object.entries(IMPORTS)) {
    code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
  }
  const path = join(out, `case${counter++}-${Date.now()}.client.js`);
  writeFileSync(path, code);
  return (await import(/* @vite-ignore */ path)) as Module;
}

function mount(module: Module): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  render(() => module.App({}), root);
  flush();
  return root;
}

/** Two row entries of two cards each, new objects every call (the cards' ids are their names). */
function make(names: string[]) {
  return [0, 1].map((index) => ({
    index,
    row: names.slice(index * 2, index * 2 + 2).map((name) => ({ id: name.toLowerCase(), name })),
  }));
}

afterEach(() => {
  document.body.textContent = "";
});

describe("keyed rows", () => {
  it("keep their DOM, components, state and effects when their item is a new object", async () => {
    const module = await load(`
      import { effect, onCleanup, signal } from "lumiose";
      type Item = { id: number; name: string };
      export const items = signal<Item[]>([{ id: 1, name: "a" }, { id: 2, name: "b" }]);
      export const log: string[] = [];
      function Counter(props: { item: Item }) {
        const count = signal(0);
        return <button onClick={() => count.update((n) => n + 1)}>{props.item.name}:{count()}</button>;
      }
      export function App() {
        return (
          <ul>
            {items().map((item, i) => {
              effect(() => log.push(\`effect \${item.name}\`));
              onCleanup(() => log.push(\`cleanup \${item.id}\`));
              return <li key={item.id} title={item.name}>{i}<Counter item={item} /></li>;
            })}
          </ul>
        );
      }`);
    const root = mount(module);
    const [li1, li2] = root.querySelectorAll("li");
    root.querySelectorAll("button")[1]!.click();
    flush();
    expect(root.textContent).toBe("0a:01b:1");
    module.log.length = 0;

    // A refetch: new objects with the same ids, one renamed, in a new order.
    module.items.set([
      { id: 2, name: "B" },
      { id: 1, name: "a" },
    ]);
    flush();
    expect([...root.querySelectorAll("li")]).toEqual([li2, li1]);
    expect(root.textContent).toBe("0B:11a:0");
    expect(li2!.title).toBe("B");
    expect(module.log.toSorted()).toEqual(["effect B", "effect a"]);

    module.items.set([{ id: 1, name: "z" }]);
    flush();
    expect(module.log).toContain("cleanup 2");
    expect(root.querySelector("li")).toBe(li1);
    expect(root.textContent).toBe("0z:0");
  });

  it("make destructured item bindings live, defaults included", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      type Item = { id: number; name?: string; tags: string[] };
      export const items = signal<Item[]>([{ id: 1, name: "a", tags: ["x"] }]);
      export function App() {
        return (
          <ul>
            {items().map(({ id, name = "?", tags: [first] }) => (
              <li key={id}>{name}/{first}</li>
            ))}
          </ul>
        );
      }`);
    const root = mount(module);
    const li = root.querySelector("li");
    module.items.set([{ id: 1, tags: ["y"] }]);
    flush();
    expect(root.querySelector("li")).toBe(li);
    expect(root.textContent).toBe("?/y");
  });

  it("give data-slot handlers the current item", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      type Item = { id: number; name: string };
      export const items = signal<Item[]>([{ id: 1, name: "a" }]);
      export const picked: string[] = [];
      const pick = (item: Item) => picked.push(item.name);
      export function App() {
        return <ul>{items().map((item) => <li key={item.id} onClick={() => pick(item)}>{item.name}</li>)}</ul>;
      }`);
    const root = mount(module);
    module.items.set([{ id: 1, name: "b" }]);
    flush();
    root.querySelector("li")!.click();
    expect(module.picked).toEqual(["b"]);
  });

  it("update nested keyed lists in place when the row entries are re-derived", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      type Card = { id: string; name: string };
      type Entry = { index: number; row: Card[] };
      export const entries = signal<Entry[]>([]);
      export let cards = 0;
      function Tile(props: { card: Card }) {
        cards++;
        return <b>{props.card.name}</b>;
      }
      export function App() {
        return (
          <div>
            {entries().map(({ index, row }) => (
              <p key={\`\${index}:\${row.map((card) => card.id).join("|")}\`}>
                {row.map((card) => <Tile key={card.id} card={card} />)}
              </p>
            ))}
          </div>
        );
      }`);
    module.entries.set(make(["a", "b", "c", "d"]));
    const root = mount(module);
    const nodes = [...root.querySelectorAll("p, b")];
    expect(module.cards).toBe(4);
    // The same cards in new entries, then refetched copies with a new name.
    module.entries.set(make(["a", "b", "c", "d"]));
    flush();
    module.entries.set(make(["a", "b", "C", "d"]));
    flush();
    expect([...root.querySelectorAll("p, b")]).toEqual(nodes);
    expect(module.cards).toBe(4);
    expect(root.textContent).toBe("abCd");
  });

  it("write only what changed when the item first changes in place, then on later changes", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      type Item = { id: number; name: string; tag?: string };
      export const items = signal<Item[]>([{ id: 1, name: "a", tag: "new" }, { id: 2, name: "b" }]);
      export const compact = signal(false);
      function Tag(props: { label: string }) {
        return <i>{props.label}</i>;
      }
      function Card(props: { item: Item }) {
        return (
          <article>
            {props.item.tag ? <Tag label={props.item.tag} /> : null}
            {compact() ? null : <span>{props.item.name}</span>}
          </article>
        );
      }
      export function App() {
        return <div>{items().map((item) => <Card key={item.id} item={item} />)}</div>;
      }`);
    const root = mount(module);
    const nodes = () => [...root.querySelectorAll("*")];
    const before = nodes();
    for (const name of ["A", "B"]) {
      const observer = new MutationObserver(() => {});
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      module.items.set([
        { id: 1, name, tag: "new" },
        { id: 2, name: "b" },
      ]);
      flush();
      const records = observer.takeRecords();
      observer.disconnect();
      expect(records.map((record) => record.type)).toEqual(["characterData"]);
      expect(nodes()).toEqual(before);
    }
    expect(root.textContent).toBe("newBb");
  });

  it("update dynamic content whose bindings read the item around nested ones", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      type Item = { id: number; a: string; b: string };
      export const items = signal<Item[]>([{ id: 1, a: "a", b: "b" }]);
      export function App() {
        return <p>{items().map((item) => <span key={item.id}>{[item.a, <i>{item.b}</i>, item.a]}</span>)}</p>;
      }`);
    const root = mount(module);
    for (const [a, b] of [
      ["A", "B"],
      ["x", "y"],
    ]) {
      module.items.set([{ id: 1, a, b }]);
      flush();
      expect(root.textContent).toBe(`${a}${b}${a}`);
    }
  });

  it("leave unkeyed lists matching by reference", async () => {
    const module = await load(`
      import { signal } from "lumiose";
      export const items = signal([{ name: "a" }]);
      export function App() {
        return <ul>{items().map((item) => <li>{item.name}</li>)}</ul>;
      }`);
    const root = mount(module);
    const li = root.querySelector("li");
    module.items.set([{ name: "b" }]);
    flush();
    expect(root.querySelector("li")).not.toBe(li);
    expect(root.textContent).toBe("b");
  });
});
