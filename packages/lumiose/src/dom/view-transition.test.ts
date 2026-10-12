// @vitest-environment happy-dom
// viewTransition() and <ViewTransition> (TASK-252, decision-43). happy-dom has no View
// Transitions: `transitions()` stands in for `document.startViewTransition`, capturing the named
// elements (name → view-transition-class) before and after the update, as the browser does.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, signal } from "../core/index.ts";
import { createComponent, insert, list, render } from "./index.ts";
import { ViewTransition, viewTransition } from "./view-transition.ts";

type Capture = Record<string, string>;

interface Transition {
  old?: Capture;
  new?: Capture;
  /** The document's text when the update ran, before and after it. */
  before?: string;
  after?: string;
}

/** Named elements of the document: `view-transition-name` → `view-transition-class`. */
function capture(): Capture {
  const out: Capture = {};
  for (const el of document.querySelectorAll<HTMLElement>("*")) {
    const name = el.style.getPropertyValue("view-transition-name");
    if (name) out[name] = el.style.getPropertyValue("view-transition-class");
  }
  return out;
}

/** Installs a stand-in `document.startViewTransition`; returns the transitions it ran. */
function transitions(): Transition[] {
  const log: Transition[] = [];
  document.startViewTransition = ((update: () => void) => {
    const t: Transition = {};
    log.push(t);
    // The browser captures the old state in a later frame, then runs the update.
    const updateCallbackDone = Promise.resolve().then(() => {
      t.old = capture();
      t.before = document.body.textContent ?? "";
      update();
      t.after = document.body.textContent ?? "";
      t.new = capture();
    });
    return {
      updateCallbackDone,
      ready: updateCallbackDone,
      finished: updateCallbackDone.then(() => undefined),
      skipTransition() {},
    };
  }) as unknown as Document["startViewTransition"];
  return log;
}

const el = (tag: string, text?: () => string): HTMLElement => {
  const node = document.createElement(tag);
  if (text !== undefined) insert(node, text);
  return node;
};

/** `<ViewTransition {...props}><tag>{text}</tag></ViewTransition>`, in compiled form. */
const named = (
  props: { name?: string; enter?: string; exit?: string },
  tag: string,
  text: string,
) =>
  createComponent(ViewTransition, {
    ...props,
    get children() {
      return el(tag, () => text);
    },
  });

let container: HTMLElement;
let dispose: (() => void) | undefined;
const mount = (code: () => Renderable): void => {
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(code, container);
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  container?.remove();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  vi.restoreAllMocks();
});

describe("viewTransition", () => {
  it("runs the update and flushes at once without View Transitions support", async () => {
    const count = signal(0);
    mount(() => el("p", () => `count ${count()}`));
    const done = viewTransition(() => count.set(1));
    expect(container.textContent).toBe("count 1");
    await expect(done).resolves.toBeUndefined();
    await expect(
      viewTransition(() => {
        throw new Error("no");
      }),
    ).rejects.toThrow("no");
  });

  it("falls back when the reader prefers reduced motion", async () => {
    const log = transitions();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query.includes("reduce") }) as MediaQueryList,
    );
    const count = signal(0);
    mount(() => el("p", () => `count ${count()}`));
    await viewTransition(() => count.set(1));
    expect(container.textContent).toBe("count 1");
    expect(log).toHaveLength(0);
  });

  it("updates the DOM inside the transition: the old state before, the new one after", async () => {
    const log = transitions();
    const count = signal(0);
    mount(() => el("p", () => `count ${count()}`));
    const done = viewTransition(() => count.set(1));
    // The browser captures the old state first: nothing changed yet.
    expect(container.textContent).toBe("count 0");
    await done;
    expect(log).toHaveLength(1);
    expect(log[0]!.before).toBe("count 0");
    expect(log[0]!.after).toBe("count 1");
    await expect(
      viewTransition(() => {
        throw new Error("no");
      }),
    ).rejects.toThrow("no");
  });
});

describe("<ViewTransition>", () => {
  it("names its child with a useId() id, or its name", () => {
    mount(() => [named({}, "p", "a"), named({ name: "hero" }, "h1", "b")]);
    const [p, h1] = [container.querySelector("p")!, container.querySelector("h1")!];
    expect(p.style.getPropertyValue("view-transition-name")).toMatch(/^lc\d+$/);
    expect(h1.style.getPropertyValue("view-transition-name")).toBe("hero");
  });

  it("renders anything but a single element unnamed, with a warning in dev", () => {
    mount(() => createComponent(ViewTransition, { children: "text" }));
    expect(container.textContent).toBe("text");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("single element child"));
  });

  it("gives a conditional's element its enter and exit classes", async () => {
    const log = transitions();
    const open = signal(false);
    mount(() => [
      named({ name: "title", exit: "out" }, "h1", "title"),
      () => (open() ? named({ name: "toast", enter: "in", exit: "out" }, "p", "toast") : null),
    ]);
    await viewTransition(() => open.set(true));
    // Enters: only in the new state, with its enter class. The title stays, without a class.
    expect(log[0]!.old).toEqual({ title: "out" });
    expect(log[0]!.new).toEqual({ title: "", toast: "in" });
    // The enter class goes once the transition finished.
    expect(capture()).toEqual({ title: "", toast: "" });
    await viewTransition(() => open.set(false));
    // Exits: only in the old state, with its exit class.
    expect(log[1]!.old).toEqual({ title: "out", toast: "out" });
    expect(log[1]!.new).toEqual({ title: "" });
    expect(container.querySelector("p")).toBeNull();
  });

  it("animates a keyed list: rows enter, exit and keep their names when they move", async () => {
    const log = transitions();
    const rows = signal(["a", "b", "c"]);
    mount(() => {
      const ul = el("ul");
      list(
        ul,
        null,
        () => rows(),
        (row: string) => named({ enter: "in", exit: "out" }, "li", row),
        (row: string) => row,
      );
      return ul;
    });
    const nameOf = (text: string): string =>
      [...container.querySelectorAll("li")]
        .find((li) => li.textContent === text)!
        .style.getPropertyValue("view-transition-name");
    const [a, b, c] = [nameOf("a"), nameOf("b"), nameOf("c")];
    await viewTransition(() => rows.set(["c", "a", "d"]));
    const d = nameOf("d");
    expect(nameOf("c")).toBe(c);
    expect(nameOf("a")).toBe(a);
    expect(log[0]!.old).toEqual({ [a]: "out", [b]: "out", [c]: "out" });
    // a and c moved (no class), b exited (old state only), d entered.
    expect(log[0]!.new).toEqual({ [a]: "", [c]: "", [d]: "in" });
    expect(container.textContent).toBe("cad");
  });

  it("leaves classes alone outside viewTransition()", () => {
    const open = signal(false);
    mount(() => () => (open() ? named({ name: "toast", enter: "in" }, "p", "toast") : null));
    open.set(true);
    flush();
    expect(capture()).toEqual({ toast: "" });
  });
});
