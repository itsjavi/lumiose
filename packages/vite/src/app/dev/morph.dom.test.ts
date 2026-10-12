// @vitest-environment happy-dom
// The in-place patch of `lumiose dev` after server-only edits (TASK-148, ./morph.ts): pages are
// loaded into the document as the server sent them (with their dev annotation), changed as the
// browser and the user would, then patched with a fresh copy.
import { describe, expect, it } from "vitest";
import { devAnnotation } from "./annotation.ts";
import { MorphError, patchPage, type ServerElements } from "./morph.ts";
import { serverElements } from "./morph.ts";

interface PageOptions {
  head?: string;
  html?: string;
  body?: string;
  method?: string;
  status?: number;
  errors?: boolean;
}

/** A page as the dev server sends it: the HTML, then its dev annotation. */
function page(body: string, options: PageOptions = {}): string {
  const html =
    `<!doctype html><html${options.html ?? ' lang="en"'}><head><meta charset="utf-8">` +
    `<title>Page</title>${options.head ?? ""}</head><body${options.body ?? ""}>${body}</body></html>`;
  return (
    html +
    devAnnotation(html, {
      method: options.method ?? "GET",
      status: options.status ?? 200,
      errors: options.errors ?? false,
    })
  );
}

/** Loads `html` into the document; its elements are the server's. */
function load(html: string): ServerElements {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const [from, to] of [
    [parsed.documentElement, document.documentElement],
    [parsed.body, document.body],
  ] as const) {
    for (const attr of Array.from(to.attributes)) to.removeAttribute(attr.name);
    for (const attr of from.attributes) to.setAttribute(attr.name, attr.value);
  }
  document.head.replaceChildren(
    ...[...parsed.head.childNodes].map((n) => document.importNode(n, true)),
  );
  document.body.replaceChildren(
    ...[...parsed.body.childNodes].map((n) => document.importNode(n, true)),
  );
  return serverElements(document);
}

function patch(html: string, server: ServerElements, init: ResponseInit = {}): Promise<boolean> {
  const response = new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
  return patchPage(document, response, server, { stylesheetTimeout: 20 });
}

// The pages' stylesheets and scripts stay unloaded (happy-dom runs no scripts by default).
const settings = (window as unknown as { happyDOM?: { settings: Record<string, unknown> } })
  .happyDOM?.settings;
if (settings !== undefined) {
  settings.disableCSSFileLoading = true;
  settings.handleDisabledFileLoadingAsSuccess = true;
}

const $ = <T extends Element = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;

const RECORDS = (props: object) =>
  `<script type="application/json" data-l-islands>${JSON.stringify([
    { id: 0, ref: "/src/Counter.stsx#Counter", strategy: "load", props },
  ])}</script>`;
const COUNTER = "<!--l:0--><button>3</button><!--/l:0-->";

const devLink = (file: string) =>
  `<link rel="stylesheet" href="/src/${file}" data-vite-dev-id="/repo/src/${file}">`;
const form = (value: string) =>
  `<form><label>Name</label><input name="name" value="${value}"><input type="checkbox" name="ok"><textarea name="note">${value}</textarea></form>`;

/** The island range's nodes, as hydration left them. */
function islandNodes(): Node[] {
  const start = [...document.body.querySelectorAll("*"), document.body]
    .flatMap((el) => [...el.childNodes])
    .find((node) => node.nodeType === 8 && (node as Comment).data === "l:0")!;
  const nodes: Node[] = [start];
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    nodes.push(node);
    if (node.nodeType === 8 && (node as Comment).data === "/l:0") break;
  }
  return nodes;
}

