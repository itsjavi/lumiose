// @vitest-environment happy-dom
// Head defaults (TASK-238): the `<title>` and `<meta>` tags a document writes in its `<head>` are
// replaced by the page's `<Title>` and `<Meta>` with the same key, so the page has one of each, on
// the server and after SPA navigations, where the defaults come back on pages without them
// (TASK-256). (End-to-end SSR and streaming: server-renderer.test.ts.)
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../../contract/client.ts";
import { Meta, Title } from "../../dom/head.ts";
import { hydrate } from "../../dom/hydrate.ts";
import { createComponent, render } from "../../dom/index.ts";
import * as server from "../../server/index.ts";
import { Meta as ServerMeta, Suspense, Title as ServerTitle } from "../../server/components.ts";
import { BODY_SLOT, documentBody, documentParts, HEAD_SLOT } from "./document.ts";
import { createServerRenderer } from "./render.ts";

/** A custom document's shell: `head` around the head slot, `body` before the body slot. */
const shell = (head: string, body = "<main></main>") =>
  `<html lang="en"><head>${head}</head><body>${body}${BODY_SLOT}</body></html>`;

function page(shellBody: string, head: string, custom = true): string {
  const { before, after } = documentParts(shellBody, head, custom);
  return before + after;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };

/** The attribute a page's tag gets when it replaces the default `html` (TASK-256). */
const replacing = (html: string) =>
  ` data-l-default='${html.replace(/[&'<>]/g, (char) => ESCAPES[char]!)}'`;

