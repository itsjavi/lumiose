// @vitest-environment happy-dom
// `insertText` (TASK-90): a maybe-text child written into its template text node, with `insert`
// semantics as the fallback, and the server's `insertText` holes that hydration claims.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, onCleanup, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner } from "../core/internal.ts";
import {
  island,
  renderToString,
  insertText as serverText,
  ssr,
  text as serverTextHole,
} from "../server/index.ts";
import { insertText, template } from "./index.ts";
import { loadIslands } from "./islands.ts";

function root<T>(fn: () => T): [T, () => void] {
  const owner = createOwner(undefined);
  return [runWithOwner(owner, fn), () => disposeOwner(owner)];
}

// A text child between two elements, as the compiler emits it: a text node in the template.
const row = template(`<p><i>a</i> <i>b</i></p>`);
const bold = template(`<b>node</b>`);

function slot(): [HTMLElement, Text] {
  const el = row() as HTMLElement;
  // As compiled code walks (under hydration, it steps over server block content left in place).
  return [el, el.firstChild!.nextSibling as Text];
}

describe("insertText", () => {
  it("writes strings and numbers into the text node; nullish and booleans empty it", () => {
    for (const [value, data] of [
      ["x", "x"],
      [0, "0"],
      [2n, "2"],
      [null, ""],
      [undefined, ""],
      [true, ""],
    ] as [Renderable, string][]) {
      const [el, node] = slot();
      insertText(node, value);
      expect(el.childNodes[1]).toBe(node);
      expect(node.data).toBe(data);
      expect(el.childNodes).toHaveLength(3);
    }
  });

  it("binds a function once and writes each value into the same node", () => {
    const label = signal<string | number | null>("one");
    const [[el, node], dispose] = root(() => {
      const parts = slot();
      insertText(parts[1], () => label());
      return parts;
    });
    label.set(2);
    flush();
    expect(el.childNodes[1]).toBe(node);
    expect(node.data).toBe("2");
    label.set(null);
    flush();
    expect(el.innerHTML).toBe("<i>a</i><i>b</i>");
    dispose();
    label.set("after");
    flush();
    expect(node.data).toBe("");
  });

  it("falls back to insert semantics for nodes, arrays and nested functions", () => {
    const value = signal<Renderable>("text");
    const inner = signal("in");
    const cleaned: string[] = [];
    const [[el, node], dispose] = root(() => {
      const parts = slot();
      insertText(parts[1], () => value());
      return parts;
    });
    expect(el.innerHTML).toBe("<i>a</i>text<i>b</i>");

    const b = bold();
    value.set(b);
    flush();
    expect(el.innerHTML).toBe("<i>a</i><b>node</b><i>b</i>");
    expect(el.childNodes[2]).toBe(node);
    expect(node.data).toBe("");

    value.set(["x", b]);
    flush();
    expect(el.innerHTML).toBe("<i>a</i>x<b>node</b><i>b</i>");

    // A nested function is tracked on its own, and disposed with the value that rendered it.
    value.set(() => {
      onCleanup(() => cleaned.push("nested"));
      return inner();
    });
    flush();
    expect(el.innerHTML).toBe("<i>a</i>in<i>b</i>");
    inner.set("in2");
    flush();
    expect(el.innerHTML).toBe("<i>a</i>in2<i>b</i>");
    // Its re-run disposed the previous evaluation.
    expect(cleaned).toEqual(["nested"]);

    // Text after a fallback renders in the region; the text node stays empty.
    value.set("back");
    flush();
    expect(cleaned).toEqual(["nested", "nested"]);
    expect(el.innerHTML).toBe("<i>a</i>back<i>b</i>");
    expect(node.data).toBe("");
    dispose();
  });

  it("renders a static node in a region before the text node", () => {
    const [el, node] = slot();
    insertText(node, bold());
    expect(el.innerHTML).toBe("<i>a</i><b>node</b><i>b</i>");
    expect(el.childNodes[2]).toBe(node);
  });
});

