// @vitest-environment happy-dom
// `.md` and `.html` components (./content.ts, `contentSource`) rendered by the real runtimes:
// the client render (static template, verbatim template content), the same markup on the server,
// and the scripts, a client script (`?client`) that pages load without the island runtime.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile, contentSource } from "@lumiose/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createComponent, render } from "lumiose/internal/dom/index.ts";
import { renderToStream, renderToString } from "lumiose/internal/server/index.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "../../lumiose/src");
const IMPORTS = {
  client: { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
// Compiled modules go to packages/vite/test/out (ignored), inside the Vite root.
const out = resolve(import.meta.dirname, "../test/out/content");
mkdirSync(out, { recursive: true });

const POST = `---
title: Post
---
# Hello *world*

| a | b |
|---|---|
| 1 | 2 |

- [x] done

<style>h1 { color: red; }</style>
`;

const CARD = `<template id="tpl"><style>:host { display: block; }</style><slot></slot></template>
<user-card data-x="1" @click="go()">Ada <b>Lovelace</b></user-card>
<section><p>nested</p><style>p { margin: 0; }</style></section>
<script type="module">globalThis.cardScriptRan = true;</script>
`;

type Module = Record<string, any>;
type Target = "client" | "server";
let counter = 0;

function write(code: string, target: Target, name: string): string {
  for (const [specifier, file] of Object.entries(IMPORTS[target])) {
    code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
  }
  const path = join(out, `${name}-${counter++}-${Date.now()}.${target}.js`);
  writeFileSync(path, code);
  return path;
}

/** The component module of a content file, its own imports replaced by stubs. */
async function load(target: Target, text: string, name: string): Promise<Module> {
  const kind = name.endsWith(".md") ? "md" : "html";
  const { code } = contentSource(text, `/src/${name}`, kind);
  const frontmatter = write(`export const frontmatter = {};\n`, target, "frontmatter");
  // The `?client` module of each environment (../client-scripts.ts): in the client it runs the
  // scripts; on the server its call records the scripts' URL for the page.
  const record = JSON.stringify(join(src, "server/client-script.ts"));
  const script = write(
    target === "client"
      ? `globalThis.cardScriptRan = true;\nexport default function clientScript() {}\n`
      : `import { clientScript as record } from ${record};\nexport default function clientScript() { record("/src/${name}?lumiose-script"); }\n`,
    target,
    "script",
  );
  const source = code
    .replace(`"./${name}?lumiose-frontmatter"`, JSON.stringify(frontmatter))
    .replace(`"./${name}?lumiose-script?client"`, JSON.stringify(script));
  const result = compile(source, `/src/${name}.stsx`, {
    target,
    styleImport: false,
    sourceMap: false,
  });
  expect(result.diagnostics).toEqual([]);
  return (await import(/* @vite-ignore */ write(result.code, target, "content"))) as Module;
}

/** Inner HTML without the client's placeholder comments. */
function markup(root: Element): string {
  return root.innerHTML.replaceAll("<!---->", "");
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  document.body.innerHTML = "";
  delete (globalThis as Record<string, unknown>).cardScriptRan;
});
afterEach(() => warn.mockRestore());

describe("content components", () => {
  it("render Markdown on the client", async () => {
    const { default: Post } = await load("client", POST, "post.md");
    render(() => createComponent(Post, {}), document.body);
    const h1 = document.querySelector("h1")!;
    expect(h1.id).toBe("hello-world");
    expect(h1.textContent).toBe("Hello world");
    expect(h1.querySelector("em")!.textContent).toBe("world");
    expect(document.querySelector("td")!.textContent).toBe("1");
    expect((document.querySelector("input") as HTMLInputElement).checked).toBe(true);
    // Scoped by the file's block.
    expect([...h1.attributes].some((a) => a.name.startsWith("data-lum-"))).toBe(true);
    expect(document.querySelector("style")).toBeNull();
  });

  it("render HTML on the client, with the template's content verbatim", async () => {
    const { default: Card } = await load("client", CARD, "card.html");
    render(() => createComponent(Card, {}), document.body);
    const template = document.querySelector("template")!;
    expect(template.content.querySelector("style")!.textContent).toBe(":host { display: block; }");
    expect(template.content.querySelector("slot")).not.toBeNull();
    const card = document.querySelector("user-card")!;
    expect(card.getAttribute("@click")).toBe("go()");
    expect(card.getAttribute("data-x")).toBe("1");
    expect(card.textContent).toBe("Ada Lovelace");
    expect(document.querySelector("script")).toBeNull();
    // Client renders load the scripts with the component's module.
    expect((globalThis as Record<string, unknown>).cardScriptRan).toBe(true);
  });

  it("render the same markup on the server", async () => {
    for (const [text, name] of [
      [POST, "post.md"],
      [CARD, "card.html"],
    ] as const) {
      const client = await load("client", text, name);
      const server = await load("server", text, name);
      const html = await renderToString(() => server.default({}));
      document.body.innerHTML = "";
      render(() => createComponent(client.default, {}), document.body);
      const parsed = document.createElement("div");
      parsed.innerHTML = html;
      expect(markup(parsed), name).toBe(markup(document.body));
    }
  });

  it("load the scripts on server-rendered pages as a module script, without islands", async () => {
    const server = await load("server", CARD, "card.html");
    const { head, body } = await renderToStream(() => server.default({}));
    expect(head).toBe(`<script type="module" async src="/src/card.html?lumiose-script"></script>`);
    expect(body).not.toMatch(/<!--\/?l:\d+-->|data-l-islands/);
    expect((globalThis as Record<string, unknown>).cardScriptRan).toBeUndefined();
  });
});
