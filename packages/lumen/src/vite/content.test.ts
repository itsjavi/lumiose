// `.md` and `.html` imports (./content.ts) against a real Vite 8 dev server: the generated
// modules for both environments, frontmatter and its hook, scoped styles, the scripts island,
// HMR wiring, the build scan and the options. The fixture app is written to a temp dir whose
// node_modules/lumen links to this package.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  build,
  createLogger,
  createServer,
  normalizePath,
  type Rollup,
  type ViteDevServer,
} from "vite";
import lumen from "./index.ts";
import { contentOf, contentOptionsOf, toJs } from "./content.ts";
import { Packages } from "./packages.ts";
import { scanProject } from "./scan.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "content/post.md": `---
title: Hello, Lumen
tags: [docs, md]
---
# Hello, Lumen

Some *Markdown* with <span class="note">raw HTML</span>.

![A photo](./photo.png) and [the report](./files/report.pdf#page=2).

<style>
  .note { color: tomato; }
</style>
`,
  "content/bad.md": `---\ndraft: true\n---\n# No title\n`,
  "content/list.md": `---\n- a\n- b\n---\n# A list\n`,
  "content/scripted.md": `---\ntitle: Scripted\n---\n# Counter\n\n  <script type="module">count()</script>\n`,
  "components/card.html": `<!doctype html>
<html><head><style>user-card { display: block; }</style></head>
<body>
  <template id="card"><style>:host { color: red; }</style><slot></slot></template>
  <user-card>Ada</user-card>
  <script type="module">import { define } from "./define.js"; define();</script>
  <script src="./extra.js"></script>
</body></html>
`,
  // Above Vite's 4 kB inline limit, so builds emit them as files.
  "content/photo.png": "p".repeat(5000),
  "content/files/report.pdf": "r".repeat(5000),
  "components/define.js": `export function define() {}\n`,
  "components/extra.js": `globalThis.extra = true;\n`,
  "index.html": `<!doctype html><script type="module" src="/main.ts"></script>\n`,
  "render.tsx": `import { renderToString } from "lumen";
import Post, { frontmatter } from "./content/post.md";
import Card from "./components/card.html";
export const render = () =>
  renderToString(() => (
    <main>
      <h2>{String(frontmatter.title)}</h2>
      <Post />
      <Card />
    </main>
  ));
`,
};

const lumenRoot = resolve(import.meta.dirname, "../..");
let root: string;
let server: ViteDevServer;
let plain: ViteDevServer;

async function devServer(options: Parameters<typeof lumen>[0]): Promise<ViteDevServer> {
  return createServer({
    root,
    configFile: false,
    customLogger: createLogger("silent"),
    plugins: [lumen(options)],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
}

beforeAll(async () => {
  if (!binding) return;
  // Native realpath (no 8.3 short names on Windows) and `/` separators, as Vite ids have.
  root = `${normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumen-content-"))))}/app`;
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(`${root}/${name}`), { recursive: true });
    writeFileSync(`${root}/${name}`, code);
  }
  mkdirSync(`${root}/node_modules`);
  symlinkSync(lumenRoot, `${root}/node_modules/lumen`, "junction");
  server = await devServer({
    html: true,
    md: {
      frontmatter(data, { file }) {
        if (typeof data.title !== "string") throw new Error("title is required");
        return { ...data, file: file.slice(file.lastIndexOf("/") + 1) };
      },
    },
  });
  plain = await devServer({});
});

afterAll(async () => {
  await server?.close();
  await plain?.close();
  if (root) rmSync(dirname(root), { recursive: true, force: true });
});