describe("server insertText", () => {
  const parts = ["<p><i>a</i>", "<i>b</i></p>"];
  const page = (value: unknown) => renderToString(() => ssr(parts, serverText(value)));

  it("renders text like text(), and other values like insert()", async () => {
    expect(await page("<x>")).toBe("<p><i>a</i>&lt;x><i>b</i></p>");
    expect(await page(() => 3)).toBe("<p><i>a</i>3<i>b</i></p>");
    expect(await page(false)).toBe("<p><i>a</i><i>b</i></p>");
    expect(await page(ssr(["<b>node</b>"]))).toBe("<p><i>a</i><b>node</b><i>b</i></p>");
    expect(await page(["x", ssr(["<b>y</b>"])])).toBe("<p><i>a</i>x<b>y</b><i>b</i></p>");
    for (const value of ["t", 1, null, undefined, true]) {
      expect(await page(value)).toBe(await renderToString(() => ssr(parts, serverTextHole(value))));
    }
  });
});

describe("insertText hydration", () => {
  const live = signal<string>("live");
  const client = {
    Text(props: { value: unknown }) {
      const [el, node] = slot();
      insertText(node, props.value === "node" ? bold() : (props.value as Renderable));
      return el;
    },
    Live() {
      const [el, node] = slot();
      insertText(node, () => live());
      return el;
    },
  };
  const parts = ["<p><i>a</i>", "<i>b</i></p>"];
  const server = {
    Text: (props: { value: unknown }) =>
      ssr(parts, serverText(props.value === "node" ? ssr(["<b>node</b>"]) : props.value)),
    Live: () =>
      ssr(
        parts,
        serverText(() => live()),
      ),
  };

  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    document.body.textContent = "";
  });

  async function hydrate(name: "Text" | "Live", props: { value?: unknown }): Promise<HTMLElement> {
    document.body.innerHTML = await renderToString(() =>
      island(`/src/case#${name}`, server[name], props as { value: unknown }, "load"),
    );
    const p = document.querySelector("p")!;
    loadIslands({ [`/src/case#${name}`]: () => Promise.resolve(client[name]) });
    for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
    expect(document.querySelector("p")).toBe(p);
    return p;
  }

  it("claims the server's text, or an empty text node where it rendered none", async () => {
    for (const [value, html] of [
      ["word", "<i>a</i>word<i>b</i>"],
      [7, "<i>a</i>7<i>b</i>"],
      [null, "<i>a</i><i>b</i>"],
    ] as [unknown, string][]) {
      document.body.innerHTML = await renderToString(() =>
        island("/src/case#Text", server.Text, { value }, "load"),
      );
      const p = document.querySelector("p")!;
      const text = p.childNodes[1];
      loadIslands({ "/src/case#Text": () => Promise.resolve(client.Text) });
      for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
      expect(document.querySelector("p")).toBe(p);
      expect(p.innerHTML).toBe(html);
      if (value !== null) expect(p.childNodes[1]).toBe(text);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("claims the server's block for a fallback value", async () => {
    document.body.innerHTML = await renderToString(() =>
      island("/src/case#Text", server.Text, { value: "node" }, "load"),
    );
    const p = document.querySelector("p")!;
    const b = p.querySelector("b")!;
    expect(p.innerHTML).toBe("<i>a</i><!--[--><b>node</b><!--]--><i>b</i>");
    loadIslands({ "/src/case#Text": () => Promise.resolve(client.Text) });
    for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
    expect(document.querySelector("p")).toBe(p);
    expect(p.querySelector("b")).toBe(b);
    expect(p.innerHTML).toBe("<i>a</i><b>node</b><i>b</i>");
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the claimed text node live", async () => {
    const p = await hydrate("Live", {});
    const text = p.childNodes[1] as Text;
    expect(text.data).toBe("live");
    live.set("updated");
    flush();
    expect(p.childNodes[1]).toBe(text);
    expect(text.data).toBe("updated");
    expect(warn).not.toHaveBeenCalled();
  });
});
