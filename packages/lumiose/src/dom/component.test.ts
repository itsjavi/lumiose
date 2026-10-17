// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { createContext, effect, flush, useContext, onCleanup, signal } from "../core/index.ts";
import { createOwner, disposeOwner, getOwner, runWithOwner, type Owner } from "../core/internal.ts";
import {
  $async,
  bind,
  createComponent,
  insert,
  list,
  mergeProps,
  restProps,
  setClass,
  spread,
  template,
} from "./index.ts";
import { applyScope } from "./attributes.ts";

const Static = (): Renderable => template(`<li>`)();
const Async = $async(async (): Promise<Renderable> => null);
const Untagged = async (): Promise<Renderable> => null;

function root(fn: () => void): Owner {
  const owner = createOwner(undefined);
  runWithOwner(owner, fn);
  return owner;
}

function countChildren(owner: Owner): number {
  let n = 0;
  for (let child = owner.firstChild; child; child = child.nextSibling) {
    n++;
  }
  return n;
}

describe("createComponent", () => {
  it("runs the component once, untracked, and returns its output", () => {
    const count = signal(1);
    let runs = 0;
    const tracker = createOwner(undefined);
    let out: Renderable;
    runWithOwner(tracker, () => {
      effect(() => {
        out = createComponent(
          (props: { n: () => number }) => {
            runs++;
            return `n=${props.n()}`;
          },
          { n: count },
        );
      });
    });
    flush();
    count.set(2);
    flush();
    expect(runs).toBe(1);
    expect(out!).toBe("n=1");
    disposeOwner(tracker);
  });

  it("allocates an owner only when the component registers something", () => {
    const parent = root(() => {
      createComponent(() => "static", {});
      createComponent(() => {
        onCleanup(() => {});
        return null;
      }, {});
    });
    expect(countChildren(parent)).toBe(1);
  });

  it("scopes provided context to the component's subtree", () => {
    const Theme = createContext("light");
    const seen: string[] = [];
    const Reader = (): Renderable => {
      seen.push(useContext(Theme));
      return null;
    };
    root(() => {
      createComponent(Theme, {
        value: "dark",
        get children() {
          return createComponent(Reader, {});
        },
      });
      createComponent(Reader, {});
    });
    expect(seen).toEqual(["dark", "light"]);
  });

  it("keeps components inside list rows lazy, and disposes them with their row", () => {
    const log: string[] = [];
    const ul = document.createElement("ul");
    const rows = signal(["a", "b"]);
    const WithCleanup = (props: { name: string }): Renderable => {
      onCleanup(() => log.push(props.name));
      return template(`<li>`)();
    };
    let listBinding: Owner | undefined;
    root(() => {
      list(ul, null, rows, (name) =>
        name === "a" ? createComponent(Static, {}) : createComponent(WithCleanup, { name }),
      );
      listBinding = getOwner()!.firstChild;
    });
    // Row "a" (static component) allocated nothing; row "b" has a row owner with a component owner.
    expect(countChildren(listBinding!)).toBe(1);
    expect(countChildren(listBinding!.firstChild!)).toBe(1);
    rows.set(["a"]);
    flush();
    expect(log).toEqual(["b"]);
  });

  it("renders $async-tagged components into a range of their own (./async.test.ts covers them)", () => {
    const start = createComponent(Async, {}) as Text & { $$end: Text };
    expect(start.nodeType).toBe(3);
    expect(start.nextSibling).toBe(start.$$end);
  });

  it("in development, renders an untagged async function as async and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (let i = 0; i < 2; i++) {
        const start = createComponent(Untagged, {}) as Text & { $$end: Text };
        expect(start.nextSibling).toBe(start.$$end);
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain("$async");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("restProps and mergeProps", () => {
  it("restProps excludes keys and keeps getters live", () => {
    const title = signal("a");
    const props = {
      get title() {
        return title();
      },
      id: 1,
      skip: true,
    };
    const rest = restProps(props, ["skip"]);
    expect(Object.keys(rest)).toEqual(["title", "id"]);
    title.set("b");
    expect(rest.title).toBe("b");
  });

  it("mergeProps merges left to right like spread, keeping getters live", () => {
    const v = signal(1);
    const merged = mergeProps<Record<string, unknown>>(
      { a: 1, b: 1 },
      {
        get b() {
          return v();
        },
      },
      { c: undefined },
    );
    expect(merged).toEqual({ a: 1, b: 1, c: undefined });
    v.set(5);
    expect(merged.b).toBe(5);
    expect(Object.getOwnPropertyDescriptor(merged, "b")!.get).toBeTypeOf("function");
  });
});

describe("spread", () => {
  it("drops lowercase on* keys, which would be inline handler attributes (TASK-166)", () => {
    const el = document.createElement("div");
    root(() =>
      spread(el, () => ({ onclick: "alert(1)", ONMOUSEOVER: "x", onLoad: undefined, id: "a" })),
    );
    expect(el.getAttributeNames()).toEqual(["id"]);
  });

  it("never writes innerHTML or textContent, as the server does not (TASK-470)", () => {
    const el = document.createElement("div");
    el.append("label");
    const payload = signal<Record<string, unknown>>(
      JSON.parse('{"innerHTML":"<img src=x id=pwn>","id":"a"}'),
    );
    root(() => spread(el, () => payload()));
    expect(el.innerHTML).toBe("label");
    expect(el.getAttributeNames()).toEqual(["id"]);
    payload.set({ textContent: "y", id: "b" });
    flush();
    expect(el.innerHTML).toBe("label");
    expect(el.getAttributeNames()).toEqual(["id"]);
  });

  it("applies attributes, properties, class, style, events, ref and $$scope, and diffs updates", () => {
    const el = document.createElement("input");
    const clicks: string[] = [];
    const refs: Element[] = [];
    const readOnly = signal(true);
    const onFirst = (): void => {
      clicks.push("first");
    };
    const handler = signal<(() => void) | undefined>(onFirst);
    const props = signal<Record<string, unknown>>({});
    const onCustom = (): void => {
      clicks.push("custom");
    };
    const refFn = (node: Element): void => {
      refs.push(node);
    };
    root(() =>
      spread(el, () => ({
        id: "x",
        get readonly() {
          return readOnly();
        },
        value: "v",
        class: { on: readOnly() },
        style: { color: "red" },
        "aria-hidden": false,
        get onClick() {
          return handler();
        },
        "on:custom-event": onCustom,
        ref: refFn,
        $$scope: "data-l-p1",
        children: "ignored",
        ...props(),
      })),
    );
    expect(el.id).toBe("x");
    expect(el.getAttribute("readonly")).toBe("");
    expect(el.value).toBe("v");
    expect(el.className).toBe("on");
    expect(el.style.color).toBe("red");
    expect(el.getAttribute("aria-hidden")).toBe("false");
    expect(el.hasAttribute("data-l-p1")).toBe(true);
    expect(el.hasAttribute("children")).toBe(false);
    expect(refs).toEqual([el]);
    el.click();
    el.dispatchEvent(new Event("custom-event"));
    expect(clicks).toEqual(["first", "custom"]);

    readOnly.set(false);
    handler.set(undefined);
    flush();
    expect(el.hasAttribute("readonly")).toBe(false);
    expect(el.className).toBe("");
    el.click();
    expect(clicks).toEqual(["first", "custom"]);
    expect(refs).toEqual([el]);

    props.set({ title: "t" });
    flush();
    expect(el.title).toBe("t");
    props.set({});
    flush();
    expect(el.hasAttribute("title")).toBe(false);
  });
});

describe("class passthrough (doc-2 §5.3)", () => {
  it("applies the caller's scope tokens where the child applies props.class", () => {
    const tCard = template(`<div data-l-card><h2 data-l-card> </h2><!>`);
    function Card(props: {
      title: string;
      class?: string;
      $$scope?: string;
      children?: Renderable;
    }) {
      const el = tCard();
      bind(el, () => props.class, setClass);
      applyScope(el, props.$$scope);
      bind(
        el.firstChild!.firstChild as Text,
        () => props.title,
        (n, v) => (n.data = v),
      );
      insert(el, () => props.children, el.lastChild);
      return el;
    }
    const post = signal({ title: "Hello", body: "World" });
    const host = document.createElement("main");
    root(() =>
      insert(
        host,
        createComponent(Card, {
          get title() {
            return post().title;
          },
          class: "featured",
          $$scope: "data-l-p1",
          get children() {
            return post().body;
          },
        }),
      ),
    );
    expect(host.innerHTML).toBe(
      `<div data-l-card="" class="featured" data-l-p1=""><h2 data-l-card="">Hello</h2>World<!----></div>`,
    );
    post.set({ title: "Bye", body: "Now" });
    flush();
    expect(host.textContent).toBe("ByeNow");
  });
});
