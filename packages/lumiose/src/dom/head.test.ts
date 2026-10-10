// @vitest-environment happy-dom
// Client <Title>, <Meta> and <Head> (spec §8 Document): document.head stays current across SPA
// navigations, with the server's precedence rules.
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, signal } from "../core/index.ts";
import { createComponent, render as renderRoot, template } from "./index.ts";
import { Head, Meta, Title } from "./head.ts";

const disposers: (() => void)[] = [];

function render(code: () => Renderable): () => void {
  const dispose = renderRoot(code, document.createElement("div"));
  disposers.push(dispose);
  return dispose;
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
  document.head.textContent = "";
  document.title = "";
});

function Layout(props: { children?: Renderable }): Renderable {
  return [createComponent(Title, { children: "Site" }), () => props.children];
}

describe("Title", () => {
  it("lets the deepest title win, tracks changes and restores the previous one on disposal", () => {
    const name = signal("Ada");
    const dispose = render(() =>
      createComponent(Layout, {
        get children() {
          return createComponent(Title, {
            get children() {
              return ["Profile of ", name()];
            },
          });
        },
      }),
    );
    expect(document.title).toBe("Profile of Ada");
    name.set("Bob");
    flush();
    expect(document.title).toBe("Profile of Bob");
    const other = render(() => createComponent(Title, { children: "Other" }));
    // Shallower than the page title: the page still wins.
    expect(document.title).toBe("Profile of Bob");
    dispose();
    expect(document.title).toBe("Other");
    other();
  });
});

describe("Meta", () => {
  it("dedupes by key, lets the deepest win, and adopts a tag rendered by the server", () => {
    document.head.innerHTML = `<meta name="description" content="from server"><meta charset="utf-8">`;
    const server = document.head.firstElementChild;
    const page = signal("page");
    const dispose = render(() => [
      createComponent(Meta, { name: "description", content: "layout" }),
      createComponent(Layout, {
        get children() {
          return createComponent(Meta, {
            name: "description",
            get content() {
              return page();
            },
          });
        },
      }),
    ]);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.firstElementChild).toBe(server);
    expect(server!.getAttribute("content")).toBe("page");
    page.set("updated");
    flush();
    expect(server!.getAttribute("content")).toBe("updated");
    dispose();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector("meta[charset]")).not.toBeNull();
  });
});

describe("Head", () => {
  it("appends its children to <head>, skips duplicates of existing tags, and removes them on disposal", () => {
    document.head.innerHTML = `<link rel="canonical" href="/page">`;
    const dispose = render(() =>
      createComponent(Head, {
        get children() {
          return [
            template(`<link rel="canonical" href="/page">`)(),
            template(`<link rel="alternate" href="/feed.xml">`)(),
          ];
        },
      }),
    );
    expect(document.head.querySelectorAll("link")).toHaveLength(2);
    expect(document.head.querySelector('link[rel="alternate"]')).not.toBeNull();
    dispose();
    expect(document.head.innerHTML).toBe(`<link rel="canonical" href="/page">`);
  });
});