describe.skipIf(!binding)(".md and .html imports", () => {
  it("resolves imports to the files' Lumen modules, only when enabled", async () => {
    const importer = `${root}/render.tsx`;
    const md = await server.environments.client.pluginContainer.resolveId(
      "./content/post.md",
      importer,
    );
    expect(md!.id).toBe(`${root}/content/post.md.stsx`);
    const html = await server.environments.ssr.pluginContainer.resolveId(
      "./components/card.html",
      importer,
    );
    expect(html!.id).toBe(`${root}/components/card.html.stsx`);
    const off = await plain.environments.client.pluginContainer.resolveId(
      "./content/post.md",
      importer,
    );
    expect(off!.id).toBe(`${root}/content/post.md`);
  });

  it("compiles a Markdown file to a static component with its CSS module", async () => {
    const result = await server.environments.client.transformRequest("/content/post.md.stsx");
    expect(result!.code).toContain("template(");
    expect(result!.code).toContain("<h1 id=hello-lumen data-l-");
    expect(result!.code).toContain("lumen-frontmatter");
    expect(result!.code).toContain("post.md.stsx?lumen&type=style&lang.css");
    const css = await server.environments.client.transformRequest(
      "/content/post.md.stsx?lumen&type=style&lang.css",
    );
    expect(css!.code).toMatch(/\.note\[data-l-\w+\]/);
    const { headings } = (await server.ssrLoadModule("/content/post.md.stsx")) as {
      headings: unknown;
    };
    expect(headings).toEqual([{ depth: 1, text: "Hello, Lumen", id: "hello-lumen" }]);
  });

  it("exports the frontmatter after the hook, and reports its errors with the file", async () => {
    const result = await server.environments.client.transformRequest(
      "/content/post.md?lumen-frontmatter",
    );
    expect(result!.code).toContain(
      'export const frontmatter = {"title": "Hello, Lumen", "tags": ["docs", "md"], "file": "post.md"};',
    );
    await expect(
      server.environments.ssr.transformRequest("/content/bad.md?lumen-frontmatter"),
    ).rejects.toThrow(/frontmatter: title is required/);
    const list = await devServer({ md: true });
    try {
      await expect(
        list.environments.ssr.transformRequest("/content/list.md?lumen-frontmatter"),
      ).rejects.toThrow(/expected a mapping of keys to values, got an array/);
    } finally {
      await list.close();
    }
  });

  it("rejects a <script> in Markdown with LUM1008 at its line", async () => {
    const failure = await server.environments.client
      .transformRequest("/content/scripted.md.stsx")
      .then(
        () => null,
        (error: { message: string; id?: string; loc?: object }) => error,
      );
    expect(failure!.message).toContain("LUM1008: `<script>` is not supported in Markdown");
    expect(failure!.message).toContain("help: Markdown is content only.");
    expect(failure!.id).toBe(`${root}/content/scripted.md`);
    expect(failure!.loc).toEqual({ file: `${root}/content/scripted.md`, line: 6, column: 2 });
  });

  it("server-renders the components, with the scripts as an island", async () => {
    const { render } = (await server.ssrLoadModule("/render.tsx")) as {
      render: () => Promise<string>;
    };
    const html = await render();
    expect(html).toContain("<h2>Hello, Lumen</h2>");
    expect(html).toMatch(/<h1 id=hello-lumen data-l-\w+>Hello, Lumen<\/h1>/);
    expect(html).toMatch(/<span class=note data-l-\w+>raw HTML<\/span>/);
    // Relative asset URLs are imported, so they resolve against the file, not the page.
    expect(html).toMatch(/<img alt="A photo" data-l-\w+ src="\/content\/photo.png">/);
    expect(html).toMatch(/<a data-l-\w+ href="\/content\/files\/report.pdf#page=2">/);
    // The template's content is verbatim (not scoped), the scripts are gone from the markup.
    expect(html).toMatch(
      /<template id=card data-l-\w+><style>:host \{ color: red; \}<\/style><slot><\/slot><\/template>/,
    );
    expect(html).toMatch(/<user-card data-l-\w+>Ada<\/user-card><!--l:0--><!--\/l:0-->/);
    expect(html).not.toContain("define()");
    expect(html).toContain("/components/card.html?lumen-script#Script");
  });

  it("loads the scripts in the client and nothing on the server", async () => {
    const client = await server.environments.client.transformRequest(
      "/components/card.html?lumen-script",
    );
    expect(client!.code).toContain("lumen-script&index=0&lang.js");
    expect(client!.code).toContain("extra.js");
    expect(client!.code).toContain("function Script()");
    const inline = await server.environments.client.transformRequest(
      "/components/card.html?lumen-script&index=0&lang.js",
    );
    expect(inline!.code).toContain("define()");
    const ssr = await server.environments.ssr.transformRequest(
      "/components/card.html?lumen-script",
    );
    expect(ssr!.code).not.toContain("extra.js");
    expect(ssr!.code).toContain("function Script()");
  });

  it("fingerprints the assets in client and server builds", async () => {
    for (const ssr of [false, true]) {
      const result = (await build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [lumen({ md: true, html: true })],
        build: {
          write: false,
          ssr: ssr ? "render.tsx" : false,
          emitAssets: true,
          // Keeps `render` (app builds drop the exports of their entries).
          rolldownOptions: ssr
            ? {}
            : { input: `${root}/render.tsx`, preserveEntrySignatures: "exports-only" },
        },
      })) as Rollup.RollupOutput;
      const files = result.output.map((file) => file.fileName);
      const photo = files.find((name) => /^assets\/photo-[\w-]+\.png$/.test(name));
      const report = files.find((name) => /^assets\/report-[\w-]+\.pdf$/.test(name));
      expect(photo, files.join()).toBeDefined();
      expect(report, files.join()).toBeDefined();
      const code = result.output.flatMap((file) => (file.type === "chunk" ? [file.code] : []));
      expect(code.join()).toContain(`/${photo}`);
      expect(code.join()).toContain(`/${report}`);
    }
  });

  it("watches the source file, so an edit reaches the module", async () => {
    await server.environments.client.transformRequest("/content/post.md.stsx");
    const graph = server.environments.client.moduleGraph;
    const watched = [...(graph.getModulesByFile(`${root}/content/post.md`) ?? [])];
    const importers = watched.flatMap((mod) => [...mod.importers].map((m) => m.id));
    expect(importers).toContain(`${root}/content/post.md.stsx`);
  });

  it("scans content files for islands and styles, not HTML entries", () => {
    const content = contentOf(contentOptionsOf(true, true), /node_modules/)!;
    const modules = scanProject(
      root,
      /\.(?:stsx|tsx)$/,
      /node_modules/,
      new Packages(root, /node_modules/),
      content,
    );
    const card = modules.find((m) => m.file === `${root}/components/card.html.stsx`);
    expect(card!.islands.map((i) => i.ref)).toEqual(["/components/card.html?lumen-script#Script"]);
    expect(card!.hasStyles).toBe(true);
    expect(modules.find((m) => m.file === `${root}/content/post.md.stsx`)!.hasStyles).toBe(true);
    // index.html is the app's page; it would only be skipped once Vite's config is known.
    expect(modules.some((m) => m.file.endsWith("index.html.stsx"))).toBe(true);
  });
});

