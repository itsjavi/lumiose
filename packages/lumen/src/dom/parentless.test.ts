// @vitest-environment happy-dom
// Parentless branch and list values (TASK-49): conditionals and `.map()` in component children,
// fragments and nested ternaries keep their memoisation and keyed reconciliation.
import { describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flushSync, onCleanup, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner, type Owner } from "../core/internal.ts";
import { branchValue, createComponent, insert, listValue, template } from "./index.ts";

const tP = template(`<p> `);

function p(text: string): HTMLElement {
  const el = tP() as HTMLElement;
  (el.firstChild as Text).data = text;
  return el;
}

function root(fn: () => void): Owner {
  const owner = createOwner(undefined);
  runWithOwner(owner, fn);
  return owner;
}

function render(value: () => Renderable): { el: HTMLElement; owner: Owner } {
  const el = document.createElement("div");
  const owner = root(() => insert(el, value()));
  return { el, owner };
}

function Card(props: { children: Renderable }): Renderable {
  const el = document.createElement("section");
  insert(el, props.children);
  return el;
}

const texts = (el: Element): string[] => Array.from(el.children, (child) => child.textContent!);

describe("branchValue", () => {
  it("renders among siblings, memoised on !!cond, and disposes the inactive view", () => {
    const n = signal(1);
    const log: string[] = [];
    let views = 0;
    const view = (name: string) => (): Renderable => {
      views++;
      onCleanup(() => log.push(`dispose ${name}`));
      return p(name);
    };
    const { el, owner } = render(() => [p("a"), branchValue(n, view("yes"), view("no")), p("b")]);
    expect(texts(el)).toEqual(["a", "yes", "b"]);
    n.set(2);
    flushSync();
    expect(views).toBe(1);
    n.set(0);
    flushSync();
    expect(texts(el)).toEqual(["a", "no", "b"]);
    expect(log).toEqual(["dispose yes"]);
    disposeOwner(owner);
    expect(log).toEqual(["dispose yes", "dispose no"]);
  });

  it("nests for chained ternaries without re-rendering the outer branch", () => {
    const a = signal(true);
    const b = signal(true);
    let outer = 0;
    const { el } = render(() =>
      branchValue(
        a,
        () => {
          outer++;
          return branchValue(
            b,
            () => p("a & b"),
            () => p("a only"),
          );
        },
        () => p("neither"),
      ),
    );
    expect(texts(el)).toEqual(["a & b"]);
    b.set(false);
    flushSync();
    expect(texts(el)).toEqual(["a only"]);
    expect(outer).toBe(1);
    a.set(false);
    flushSync();
    expect(texts(el)).toEqual(["neither"]);
  });
});

describe("listValue", () => {
  it("reconciles keyed rows between siblings: append, swap, remove and clear keep the siblings", () => {
    const items = signal<{ id: number }[]>([]);
    const one = { id: 1 };
    const two = { id: 2 };
    const three = { id: 3 };
    let renders = 0;
    const { el } = render(() => [
      p("head"),
      listValue(items, (item) => {
        renders++;
        return p(`#${item.id}`);
      }),
      p("tail"),
    ]);
    expect(texts(el)).toEqual(["head", "tail"]);
    items.set([one, two, three]);
    flushSync();
    expect(texts(el)).toEqual(["head", "#1", "#2", "#3", "tail"]);
    const second = el.children[2];
    items.set([three, two, one]);
    flushSync();
    expect(texts(el)).toEqual(["head", "#3", "#2", "#1", "tail"]);
    expect(el.children[2]).toBe(second);
    items.set([three, one]);
    flushSync();
    expect(texts(el)).toEqual(["head", "#3", "#1", "tail"]);
    expect(renders).toBe(3);
    items.set([]);
    flushSync();
    expect(texts(el)).toEqual(["head", "tail"]);
  });

  it("works as component children and as the active view of a branch, disposing rows with it", () => {
    const show = signal(true);
    const items = signal(["x", "y"]);
    const log: string[] = [];
    const { el } = render(() =>
      createComponent(Card, {
        get children() {
          return branchValue(show, () =>
            listValue(items, (item) => {
              onCleanup(() => log.push(`dispose ${item}`));
              return p(item);
            }),
          );
        },
      }),
    );
    const section = el.firstElementChild!;
    expect(texts(section)).toEqual(["x", "y"]);
    items.set(["y", "z"]);
    flushSync();
    expect(texts(section)).toEqual(["y", "z"]);
    expect(log).toEqual(["dispose x"]);
    show.set(false);
    flushSync();
    expect(texts(section)).toEqual([]);
    expect(log.toSorted()).toEqual(["dispose x", "dispose y", "dispose z"]);
  });

  it("moves with its range when an outer list reorders", () => {
    const groups = signal([
      { name: "g1", items: ["a", "b"] },
      { name: "g2", items: ["c"] },
    ]);
    const { el } = render(() =>
      listValue(groups, (group) => [
        p(group.name),
        listValue(
          () => group.items,
          (item) => p(item),
        ),
      ]),
    );
    expect(texts(el)).toEqual(["g1", "a", "b", "g2", "c"]);
    groups.set([groups()[1]!, groups()[0]!]);
    flushSync();
    expect(texts(el)).toEqual(["g2", "c", "g1", "a", "b"]);
  });
});