describe("head defaults", () => {
  it("the default document's charset and viewport give way to the page's, in place", () => {
    expect(
      page("<p>x</p>", '<title>Page</title><meta name="viewport" content="width=1000">', false),
    ).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1000"' +
        replacing('<meta name="viewport" content="width=device-width, initial-scale=1">') +
        "><title>Page</title></head><body><p>x</p></body></html>",
    );
  });

  it("a page's title and metas replace the custom document's, in place; the rest stays", () => {
    const document = shell(
      '<meta charset="utf-8"><title>Site</title><meta name="description" content="Site">' +
        `<meta name="color-scheme" content="light dark">${HEAD_SLOT}<link rel="icon" href="/i.svg">`,
    );
    const head =
      '<title>About</title><meta name="description" content="About us">' +
      '<meta property="og:title" content="About"><link rel="stylesheet" href="/a.css">';
    expect(page(document, head)).toBe(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title${replacing("<title>Site</title>")}>About</title>` +
        `<meta name="description" content="About us"${replacing('<meta name="description" content="Site">')}>` +
        '<meta name="color-scheme" content="light dark">' +
        '<meta property="og:title" content="About"><link rel="stylesheet" href="/a.css">' +
        '<link rel="icon" href="/i.svg"></head><body><main></main></body></html>',
    );
  });

  it("keys metas by charset, name, property, http-equiv or itemprop; unkeyed metas stay", () => {
    const document = shell(
      '<meta charset="utf-8"><meta property="og:type" content="website">' +
        '<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta itemprop="name" content="Site">' +
        `<meta name="robots" content="all"><meta content="unkeyed">${HEAD_SLOT}`,
    );
    const head =
      '<meta charset="latin1"><meta PROPERTY=\'og:type\' content="article">' +
      '<meta http-equiv="X-UA-Compatible" content="IE=11"><meta itemprop="name" content="Page">' +
      '<meta name="googlebot" content="none"><meta content="unkeyed">';
    expect(page(document, head)).toBe(
      `<!doctype html><html lang="en"><head><meta charset="latin1"${replacing('<meta charset="utf-8">')}>` +
        `<meta PROPERTY='og:type' content="article"${replacing('<meta property="og:type" content="website">')}>` +
        `<meta http-equiv="X-UA-Compatible" content="IE=11"${replacing('<meta http-equiv="X-UA-Compatible" content="IE=edge">')}>` +
        `<meta itemprop="name" content="Page"${replacing('<meta itemprop="name" content="Site">')}>` +
        '<meta name="robots" content="all"><meta content="unkeyed">' +
        '<meta name="googlebot" content="none"><meta content="unkeyed">' +
        "</head><body><main></main></body></html>",
    );
  });

  it("only the tags of the document's <head> are defaults, not scripts, comments or the body", () => {
    const script = `<script>t = '<title>x</title><meta name="description" content="s">';</script>`;
    const comment = '<!-- <meta name="description" content="c"> -->';
    const document = shell(
      `${script}${comment}<meta name="description" content="a > b">${HEAD_SLOT}`,
      "<svg><title>Icon</title></svg>",
    );
    expect(page(document, '<title>Page</title><meta name="description" content="Page">')).toBe(
      `<!doctype html><html lang="en"><head>${script}${comment}<meta name="description" content="Page" ` +
        `data-l-default='&lt;meta name="description" content="a &gt; b"&gt;'>` +
        "<title>Page</title></head><body><svg><title>Icon</title></svg></body></html>",
    );
  });

  it("keeps one tag when the document repeats a default", () => {
    const document = shell(
      `<meta name="description" content="a"><meta name="description" content="b">${HEAD_SLOT}`,
    );
    expect(page(document, '<meta name="description" content="Page">')).toBe(
      '<!doctype html><html lang="en"><head><meta name="description" content="Page"' +
        replacing('<meta name="description" content="a">') +
        "></head><body><main></main></body></html>",
    );
  });

  it("leaves the document as is when the page sets nothing it has", () => {
    const document = shell(
      `<title>Site</title><meta name="description" content="Site">${HEAD_SLOT}`,
    );
    expect(page(document, '<meta name="robots" content="none">')).toBe(
      '<!doctype html><html lang="en"><head><title>Site</title><meta name="description" content="Site">' +
        '<meta name="robots" content="none"></head><body><main></main></body></html>',
    );
  });
});

// --- Server responses ----------------------------------------------------------------------------

// Hand-compiled server components (contract doc-2 §5).
function PlainDocument(props: any) {
  return server.ssr(
    [
      '<html lang="en"><head><meta charset="utf-8"><title>Site</title>' +
        '<meta name="description" content="Site">',
      '<link rel="icon" href="/i.svg"></head><body>',
      "</body></html>",
    ],
    server.insert(props.head),
    server.insert(props.body),
  );
}

async function Late() {
  try {
    (await server.$await(() => new Promise((resolve) => setTimeout(resolve, 1)), 0))();
    return server.ssr(["<p>late</p>"]);
  } finally {
    server.$leave();
  }
}

/** A page with a title and a description, and optionally a streamed boundary. */
const about = (streamed: boolean) => () =>
  server.ssr(
    ["", "", "<h1>About</h1>", ""],
    server.createComponent(ServerTitle, { children: "About" }),
    server.createComponent(ServerMeta, { name: "description", content: "About us" }),
    streamed
      ? server.createComponent(Suspense, {
          fallback: server.ssr(["<p>loading</p>"]),
          get children() {
            return server.createComponent(Late, {});
          },
        })
      : "",
  );

/** Renders a page as the handler does, inside `document` (the default one when undefined). */
// Server components return SSR output, not client `Renderable`s: typed loosely, as in the handler.
async function serve(root: any, document?: any) {
  const rendered = await createServerRenderer()(
    { layouts: [], page: root, props: {}, params: {}, document },
    {
      request: new Request("https://lumiose.test/"),
      signal: new AbortController().signal,
      resolveAll: false,
    },
  );
  const parts = documentParts(rendered.body, rendered.head, document !== undefined);
  const body = documentBody(parts, rendered.stream, (error) => {
    throw error;
  });
  return typeof body === "string" ? body : new Response(body).text();
}

const viewport = () =>
  server.createComponent(ServerMeta, { name: "viewport", content: "width=1000" });

describe("head defaults in server responses", () => {
  const HEAD =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title${replacing("<title>Site</title>")}>About</title>` +
    `<meta name="description" content="About us"${replacing('<meta name="description" content="Site">')}>` +
    '<link rel="icon" href="/i.svg"></head><body>';

  it("a complete response has one title and one description", async () => {
    expect(await serve(about(false), PlainDocument)).toBe(`${HEAD}<h1>About</h1></body></html>`);
  });

  it("a streamed response has one title and one description", async () => {
    const html = await serve(about(true), PlainDocument);
    expect(html.startsWith(`${HEAD}<h1>About</h1><?start name="lb0"><p>loading</p><?end>`)).toBe(
      true,
    );
    expect(html).toContain('<template for="lb0"><p>late</p></template>');
    expect(html.match(/<title\b/g)).toHaveLength(1);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
  });

  it("the default document's viewport gives way to the page's", async () => {
    expect(await serve(viewport)).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1000"' +
        replacing('<meta name="viewport" content="width=device-width, initial-scale=1">') +
        "></head><body></body></html>",
    );
  });
});

// --- SPA navigations -----------------------------------------------------------------------------

const SPA_DOCUMENT = shell(
  '<meta charset="utf-8"><title>Site</title><meta name="description" content="Site">' + HEAD_SLOT,
);
const disposers: (() => void)[] = [];

/** Loads the server's `<head>` for a page whose collected head is `head`. */
function serverRender(head: string) {
  const html = page(SPA_DOCUMENT, head);
  document.head.innerHTML = new DOMParser().parseFromString(html, "text/html").head.innerHTML;
}

/**
 * Renders a client page with an optional title and description, hydrated (the first page) or
 * client-rendered (after a navigation); returns its disposer.
 */
function clientPage(title?: string, description?: string, hydrated = false): () => void {
  const code = (): Renderable => {
    const out: Renderable[] = [];
    if (title !== undefined) out.push(createComponent(Title, { children: title }));
    if (description !== undefined) {
      out.push(createComponent(Meta, { name: "description", content: description }));
    }
    return out;
  };
  const host = document.createElement("div");
  host.innerHTML = "<!--l:0--><!--/l:0-->";
  const dispose = hydrated
    ? hydrate(code, {}, host.firstChild!, host.lastChild!)
    : render(code, host);
  disposers.push(dispose);
  return dispose;
}

/** One title, one description (or none), in the document's order. */
function expectHead(title: string, description: string | undefined) {
  expect(document.head.querySelectorAll("title")).toHaveLength(1);
  expect(document.title).toBe(title);
  const metas = document.head.querySelectorAll('meta[name="description"]');
  expect(metas).toHaveLength(description === undefined ? 0 : 1);
  if (description !== undefined) expect(metas[0]!.getAttribute("content")).toBe(description);
  expect(Array.from(document.head.children, (el) => el.localName)).toEqual(
    ["meta", "title", "meta"].slice(0, description === undefined ? 2 : 3),
  );
}

describe("head defaults after SPA navigations", () => {
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    document.title = "";
    document.head.textContent = "";
  });

  it("a server page that replaced the defaults: they come back on pages without them", () => {
    serverRender('<title>A</title><meta name="description" content="A">');
    expectHead("A", "A");
    const a = clientPage("A", "A", true);
    expectHead("A", "A");
    // The next page mounts before the previous one is disposed, as with the router.
    const b = clientPage("B");
    a();
    expectHead("B", "Site");
    const c = clientPage(undefined, "C");
    b();
    expectHead("Site", "C");
    clientPage();
    c();
    expectHead("Site", "Site");
  });

  it("a server page that kept the defaults: the next page's tags take them over, then give them back", () => {
    serverRender("");
    expectHead("Site", "Site");
    const a = clientPage(undefined, undefined, true);
    expectHead("Site", "Site");
    const b = clientPage("B", "B");
    a();
    expectHead("B", "B");
    clientPage();
    b();
    expectHead("Site", "Site");
  });
});
