// @vitest-environment happy-dom
// Client <Title>, <Meta> and <Head> (spec §8 Document): document.head stays current across SPA
// navigations, with the server's precedence rules.
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, signal } from "../core/index.ts";
import { createComponent, render as renderRoot, template } from "./index.ts";
import { Head, Meta, Title } from "./head.ts";
import { hydrate } from "./hydrate.ts";

const disposers: (() => void)[] = [];

function render(code: () => Renderable): () => void {
  const dispose = renderRoot(code, document.createElement("div"));
  disposers.push(dispose);
  return dispose;
}

/** Hydrates `code` as an island whose server HTML rendered nothing in the body. */
function hydrateIsland(code: () => Renderable): () => void {
  const host = document.createElement("div");
  host.innerHTML = "<!--l:0--><!--/l:0-->";
  const dispose = hydrate(code, {}, host.firstChild!, host.lastChild!);
  disposers.push(dispose);
  return dispose;
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
  // Setting the title creates a `<title>`: cleared with the rest.
  document.title = "";
  document.head.textContent = "";
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
    // Adopted outside hydration, the server's tag was a default: it comes back.
    expect(Array.from(document.head.querySelectorAll("meta"), (el) => el.outerHTML)).toEqual([
      `<meta name="description" content="from server">`,
      `<meta charset="utf-8">`,
    ]);
  });

  it("removes a tag it created", () => {
    const dispose = render(() => createComponent(Meta, { name: "robots", content: "none" }));
    expect(document.head.innerHTML).toBe(`<meta name="robots" content="none">`);
    dispose();
    expect(document.head.innerHTML).toBe("");
  });
});

describe("defaults (TASK-256)", () => {
  it("the title before the first <Title> comes back when the last one goes", () => {
    document.title = "Site";
    const dispose = render(() => createComponent(Title, { children: "Page" }));
    expect(document.title).toBe("Page");
    dispose();
    expect(document.title).toBe("Site");
  });

  it("while hydrating, a page's tags are its own: the defaults they replaced come back", () => {
    document.head.innerHTML =
      `<title data-l-default="&lt;title&gt;Tom &amp;amp; Jerry&lt;/title&gt;">Page</title>` +
      `<meta name="description" content="Page" data-l-default='&lt;meta name="description" content="Site"&gt;'>` +
      `<meta name="robots" content="none">`;
    const dispose = hydrateIsland(() => [
      createComponent(Title, { children: "Page" }),
      createComponent(Meta, { name: "description", content: "Page" }),
      createComponent(Meta, { name: "robots", content: "none" }),
    ]);
    expect(document.head.querySelectorAll("meta")).toHaveLength(2);
    expect(document.head.querySelector("meta[data-l-default]")).toBeNull();
    dispose();
    expect(document.title).toBe("Tom & Jerry");
    // The description's default is back in place; the robots tag had none.
    expect(document.head.querySelectorAll("meta")).toHaveLength(1);
    expect(document.head.lastElementChild!.outerHTML).toBe(
      `<meta name="description" content="Site">`,
    );
  });

  it("while hydrating, a page without a default title leaves none", () => {
    document.head.innerHTML = `<title>Page</title>`;
    hydrateIsland(() => createComponent(Title, { children: "Page" }))();
    expect(document.title).toBe("");
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

  it("while hydrating, keeps the server's element in place and removes it on disposal (TASK-263)", () => {
    // A layout and a page both rendered the same link; the server wrote it twice.
    const link = `<link rel="preconnect" href="https://cdn.example">`;
    document.head.innerHTML = `${link}<meta charset="utf-8">${link}`;
    const [first, second] = Array.from(document.head.querySelectorAll("link"));
    const component = () =>
      createComponent(Head, {
        get children() {
          return template(link)();
        },
      });
    const layout = hydrateIsland(component);
    const page = hydrateIsland(component);
    // Each took one of the server's, without adding its own.
    expect(Array.from(document.head.children)).toEqual([
      first,
      document.head.querySelector("meta"),
      second,
    ]);
    page();
    expect(document.head.innerHTML).toBe(`${link}<meta charset="utf-8">`);
    layout();
    expect(document.head.innerHTML).toBe(`<meta charset="utf-8">`);
  });
});
