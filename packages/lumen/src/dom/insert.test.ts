// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flushSync, onCleanup, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner } from "../core/internal.ts";
import { branch, createComponent, insert, template } from "./index.ts";

function root<T>(fn: () => T): [T, () => void] {
  const owner = createOwner(undefined);
  return [runWithOwner(owner, fn), () => disposeOwner(owner)];
}

function withMarker(): [HTMLElement, Comment] {
  const el = template(`<div>a<!>z`)() as HTMLElement;
  return [el, el.childNodes[1] as Comment];
}

describe("insert (static)", () => {
  it("renders text, numbers and nodes before the marker; nullish and booleans render nothing", () => {
    const [el, marker] = withMarker();
    insert(el, "b", marker);
    insert(el, 1, marker);
    insert(el, null, marker);
    insert(el, false, marker);
    insert(el, document.createElement("i"), marker);
    expect(el.innerHTML).toBe("ab1<i></i><!---->z");
  });

  it("appends when the marker is null, flattens arrays and fragments, and moves nodes", () => {
    const el = document.createElement("div");
    const moved = document.createElement("b");
    document.body.appendChild(moved);
    const fragment = document.createDocumentFragment();
    fragment.append("f1", "f2");
    insert(el, ["x", [moved, 2n], fragment, true, undefined]);
    expect(el.innerHTML).toBe("x<b></b>2f1f2");
    expect(moved.parentNode).toBe(el);
  });
});

describe("insert (dynamic)", () => {
  it("tracks a signal passed directly and updates its text node in place", () => {
    const [el, marker] = withMarker();
    const count = signal(0);
    root(() => insert(el, count, marker));
    const text = el.childNodes[1]!;
    expect(el.textContent).toBe("a0z");
    count.set(5);
    flushSync();
    expect(el.textContent).toBe("a5z");
    expect(el.childNodes[1]).toBe(text);
  });

  it("resolves nested functions and arrays, reusing text nodes and keeping node identity", () => {
    const [el, marker] = withMarker();
    const n = signal(1);
    const b = document.createElement("b");
    root(() => insert(el, () => ["x", () => n(), b], marker));
    const [x, one] = [el.childNodes[1], el.childNodes[2]];
    expect(el.innerHTML).toBe("ax1<b></b><!---->z");
    n.set(2);
    flushSync();
    expect(el.innerHTML).toBe("ax2<b></b><!---->z");
    expect(el.childNodes[1]).toBe(x);
    expect(el.childNodes[2]).toBe(one);
    expect(el.childNodes[3]).toBe(b);
  });

  it("switches between text, nodes, lists and nothing", () => {
    const [el, marker] = withMarker();
    const value = signal<Renderable>("t");
    root(() => insert(el, value, marker));
    const i = document.createElement("i");
    const u = document.createElement("u");
    const steps: [Renderable, string][] = [
      [i, "a<i></i><!---->z"],
      [[u, i, "s"], "a<u></u><i></i>s<!---->z"],
      [[i, u], "a<i></i><u></u><!---->z"],
      [null, "a<!---->z"],
      ["back", "aback<!---->z"],
      [[], "a<!---->z"],
    ];
    for (const [next, html] of steps) {
      value.set(next);
      flushSync();
      expect(el.innerHTML).toBe(html);
    }
  });

  it("keeps its position among siblings when appending without a marker", () => {
    const el = document.createElement("div");
    const a = signal<Renderable>("a");
    const b = signal<Renderable>("b");
    root(() => {
      insert(el, a);
      insert(el, b);
    });
    a.set(["a1", "a2"]);
    flushSync();
    expect(el.textContent).toBe("a1a2b");
  });

  it("disposes what an evaluation created before the next one", () => {
    const el = document.createElement("div");
    const log: string[] = [];
    const which = signal("A");
    const Child = (props: { name: string }): Renderable => {
      onCleanup(() => log.push(`cleanup ${props.name}`));
      return props.name;
    };
    const [, dispose] = root(() => insert(el, () => createComponent(Child, { name: which() })));
    expect(el.textContent).toBe("A");
    which.set("B");
    flushSync();
    expect(el.textContent).toBe("B");
    expect(log).toEqual(["cleanup A"]);
    dispose();
    expect(log).toEqual(["cleanup A", "cleanup B"]);
  });
});

describe("branch", () => {
  it("re-renders only when !!cond flips and disposes the inactive branch", () => {
    const [el, marker] = withMarker();
    const count = signal(1);
    const log: string[] = [];
    let created = 0;
    const view = (name: string) => (): Renderable => {
      created++;
      onCleanup(() => log.push(`dispose ${name}`));
      return template(`<i>${name}`)();
    };
    root(() => branch(el, marker, count, view("yes"), view("no")));
    expect(el.innerHTML).toBe("a<i>yes</i><!---->z");
    count.set(2);
    flushSync();
    expect(created).toBe(1);
    count.set(0);
    flushSync();
    expect(el.innerHTML).toBe("a<i>no</i><!---->z");
    expect(log).toEqual(["dispose yes"]);
    expect(created).toBe(2);
  });

  it("renders nothing without whenFalse and tracks reads inside the active view", () => {
    const [el, marker] = withMarker();
    const show = signal(false);
    const count = signal(1);
    let views = 0;
    root(() =>
      branch(el, marker, show, () => {
        views++;
        return count();
      }),
    );
    expect(el.innerHTML).toBe("a<!---->z");
    show.set(true);
    flushSync();
    expect(el.textContent).toBe("a1z");
    count.set(2);
    flushSync();
    expect(el.textContent).toBe("a2z");
    show.set(false);
    flushSync();
    expect(el.innerHTML).toBe("a<!---->z");
    count.set(3);
    flushSync();
    expect(views).toBe(2);
  });
});