describe("patching the page in place", () => {
  it("updates text and attributes, keeping the nodes", async () => {
    const server = load(page('<main><h1 class="a">Old</h1><p>Same</p></main>'));
    const [h1, p] = [$("h1"), $("p")];
    expect(
      await patch(page('<main><h1 class="b" data-x="1">New</h1><p>Same</p></main>'), server),
    ).toBe(true);
    expect($("main").outerHTML).toBe('<main><h1 class="b" data-x="1">New</h1><p>Same</p></main>');
    expect($("h1")).toBe(h1);
    expect($("p")).toBe(p);
  });

  it("patches lists: insertions, removals and keyed moves", async () => {
    const server = load(
      page("<ul><li>a</li><li>b</li></ul><ol><li id=x>x</li><li id=y>y</li></ol>"),
    );
    const [x, y] = [$("#x"), $("#y")];
    const next =
      "<ul><li>a</li><li>new</li><li>b</li><li>c</li></ul><ol><li id=y>y!</li><li id=x>x</li></ol>";
    expect(await patch(page(next), server)).toBe(true);
    expect($("ul").outerHTML).toBe("<ul><li>a</li><li>new</li><li>b</li><li>c</li></ul>");
    expect($("ol").outerHTML).toBe('<ol><li id="y">y!</li><li id="x">x</li></ol>');
    expect([$("#x"), $("#y")]).toEqual([x, y]);

    expect(await patch(page("<ul><li>c</li></ul><ol></ol>"), server)).toBe(true);
    expect(document.body.innerHTML).toMatch(/^<ul><li>c<\/li><\/ul><ol><\/ol>/);
  });

  it("inserts a new sibling instead of reusing its neighbour of another class", async () => {
    const server = load(page('<div class="form"><input name="q"></div>'));
    const wrapper = $("div.form");
    $<HTMLInputElement>("input").value = "typed";
    expect(
      await patch(
        page('<div class="banner">Hi</div><div class="form"><input name="q"></div>'),
        server,
      ),
    ).toBe(true);
    expect($("div.form")).toBe(wrapper);
    expect($<HTMLInputElement>("input").value).toBe("typed");
    expect($("div.banner").textContent).toBe("Hi");
  });

  it("keeps islands' DOM, state and hydration markers, wherever they move", async () => {
    const server = load(page(`<main><h1>Old</h1>${COUNTER}</main>${RECORDS({ start: 3 })}`));
    // Hydrated, then clicked: the island's own state.
    const before = islandNodes();
    $("button").textContent = "4";
    (before[1] as { $$state?: number }).$$state = 1;

    expect(
      await patch(page(`<main><h1>New</h1>${COUNTER}</main>${RECORDS({ start: 3 })}`), server),
    ).toBe(true);
    expect($("h1").textContent).toBe("New");
    expect(islandNodes()).toEqual(before);
    expect(islandNodes()[0]).toBe(before[0]);
    expect($("button").textContent).toBe("4");

    // Into a new wrapper, after a new heading.
    const moved = `<main><h2>Intro</h2><section class="box">${COUNTER}</section></main>${RECORDS({ start: 3 })}`;
    expect(await patch(page(moved), server)).toBe(true);
    const after = islandNodes();
    expect(after.every((node, i) => node === before[i])).toBe(true);
    expect(after[0]!.parentNode).toBe($("section.box"));
    expect($("main").innerHTML).toBe(
      '<h2>Intro</h2><section class="box"><!--l:0--><button>4</button><!--/l:0--></section>',
    );
  });

  it("reloads when an island's props or slots changed", async () => {
    const server = load(page(`${COUNTER}${RECORDS({ start: 3 })}`));
    expect(await patch(page(`${COUNTER}${RECORDS({ start: 4 })}`), server)).toBe(false);

    const slot = (text: string) =>
      `<!--l:0--><div><!--l:s:children--><p>${text}</p><!--/l:s--></div><!--/l:0-->` +
      RECORDS({ start: 3 }).replace('"props"', '"slots":["children"],"props"');
    const other = load(page(`<h1>A</h1>${slot("one")}`));
    expect(await patch(page(`<h1>B</h1>${slot("one")}`), other)).toBe(true);
    expect(await patch(page(`<h1>B</h1>${slot("two")}`), other)).toBe(false);
  });

  it("patches the head: title, meta and stylesheets, keeping Vite's", async () => {
    const server = load(
      page("<p>x</p>", {
        head: `<meta name="description" content="old">${devLink("a.css")}${devLink("b.css")}`,
      }),
    );
    // Vite's `<style>` of a CSS import, and its hot-updated copy of a stylesheet link.
    const viteStyle = document.createElement("style");
    viteStyle.setAttribute("data-vite-dev-id", "/repo/src/island.css");
    document.head.append(viteStyle);
    const hotLink = $("link").cloneNode() as HTMLLinkElement;
    hotLink.href = "/src/a.css?t=1";
    $("link").replaceWith(hotLink);

    const next = page("<p>y</p>", {
      head: `<meta name="description" content="new">${devLink("a.css")}${devLink("c.css")}`,
    });
    expect(await patch(next.replace("<title>Page</title>", "<title>Edited</title>"), server)).toBe(
      true,
    );
    expect(document.title).toBe("Edited");
    expect($('meta[name="description"]').getAttribute("content")).toBe("new");
    const links = [...document.head.querySelectorAll("link")].map((l) => l.getAttribute("href"));
    expect(links).toEqual(["/src/a.css?t=1", "/src/c.css"]);
    expect(viteStyle.isConnected).toBe(true);
    expect($("p").textContent).toBe("y");
  });

  it("keeps elements client code added, focus and form input", async () => {
    const server = load(page(form("a")));
    const [input, box, note] = [
      $<HTMLInputElement>('input[name="name"]'),
      $<HTMLInputElement>('input[name="ok"]'),
      $<HTMLTextAreaElement>("textarea"),
    ];
    input.value = "typed";
    box.checked = true;
    note.value = "notes";
    input.focus();
    const portal = Object.defineProperty(document.createElement("div"), "$$host", { value: null });
    const toast = document.createElement("aside");
    document.body.append(portal, toast);

    expect(await patch(page(form("b").replace("Name", "Your name")), server)).toBe(true);
    expect($("label").textContent).toBe("Your name");
    expect($('input[name="name"]')).toBe(input);
    expect(input.getAttribute("value")).toBe("b");
    expect([input.value, box.checked, note.value]).toEqual(["typed", true, "notes"]);
    expect(document.activeElement).toBe(input);
    expect([portal.isConnected, toast.isConnected]).toEqual([true, true]);
  });

  it("restores the focus of a moved element", async () => {
    const server = load(page('<p id="p">Text</p><input id="i">'));
    const input = $<HTMLInputElement>("#i");
    input.value = "abc";
    input.focus();
    input.setSelectionRange(1, 2);
    expect(await patch(page('<input id="i"><p id="p">Text</p>'), server)).toBe(true);
    expect(document.body.firstElementChild).toBe(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2]);
  });

  it("resolves streamed boundaries of the fresh page", async () => {
    const server = load(page('<main><p class="slow">old</p></main>'));
    const streamed =
      '<main><?start name="lb0"><p class="fallback">Loading</p><?end></main>' +
      '<template for="lb0"><p class="slow">done</p></template><script>$swap("lb0")</script>';
    expect(await patch(page(streamed), server)).toBe(true);
    expect($("main").innerHTML).toBe('<p class="slow">done</p>');
    expect(document.querySelector("template")).toBeNull();
  });
});