describe("lumen({ md, html })", () => {
  it("validates its options", () => {
    expect(contentOptionsOf(undefined, undefined)).toEqual({ md: false, html: false });
    expect(contentOptionsOf(true, true)).toEqual({ md: {}, html: true });
    expect(() => contentOptionsOf("yes", undefined)).toThrow(
      'lumen({ md }): expected true, false or { frontmatter }, got "yes".',
    );
    expect(() => contentOptionsOf({ schema: 1 }, undefined)).toThrow(
      "lumen({ md.schema }): unknown option. Known options: frontmatter.",
    );
    expect(() => contentOptionsOf({ frontmatter: 1 }, undefined)).toThrow(
      "lumen({ md.frontmatter }): expected a function, got 1.",
    );
    expect(() => contentOptionsOf(undefined, "on")).toThrow(
      'lumen({ html }): expected true or false, got "on".',
    );
    expect(contentOf(contentOptionsOf(false, false), /node_modules/)).toBeNull();
  });

  it("writes frontmatter values as JS data", () => {
    const value = {
      a: [1, -0, 2n, NaN, undefined, null],
      date: new Date("2026-10-09T00:00:00Z"),
      url: new URL("https://lumen.dev/"),
      map: new Map([["k", new Set([1])]]),
    };
    // oxlint-disable-next-line no-eval -- checks that the code evaluates to the value
    expect((0, eval)(`(${toJs(value, "frontmatter")})`)).toEqual(value);
    // `__proto__` stays an own property and sets no prototype (TASK-169).
    const proto = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}') as Record<
      string,
      unknown
    >;
    // oxlint-disable-next-line no-eval -- checks what the code evaluates to
    const copy = (0, eval)(`(${toJs(proto, "frontmatter")})`) as Record<string, unknown>;
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.hasOwn(copy, "__proto__")).toBe(true);
    expect((copy as { polluted?: boolean }).polluted).toBeUndefined();
    expect(() => toJs({ f: () => 1 }, "frontmatter")).toThrow(
      "frontmatter.f cannot be exported (a function)",
    );
    expect(() => toJs({ e: new Error("x") }, "frontmatter")).toThrow(
      "frontmatter.e cannot be exported (Error)",
    );
  });
});