describe("falling back to a reload", () => {
  it("when the document's attributes or scripts changed", async () => {
    const server = load(page("<p>x</p>"));
    expect(await patch(page("<p>y</p>", { html: ' lang="es"' }), server)).toBe(false);
    expect(await patch(page("<p>y</p>", { body: ' class="dark"' }), server)).toBe(false);
    expect(
      await patch(
        page("<p>y</p>", { head: '<script type="module" src="/x.ts"></script>' }),
        server,
      ),
    ).toBe(false);
    expect(await patch(page("<p>y</p><script>track()</script>"), server)).toBe(false);
    // JSON data is patched like any element.
    expect(
      await patch(page('<p>y</p><script type="application/ld+json">{}</script>'), server),
    ).toBe(true);
    expect($("p").textContent).toBe("y");
  });

  it("for other statuses, non-HTML responses, redirects, errors and posted pages", async () => {
    const server = load(page("<p>x</p>"));
    expect(await patch(page("<p>y</p>", { status: 404 }), server, { status: 404 })).toBe(false);
    expect(await patch("{}", server, { headers: { "content-type": "application/json" } })).toBe(
      false,
    );
    expect(await patch(page("<p>y</p>", { errors: true }), server)).toBe(false);
    const redirected = Object.defineProperty(
      new Response(page("<p>y</p>"), { headers: { "content-type": "text/html" } }),
      "redirected",
      { value: true },
    );
    expect(await patchPage(document, redirected, server)).toBe(false);
    expect($("p").textContent).toBe("x");

    const posted = load(page("<p>x</p>", { method: "POST" }));
    expect(await patch(page("<p>y</p>"), posted)).toBe(false);
    const overlay = load(page("<p>x</p>"));
    document.body.append(document.createElement("vite-error-overlay"));
    expect(await patch(page("<p>y</p>"), overlay)).toBe(false);
  });

  it("when an island's range is broken", async () => {
    const server = load(page(`${COUNTER}${RECORDS({ start: 3 })}`));
    // Same records, so the patch starts, then finds no end comment.
    const broken = page(`<!--l:0--><button>3</button>${RECORDS({ start: 3 })}`);
    await expect(patch(broken, server)).rejects.toBeInstanceOf(MorphError);
  });
});
