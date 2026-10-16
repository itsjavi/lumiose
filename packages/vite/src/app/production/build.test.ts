// `lumiose build` end to end: Vite 8 client and server builds plus prerendering, on fixture apps
// written to temp dirs whose node_modules/lumiose links to this package.
import { linkLumiose } from "../../test-links.ts";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createLogger } from "vite";
import { STYLESHEETS_LOADED } from "lumiose/internal/app/server/stylesheets.ts";
import { build, BuildError, type BuildOptions } from "./build.ts";
import { PrerenderError, type ServerEntryModule } from "./prerender.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const roots: string[] = [];

const SITE: Record<string, string> = {
  "public/robots.txt": "User-agent: *\n",
  "src/middleware.ts": `import type { Middleware } from "lumiose";
// Middleware runs while prerendering too, and may read the (empty) request.
const middleware: Middleware = (ctx, next) => {
  (ctx.locals as { theme?: string }).theme = ctx.cookies.get("theme") ?? "light";
  return next();
};
export default middleware;
`,
  "src/app.css": "body { margin: 0; }\n",
  "src/routes/layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="layout">
      <nav><a href="/about">About</a></nav>
      {props.children}
      <style>
        .layout { color: crimson; }
      </style>
    </div>
  );
}
`,
  "src/routes/page.stsx": `import { Suspense, Title } from "lumiose";
import { Counter } from "../components/Counter.stsx";
async function Slow() {
  const text = await new Promise<string>((done) => setTimeout(() => done("resolved at build time"), 20));
  return <p class="slow">{text}</p>;
}
export default function Home() {
  return (
    <main>
      <Title>Home</Title>
      <Suspense fallback={<p>Loading</p>}><Slow /></Suspense>
      <Counter client:load start={1} />
    </main>
  );
}
`,
  "src/components/Counter.stsx": `import { signal } from "lumiose";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
  "src/routes/about/page.stsx": `export default function About() { return <h1>About</h1>; }
`,
  "src/routes/blog/[slug]/page.stsx": `import { params } from "lumiose";
export async function staticPaths() {
  return [{ params: { slug: "hello" } }, { params: { slug: "hola mundo" } }];
}
export default function Post() { return <h1>Post {params().slug}</h1>; }
`,
  "src/routes/docs/[...path]/page.stsx": `export function staticPaths() {
  return [{ params: { path: "guide/intro" } }];
}
export default function Doc(props: { params: { path: string } }) { return <h1>Doc {props.params.path}</h1>; }
`,
  "src/routes/old/page.stsx": `import { redirect } from "lumiose";
export default function Old() { throw redirect("/about"); }
`,
  "src/routes/sitemap.xml/route.ts": `export function GET(ctx: { url: URL }) {
  return new Response(\`<urlset><url>\${ctx.url.origin}/</url></urlset>\`, { headers: { "content-type": "application/xml" } });
}
`,
  "src/routes/live/page.stsx": `import { cookies, url } from "lumiose";
export const mode = "server";
export default function Live() { return <p>live {cookies().get("a") ?? "none"} {url().searchParams.get("q")}</p>; }
`,
  "src/routes/api/echo/route.ts": `export const mode = "server";
export function POST() { return new Response("posted"); }
`,
  "src/routes/not-found.stsx": `export default function NotFound(props: { status: number }) { return <h1>Missing {props.status}</h1>; }
`,
};

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-build-")));
  roots.push(root);
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  return root;
}

const quiet = (): Pick<BuildOptions, "customLogger" | "logLevel"> => ({
  customLogger: createLogger("silent"),
  logLevel: "silent",
});

const read = (root: string, file: string) => readFileSync(join(root, "dist/client", file), "utf8");

/** A component with a style block. */
const styled = (name: string, head = "") =>
  `${head}export default function C(props: { children?: JSX.Element }) {
  return <div class="${name}">{props.children}<style>.${name} { color: teal; }</style></div>;
}
`;

// Appends a rule to CSS assets in generateBundle and emits each under a new hash, deleting the
// old file, as StyleX does: under the old asset's name with the chunks' imported CSS updated
// (`as` empty), or under the name `as` with nothing else told.
const renaming = (which: string, as: string) => `const rename = {
  name: "rename-css",
  apply: "build",
  generateBundle: {
    order: "post",
    handler(_options, bundle) {
      if (this.environment.name !== "client") return;
      for (const old of Object.values(bundle)) {
        if (old.type !== "asset" || !old.fileName.endsWith(".css") || !old.fileName.includes(${JSON.stringify(which)})) continue;
        const source = String(old.source) + ".renamed{color:red}\\n";
        const name = ${JSON.stringify(as)} || old.names[0];
        const fileName = this.getFileName(this.emitFile({ type: "asset", name, source }));
        delete bundle[old.fileName];
        if (${JSON.stringify(as)}) continue;
        for (const chunk of Object.values(bundle)) {
          const css = chunk.type === "chunk" ? chunk.viteMetadata?.importedCss : undefined;
          if (css?.delete(old.fileName)) css.add(fileName);
        }
      }
    },
  },
};`;

/** The client build's assets, sorted, without their hashes (8 base64url characters) by default. */
const clientAssets = (root: string, unhashed = true) =>
  readdirSync(join(root, "dist/client/assets"))
    .map((file) => (unhashed ? file.replace(/-[\w-]{8}(\.\w+)$/, "$1") : file))
    .toSorted();

async function entryOf(root: string): Promise<ServerEntryModule> {
  return (await import(
    pathToFileURL(join(root, "dist/server/entry.js")).href
  )) as ServerEntryModule;
}

/** A custom element definition (TASK-354) that must never run on the server. */
const element = (tag: string) => `import { key } from "./keys.ts";
// Never runs on the server.
if (typeof document === "undefined") throw new Error("${tag} ran on the server");
customElements.define("${tag}", class extends HTMLElement { key = key; });
`;
/** A component rendering `<tag>`, with its definition as a client script. */
const component = (name: string, tag: string) => `import define from "./${tag}.element.ts?client";
export function ${name}(props: { children?: JSX.Element }) {
  define();
  return <${tag}>{props.children}</${tag}>;
}
`;
/** A client script's tag (TASK-354). */
const scriptTag = (url: string) => `<script type="module" async src="${url}"></script>`;
/** The module scripts of a page, in order. */
const moduleScripts = (html: string) =>
  [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g)].map((match) => match[1]);

describe.skipIf(!binding)("lumiose build", () => {
  it("builds the client and server, then prerenders static pages, staticPaths, endpoints and 404.html", async () => {
    const root = project(SITE);
    const result = await build({ root, ...quiet() });

    expect(result.clientDir).toBe(join(root, "dist/client"));
    expect(result.serverEntry).toBe(join(root, "dist/server/entry.js"));
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "about/index.html",
      "blog/hello/index.html",
      "blog/hola mundo/index.html",
      "docs/guide/intro/index.html",
      "index.html",
      "old/index.html",
      "sitemap.xml",
    ]);

    // Fully resolved, no fallbacks or swap scripts; island preloads point at the client chunk.
    const home = read(root, "index.html");
    expect(home).toContain("<title>Home</title>");
    expect(home).toContain("<p class=slow>resolved at build time</p>");
    expect(home).not.toMatch(/<\?start|<template|\$swap|Loading/);
    const preload = /<link rel="modulepreload" href="\/(assets\/Counter-[\w-]+\.js)">/.exec(home);
    expect(preload).not.toBeNull();
    expect(existsSync(join(result.clientDir, preload![1]!))).toBe(true);
    // The island loader entry, which imports each island's chunk lazily.
    const loader =
      /<script type="module" async src="\/(assets\/loader-[\w-]+\.js)"><\/script>/.exec(home);
    expect(loader).not.toBeNull();
    expect(read(root, loader![1]!)).toContain(preload![1]!.slice("assets/".length));

    // The stylesheets of the layout (an imported CSS file, then its style block), which every page
    // links first (TASK-19's CSS manifest): merged into one file, in cascade order (TASK-121).
    const links = [
      ...home.matchAll(
        /<link rel="stylesheet" href="\/(assets\/styles-[\w-]+\.css)" data-l-css="([^"]+)">/g,
      ),
    ];
    expect(links).toHaveLength(1);
    expect(links[0]![2]!.split(" ")).toHaveLength(2);
    const shared = read(root, links[0]![1]!);
    expect(shared).toMatch(/margin:0[^]*\.layout\[data-l-\w+\]\{color:#dc143c\}/);
    for (const href of links[0]![2]!.split(" ")) {
      expect(shared).toContain(read(root, href.slice(1)).trim());
    }
    expect(home.indexOf(links[0]![0])).toBeLessThan(home.indexOf("</head>"));
    expect(read(root, "about/index.html")).toContain(links[0]![0]);

    expect(read(root, "blog/hola mundo/index.html")).toContain("<h1>Post hola mundo</h1>");
    expect(read(root, "docs/guide/intro/index.html")).toContain("<h1>Doc guide/intro</h1>");
    expect(read(root, "sitemap.xml")).toBe("<urlset><url>http://localhost/</url></urlset>");
    expect(read(root, "old/index.html")).toContain(
      '<meta http-equiv="refresh" content="0;url=/about">',
    );
    expect(read(root, "404.html")).toContain("<h1>Missing 404</h1>");
    expect(read(root, "robots.txt")).toBe("User-agent: *\n");
    // Server routes are not prerendered.
    expect(existsSync(join(result.clientDir, "live"))).toBe(false);

    // The entry defaults NODE_ENV to production before it loads the runtime and the routes.
    const entrySource = readFileSync(join(root, "dist/server/entry.js"), "utf8");
    // The server output is minified (quotes may become backticks).
    const nodeEnv = entrySource.search(/\.NODE_ENV\s*=\s*["'`]production["'`]/);
    expect(nodeEnv).toBeGreaterThan(-1);
    expect(nodeEnv).toBeLessThan(entrySource.indexOf("import("));

    // dist/server/entry.js: `export default { fetch }` serves every route.
    const entry = await entryOf(root);
    // Route modules are imported once for the server's lifetime, not per request (TASK-150).
    const first = entry.app.loadModule("src/routes/page.stsx");
    expect(entry.app.loadModule("src/routes/page.stsx")).toBe(first);
    const live = await entry.default.fetch(
      new Request("http://app.test/live?q=1", { headers: { cookie: "a=b" } }),
    );
    const liveHtml = await live.text();
    expect(liveHtml).toContain("<p>live b 1</p>");
    expect(liveHtml).toContain(links[0]![0]);
    const posted = await entry.default.fetch(
      new Request("http://app.test/api/echo", { method: "POST" }),
    );
    expect(await posted.text()).toBe("posted");
    const { hashedFiles, ...config } = entry.config as typeof entry.config & {
      hashedFiles: string[];
    };
    expect(config).toEqual({ base: "/", trailingSlash: "ignore", assetsDir: "assets" });
    // Internal (TASK-201): every file the build wrote to assets/, by name.
    expect(hashedFiles).toEqual(
      clientAssets(root, false)
        .filter((file) => !/\.(?:br|gz)$/.test(file))
        .map((file) => `assets/${file}`),
    );
  });

  it("sends the scoped state islands reach, by the ids the client build assigned (TASK-193)", async () => {
    const root = project({
      "src/lib/visits.ts": `import { defineState, signal } from "lumiose";
export const visits = defineState(() => ({ count: signal(import.meta.env.SSR ? 7 : 0) }));
`,
      "src/lib/note.ts": `import { defineState, signal } from "lumiose";
export const note = defineState(() => ({ text: signal("server only") }));
`,
      "src/components/Visits.stsx": `import { visits } from "../lib/visits.ts";
export function Visits() {
  const { count } = visits();
  return <b onClick={() => count.update((n) => n + 1)}>{count()} visits</b>;
}
`,
      "src/routes/page.stsx": `import { Visits } from "../components/Visits.stsx";
import { note } from "../lib/note.ts";
import { visits } from "../lib/visits.ts";
export const mode = "server";
export default function Home() {
  return <main><p>{note().text()} {visits().count()}</p><Visits client:load /></main>;
}
`,
    });
    await build({ root, ...quiet() });
    const html = await (
      await (await entryOf(root)).default.fetch(new Request("http://app.test/"))
    ).text();
    expect(html).toContain("<p>server only 7</p>");
    const payload = /<script type="application\/json" data-l-payload>(.*?)<\/script>/.exec(html);
    expect(JSON.parse(payload![1]!)).toEqual({ s: { "/src/lib/visits.ts#visits": { count: 7 } } });
    // The client chunk restores it under the same id; the server-only state has none.
    const chunks = readdirSync(join(root, "dist/client/assets")).map((file) =>
      read(root, `assets/${file}`),
    );
    expect(chunks.some((code) => code.includes("/src/lib/visits.ts#visits"))).toBe(true);
    // Without src/instrumentation.client.ts, none of the client instrumentation ships (TASK-299).
    expect(chunks.join("")).not.toContain("instrumentations wrapper");
    const server = readdirSync(join(root, "dist/server"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(root, "dist/server", file), "utf8"));
    expect(server.some((code) => code.includes("/src/lib/visits.ts#visits"))).toBe(true);
    expect([...server, ...chunks].join("")).not.toContain("#note");
  });

  it("applies Vite's base and trailingSlash: never", async () => {
    const root = project({
      ...SITE,
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { base: "/sub/", build: { outDir: "out" }, plugins: [lumiose()] };
`,
    });
    const result = await build({ root, trailingSlash: "never", ...quiet() });
    expect(result.clientDir).toBe(join(root, "out/client"));
    const files = result.prerendered.map((file) => file.file);
    expect(files).toEqual(expect.arrayContaining(["index.html", "about.html", "blog/hello.html"]));
    const home = readFileSync(join(result.clientDir, "index.html"), "utf8");
    expect(home).toMatch(/<link rel="modulepreload" href="\/sub\/assets\/Counter-[\w-]+\.js">/);
    expect(home).toMatch(/<link rel="stylesheet" href="\/sub\/assets\/[\w.-]+\.css"/);

    const entry = (await import(pathToFileURL(result.serverEntry!).href)) as ServerEntryModule;
    expect(entry.config).toMatchObject({
      base: "/sub/",
      trailingSlash: "never",
      assetsDir: "assets",
    });
    const about = await entry.default.fetch(new Request("http://app.test/sub/about/"));
    expect(about.status).toBe(308);
    expect(about.headers.get("location")).toBe("/sub/about");
    expect((await entry.default.fetch(new Request("http://app.test/about"))).status).toBe(404);
  });

  it("writes no JS chunk left empty by the stylesheets of styled islands (TASK-94)", async () => {
    const root = project({
      "src/shared.css": ".shared { color: teal; }\n",
      "src/components/Toggle.stsx": `import { signal } from "lumiose";
import "../shared.css";
export function Toggle() {
  const on = signal(false);
  return (
    <button class="toggle shared" onClick={() => on.update((value) => !value)}>
      {on() ? "on" : "off"}
      <style>
        .toggle { color: tomato; }
      </style>
    </button>
  );
}
`,
      "src/routes/page.stsx": `import { Toggle } from "../components/Toggle.stsx";
export default function Home() { return <main><Toggle client:load /></main>; }
`,
    });
    const result = await build({ root, ...quiet() });

    // The island's stylesheets are linked and its chunk preloaded, but no JS chunk is only the
    // `/* empty css */` left of a stylesheet entry.
    const home = read(root, "index.html");
    const css = [...home.matchAll(/<link rel="stylesheet" href="\/(assets\/[\w.-]+\.css)"/g)];
    const styles = css.map((link) => read(root, link[1]!)).join("");
    expect(styles).toContain("color:teal");
    expect(styles).toMatch(/\.toggle\[data-l-\w+\]\{color:tomato\}/);
    expect(home).toMatch(/<link rel="modulepreload" href="\/assets\/Toggle-[\w-]+\.js">/);
    const scripts = readdirSync(join(result.clientDir, "assets")).filter((file) =>
      file.endsWith(".js"),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const file of scripts) {
      expect(read(root, `assets/${file}`), file).not.toMatch(/^(?:\s|\/\*\s*empty css\s*\*\/)*$/);
    }
  });

  it("maps the islands of linked packages to their chunks (TASK-98)", async () => {
    // `@acme/kit`, a linked Lumiose package outside the root. Its Header renders the Nav island
    // (ref named package-relatively, TASK-74); the app renders Badge imported by the bare name.
    const kit = project({
      "package.json": `{ "name": "@acme/kit", "type": "module", "exports": { ".": "./src/index.ts" }, "dependencies": { "lumiose": "workspace:*" } }\n`,
      "src/index.ts": `export { Header } from "./Header.stsx";\nexport { Badge } from "./Badge.stsx";\n`,
      "src/Header.stsx": `import { Nav } from "./Nav.stsx";
export function Header() { return <header><Nav client:load /></header>; }
`,
      "src/Nav.stsx": `import { signal } from "lumiose";
export function Nav() {
  const open = signal(false);
  return <nav onClick={() => open.set(true)}>{open() ? "open" : "closed"}</nav>;
}
`,
      "src/Badge.stsx": `export function Badge() { return <b onClick={() => {}}>New</b>; }\n`,
    });
    const root = project({
      "package.json": `{ "name": "app", "private": true, "dependencies": { "@acme/kit": "workspace:*" } }\n`,
      "src/routes/page.stsx": `import { Badge, Header } from "@acme/kit";
export default function Home() { return <main><Header /><Badge client:load /></main>; }
`,
      // A server route keeps dist/server, whose entry maps the refs too.
      "src/routes/live/page.stsx": `export const mode = "server";\nexport default function Live() { return <h1>Live</h1>; }\n`,
    });
    mkdirSync(join(root, "node_modules/@acme"));
    symlinkSync(kit, join(root, "node_modules/@acme/kit"), "dir");
    const result = await build({ root, ...quiet() });

    const home = read(root, "index.html");
    expect(home).toContain('"ref":"@acme/kit/src/Nav.stsx#Nav"');
    expect(home).toContain('"ref":"@acme/kit#Badge"');
    // Each island's modulepreload points at a built chunk, not at its ref.
    const preloads = [...home.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(
      (match) => match[1]!,
    );
    expect(preloads).toHaveLength(2);
    for (const href of preloads) {
      expect(href).toMatch(/^\/assets\/[\w-]+\.js$/);
      expect(existsSync(join(result.clientDir, href))).toBe(true);
    }
    expect(preloads.some((href) => /^\/assets\/Nav-[\w-]+\.js$/.test(href))).toBe(true);
    // The server entry maps the same refs, for server-rendered pages.
    const entry = readFileSync(result.serverEntry!, "utf8");
    for (const href of preloads) expect(entry).toMatch(new RegExp(`["'\`]${href}["'\`]`));
  });

  it("adds lumiose({ viewTransitions, prefetch }) to the page documents (TASK-93)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ viewTransitions: true })] };
`,
      "src/routes/page.stsx": `export default function Home() { return <a href="/live">Live</a>; }
`,
      "src/routes/live/page.stsx": `export const mode = "server";
export default function Live() { return <h1>Live</h1>; }
`,
      "src/routes/feed.xml/route.ts": 'export function GET() { return new Response("<feed/>"); }\n',
    });
    await build({ root, ...quiet() });

    // View Transitions opted in; hover prefetch by default, endpoints excepted.
    const head =
      "<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>" +
      '<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/feed.xml{/}?"]}}]},"eagerness":"moderate"}]}</script>';
    expect(read(root, "index.html")).toContain(head);
    // Server routes render them through dist/server/entry.js.
    const live = await (await entryOf(root)).default.fetch(new Request("http://app.test/live"));
    expect(await live.text()).toContain(head);
  });

  it("builds href() below the base, with trailingSlash: always, on the server and the client (TASK-101)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { base: "/sub/", plugins: [lumiose({ trailingSlash: "always" })] };
`,
      "src/routes/page.stsx": `import { href } from "lumiose";
import { Nav } from "../components/Nav.stsx";
export default function Home() {
  return (
    <main>
      <a href={href("/blog/[slug]", { slug: "hello" })}>Post</a>
      <a href={href("/feed.xml")}>Feed</a>
      <Nav client:load />
    </main>
  );
}
`,
      "src/components/Nav.stsx": `import { href } from "lumiose";
export function Nav() { return <a class="nav" href={href("/")}>Home</a>; }
`,
      "src/routes/blog/[slug]/page.stsx": `export const staticPaths = () => [{ params: { slug: "hello" } }];
export default function Post() { return <h1>Post</h1>; }
`,
      "src/routes/feed.xml/route.ts": 'export function GET() { return new Response("<feed/>"); }\n',
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file)).toEqual(
      expect.arrayContaining(["index.html", "blog/hello/index.html", "feed.xml"]),
    );
    const home = read(root, "index.html");
    expect(home).toContain('<a href="/sub/blog/hello/">Post</a><a href="/sub/feed.xml">Feed</a>');
    expect(home).toMatch(/<a class="?nav"? href="?\/sub\/"?>Home<\/a>/);
    // The client build has the same values: Vite replaced import.meta.env in lumiose's code.
    const assets = join(result.clientDir, "assets");
    const chunks = readdirSync(assets)
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(assets, file), "utf8"));
    const runtime = chunks.filter((code) => code.includes("missing value for param"));
    expect(runtime).toHaveLength(1);
    expect(runtime[0]).not.toContain("import.meta");
    expect(runtime[0]).not.toContain("__LUMIOSE_TRAILING_SLASH__");
  });

  it("links one shared stylesheet, then inlines or merges each page's own (TASK-121)", async () => {
    const big = Array.from({ length: 120 }, (_, i) => `.rule-${i} { margin-left: ${i}px; }`);
    const root = project({
      "src/app.css": "body { margin: 0; }\n",
      "src/routes/layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}<style>.layout { color: navy; }</style></div>;
}
`,
      "src/routes/page.stsx": `export default function Home() {
  return <main class="home">Home<style>.home { color: teal; }</style></main>;
}
`,
      "src/routes/big/page.stsx": `export default function Big() {
  return <main class="big">Big<style>${big.join("\n")}</style></main>;
}
`,
    });
    await build({ root, ...quiet() });
    const home = read(root, "index.html");
    const page = read(root, "big/index.html");
    const sharedLink =
      /<link rel="stylesheet" href="\/(assets\/styles-[\w-]+\.css)" data-l-css="([^"]+)">/;
    const shared = sharedLink.exec(home)!;
    expect(shared).not.toBeNull();
    expect(page).toContain(shared[0]);
    // The layout's stylesheets, in cascade order: the imported file, then the style block.
    expect(read(root, shared[1]!)).toMatch(/margin:0[^]*\.layout\[data-l-\w+\]\{color:navy\}/);
    expect(shared[2]!.split(" ")).toHaveLength(2);
    // A small page stylesheet is inlined after it; one over 4 kB is linked.
    const inline = /<style data-l-css="\/assets\/page-[\w-]+\.css">([^<]*)<\/style>/.exec(home);
    expect(inline![1]).toMatch(/\.home\[data-l-\w+\]\{color:teal\}/);
    expect(home.indexOf(shared[0])).toBeLessThan(home.indexOf(inline![0]));
    const pageLink =
      /<link rel="stylesheet" href="\/assets\/big-page-[\w-]+\.css" data-l-css="\/assets\/big-page-[\w-]+\.css">/.exec(
        page,
      );
    expect(pageLink).not.toBeNull();
    expect([...home.matchAll(/rel="stylesheet"/g)]).toHaveLength(1);
    // The parser waits for the linked files before the body, where a reload restores its scroll
    // position (TASK-278).
    expect(home).toContain(inline![0] + STYLESHEETS_LOADED);
    expect(page).toContain(pageLink![0] + STYLESHEETS_LOADED);
  });

  it("links the stylesheets a plugin renamed after Lumiose, as StyleX does (TASK-342)", async () => {
    const big = Array.from({ length: 120 }, (_, i) => `.rule-${i} { margin-left: ${i}px; }`);
    const files = (plugin: string): Record<string, string> => ({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
${plugin}
export default { plugins: [lumiose(), rename] };
`,
      "src/app.css": "body { margin: 0; }\n",
      "src/routes/layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return <div>{props.children}</div>;
}
`,
      "src/routes/page.stsx": `export default function Home() {
  return <main class="home">Home<style>.home { color: teal; }</style></main>;
}
`,
      "src/routes/live/page.stsx": `export const mode = "server";
export default function Live() {
  return <main class="live">Live<style>${big.join("\n")}</style></main>;
}
`,
    });
    const RULE = ".renamed{color:red}";
    /** A document's linked stylesheets, read from the output (a missing file throws), and inline ones. */
    const stylesOf = (root: string, html: string) => ({
      links: [...html.matchAll(/<link rel="stylesheet" href="\/([^"]+)"/g)].map(([, file]) =>
        read(root, file!),
      ),
      inline: [...html.matchAll(/<style data-l-css="[^"]*">([^<]*)<\/style>/g)].map(
        ([, css]) => css,
      ),
    });

    // Every stylesheet renamed under its own name: followed by name, prerendered or per request.
    const root = project(files(renaming(".css", "")));
    await build({ root, ...quiet() });
    const home = stylesOf(root, read(root, "index.html"));
    expect(home.links).toHaveLength(1);
    expect(home.inline).toHaveLength(1);
    for (const css of [...home.links, ...home.inline]) expect(css).toContain(RULE);
    const response = await (await entryOf(root)).default.fetch(new Request("http://app.test/live"));
    const live = stylesOf(root, await response.text());
    expect(live.links).toHaveLength(2);
    for (const css of live.links) expect(css).toContain(RULE);

    // One stylesheet renamed and nothing else told: the one new CSS file replaces it.
    const single = project(files(renaming("app", "other.css")));
    await build({ root: single, ...quiet() });
    const page = stylesOf(single, read(single, "index.html"));
    expect(page.links).toHaveLength(1);
    expect(page.links[0]).toContain(RULE);
    expect(page.inline).toHaveLength(1);
  });

  it("names route modules' chunks and stylesheets after their route folder (TASK-260)", async () => {
    const files = {
      "src/routes/layout.stsx": styled("root"),
      "src/routes/page.stsx": styled("home"),
      "src/routes/not-found.stsx": styled("missing"),
      "src/routes/error.stsx": styled("failed"),
      "src/routes/blog/[slug]/page.stsx": styled("post", 'export const mode = "server";\n'),
      "src/routes/(app)/dash/layout.stsx": styled("dash", 'export const mode = "spa";\n'),
      "src/routes/(app)/dash/[...rest]/page.stsx": styled("rest"),
      "src/components/Counter.stsx": `import { signal } from "lumiose";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
      "src/routes/counter/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export default function Page() { return <Counter client:load />; }
`,
    };
    const named = project(files);
    await build({ root: named, ...quiet() });
    expect(clientAssets(named)).toEqual(
      expect.arrayContaining([
        "page.css",
        "layout.css",
        "not-found.css",
        "error.css",
        "blog-slug-page.css",
        "app-dash-layout.css",
        "app-dash-layout.js",
        "app-dash-rest-page.css",
        "app-dash-rest-page.js",
      ]),
    );
    expect(clientAssets(named).filter((file) => /^(?:page|layout)\.js$/.test(file))).toEqual([]);

    // The same app with Vite's default file names: the chunks that import no route module keep
    // their hashes.
    const plain = project({
      ...files,
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  plugins: [lumiose()],
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
};
`,
    });
    await build({ root: plain, ...quiet() });
    expect(clientAssets(plain)).toEqual(
      expect.arrayContaining(["page.css", "layout.js", "page.js"]),
    );
    const unrelated = (root: string) =>
      clientAssets(root, false).filter((file) =>
        /^(?:lumiose|loader|Counter)-[\w-]{8}\.js$/.test(file),
      );
    expect(unrelated(named)).toHaveLength(3);
    expect(unrelated(named)).toEqual(unrelated(plain));
  });

  it("writes assets that only server-rendered pages import to dist/client, once (TASK-126)", async () => {
    // Above Vite's 4 kB inline limit, so they are files. `shared.png` is also an island's.
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ md: true })] };
`,
      "src/photo.png": "p".repeat(5000),
      "src/shared.png": "s".repeat(5000),
      "src/content/post.md": "# Post\n\n![A view](../view.png)\n",
      "src/view.png": "v".repeat(5000),
      "src/app.css": "body { margin: 0; }\n",
      "src/components/Badge.stsx": `import shared from "../shared.png";
export function Badge() { return <img class="badge" src={shared} onClick={() => {}} />; }
`,
      "src/routes/page.stsx": `import "../app.css";
import photo from "../photo.png";
import shared from "../shared.png";
import Post from "../content/post.md";
import { Badge } from "../components/Badge.stsx";
export default function Home() {
  return <main><img src={photo} /><img src={shared} /><Post /><Badge client:load /></main>;
}
`,
    });
    const result = await build({ root, ...quiet() });
    const home = read(root, "index.html");
    const urls = [...home.matchAll(/src="?(\/assets\/[\w.-]+\.png)/g)].map((match) => match[1]!);
    expect(urls.map((url) => url.replace(/-[\w-]+\.png$/, ""))).toEqual(
      expect.arrayContaining(["/assets/photo", "/assets/shared", "/assets/view"]),
    );
    for (const url of urls) expect(existsSync(join(result.clientDir, url))).toBe(true);
    // One file per asset, and none (nor CSS) left in the server output.
    const assets = readdirSync(join(result.clientDir, "assets"));
    expect(assets.filter((name) => name.startsWith("shared-"))).toHaveLength(1);
    expect(assets.filter((name) => name.endsWith(".css"))).toHaveLength(1);
    expect(existsSync(join(root, "dist/server/assets"))).toBe(false);
  });

  it("builds a site without islands or server routes to a self-contained dist/client", async () => {
    const root = project({
      "src/routes/page.stsx": "export default function Home() { return <h1>Static</h1>; }\n",
    });
    const result = await build({ root, ...quiet() });
    // `_headers`: Lumiose's default headers for static hosts (decision-29).
    expect(readdirSync(result.clientDir).toSorted()).toEqual([
      "404.html",
      "_headers",
      "index.html",
    ]);
    // Every route is prerendered: no dist/server (TASK-125).
    expect(result.serverEntry).toBeUndefined();
    expect(existsSync(join(root, "dist/server"))).toBe(false);
  });

  it("keeps dist/server for form actions, and writes lumiose({ headers }) to _headers (TASK-125)", async () => {
    const root = project({
      "src/routes/page.stsx": `export const actions = { save: () => ({ ok: true }) };
export default function Home() { return <h1>Static</h1>; }
`,
      "public/_headers": "/static/*\n  x-own: 1",
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  base: "/sub/",
  plugins: [lumiose({ headers: [{ path: "/**", headers: { "x-frame-options": "DENY" } }] })],
};
`,
    });
    const result = await build({ root, ...quiet() });
    expect(result.serverEntry).toBe(join(root, "dist/server/entry.js"));
    expect(read(root, "_headers")).toBe(
      "/static/*\n  x-own: 1\n# Generated by lumiose build: Lumiose's default headers and lumiose({ headers }).\n/sub/*\n  x-content-type-options: nosniff\n  referrer-policy: strict-origin-when-cross-origin\n  x-frame-options: DENY\n",
    );
    const entry = await entryOf(root);
    expect(entry.config.headers).toEqual([{ path: "/**", headers: { "x-frame-options": "DENY" } }]);
  });

  it("runs folder middleware in the server build and while prerendering, which warns (decision-48)", async () => {
    const root = project({
      "src/routes/admin/middleware.ts": `import type { Middleware } from "lumiose";
const guard: Middleware<"/admin"> = async (ctx, next) => {
  if (ctx.route === "/admin" && ctx.url.searchParams.get("key") !== "1") {
    return new Response("denied", { status: 401 });
  }
  const response = await next();
  const html = (await response.text()).replace("</h1>", \` via \${ctx.route}</h1>\`);
  return new Response(html, response);
};
export default guard;
`,
      "src/routes/admin/page.stsx": `export const mode = "server";
export default function Admin() { return <h1>Admin</h1>; }
`,
      "src/routes/admin/docs/page.stsx": `export default function Docs() { return <h1>Docs</h1>; }
`,
    });
    const logger = createLogger("silent");
    const warn = vi.spyOn(logger, "warn");
    await build({ root, customLogger: logger, logLevel: "silent" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^LUM5008: .*"\/admin\/docs".*\(src\/routes\/admin\/middleware\.ts\)$/),
    );
    expect(read(root, "admin/docs/index.html")).toContain("<h1>Docs via /admin/docs</h1>");
    const entry = await entryOf(root);
    expect((await entry.default.fetch(new Request("http://app.test/admin"))).status).toBe(401);
    const admin = await entry.default.fetch(new Request("http://app.test/admin?key=1"));
    expect(await admin.text()).toContain("<h1>Admin via /admin</h1>");
  });

  it("bundles src/instrumentation.server.ts into the server entry, not into prerendering (TASK-298)", async () => {
    const root = project({
      "src/instrumentation.server.ts": `import type { RequestErrorInfo, ServerInstrumentation } from "lumiose";
const log: string[] = ((globalThis as any).lumioseBuildInstrumentationLog ??= []);
export async function register() {
  log.push("register");
}
export function onRequestError(error: unknown, info: RequestErrorInfo) {
  log.push(\`\${info.phase} \${info.route} \${(error as Error).message}\`);
}
export const instrumentations: ServerInstrumentation[] = [
  {
    request: async (call, info) => {
      const result = await call();
      log.push(\`request \${info.route} \${result.status === "success" ? result.response?.status : "error"}\`);
    },
  },
];
`,
      "src/routes/page.stsx": `export default function Home() { return <h1>Home</h1>; }
`,
      "src/routes/api/fail/route.ts": `export const mode = "server";
export function GET(): Response { throw new Error("endpoint failed"); }
`,
    });
    const log = ((
      globalThis as { lumioseBuildInstrumentationLog?: string[] }
    ).lumioseBuildInstrumentationLog ??= []);
    await build({ root, ...quiet() });
    expect(read(root, "index.html")).toContain("<h1>Home</h1>");
    // Prerendering loads the entry but neither registers nor reports.
    expect(log).toEqual([]);
    const entry = await entryOf(root);
    expect(entry.app.instrumentation).toBe("src/instrumentation.server.ts");
    const onError = vi.fn();
    const handler = entry.createHandler({ onError });
    expect((await handler.fetch(new Request("http://app.test/api/fail"))).status).toBe(500);
    expect((await handler.fetch(new Request("http://app.test/api/fail"))).status).toBe(500);
    expect(log).toEqual([
      "register",
      "endpoint /api/fail endpoint failed",
      "request /api/fail 500",
      "endpoint /api/fail endpoint failed",
      "request /api/fail 500",
    ]);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("loads src/instrumentation.client.ts on every page, before islands and the SPA (TASK-295)", async () => {
    const root = project({
      "src/instrumentation.client.ts": `import { mark } from "./lib/mark.ts";
await Promise.resolve();
mark("client entry");
export const onError = (error: unknown) => console.error(error);
`,
      "src/lib/mark.ts": `export const mark = (name: string) => performance.mark(name);
`,
      "src/components/Counter.stsx": `import { signal } from "lumiose";
import { mark } from "../lib/mark.ts";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => { mark("click"); count.update((n) => n + 1); }}>{count()}</button>;
}
`,
      "src/routes/page.stsx": `export default function Home() { return <h1>No JavaScript</h1>; }
`,
      "src/routes/island/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export default function Island() { return <main><Counter client:load /></main>; }
`,
      "src/routes/app/layout.stsx": `export const mode = "spa";
export const prerender = true;
export default function App(props: { children?: JSX.Element }) { return <div id="app">{props.children}</div>; }
`,
      "src/routes/app/page.stsx": `export default function AppHome() { return <h1>SPA</h1>; }
`,
      "src/routes/live/page.stsx": `export const mode = "spa";
export default function Live() { return <h1>Live SPA</h1>; }
`,
    });
    await build({ root, ...quiet() });
    const entry = await entryOf(root);
    const client = entry.app.clientEntry!;
    expect(client.url).toMatch(/^\/assets\/instrumentation-[\w-]{8}\.js$/);
    const tag = `<script type="module" src="${client.url}" data-l-client></script>`;
    const preloads = client.preloads!.map((url) => `<link rel="modulepreload" href="${url}">`);

    // A page without islands or SPA routes: the client entry and what it imports, nothing else.
    const home = read(root, "index.html");
    expect(home).toContain(
      `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${preloads.join("")}${tag}`,
    );
    expect(moduleScripts(home)).toEqual([client.url]);
    const runtime = readdirSync(join(root, "dist/client/assets")).filter((file) =>
      file.startsWith("lumiose-"),
    );
    const own = read(root, client.url.slice(1));
    for (const file of runtime) expect(own).not.toContain(file);
    for (const url of client.preloads!) {
      for (const file of runtime) expect(read(root, url.slice(1))).not.toContain(file);
    }

    // An islands page: the loader that waits for the client entry.
    const island = read(root, "island/index.html");
    expect(island).toContain(tag);
    const [, loader] = moduleScripts(island);
    expect(loader).toBe(entry.app.loader);
    const loaderCode = read(root, loader!.slice(1));
    const runtimeCode = runtime.map((file) => read(root, `assets/${file}`)).join("");
    expect(loaderCode + runtimeCode).toContain("script[data-l-client]");
    // Its `onError` and `instrumentations` are dispatched by the runtime (TASK-299).
    expect(loaderCode + runtimeCode).toContain("instrumentations wrapper");

    // SPA pages, prerendered or rendered per request: the SPA entry passes the gate.
    // `startSpa(islands, config, afterClientEntry(clientEntry()))`, minified.
    const spaCode = read(root, entry.app.spa!.slice(1));
    expect(spaCode).toMatch(/\},\w+\(\w+\(\)\)\);\s*$/);
    expect(read(root, "app/index.html")).toContain(tag);
    const live = await entry.default.fetch(new Request("http://app.test/live"));
    expect(await live.text()).toContain(tag);
  });

  it("keeps the runtime off pages without islands when src/instrumentation.client.ts uses import() (TASK-346)", async () => {
    const root = project({
      "src/instrumentation.client.ts": `if (location.pathname === "/") await import("./lib/extra.ts");
export {};
`,
      "src/lib/extra.ts": `performance.mark("extra");
`,
      "src/components/Counter.stsx": `import { signal } from "lumiose";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
      "src/routes/page.stsx": `export default function Home() { return <h1>No JavaScript</h1>; }
`,
      "src/routes/island/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export default function Island() { return <main><Counter client:load /></main>; }
`,
    });
    await build({ root, ...quiet() });
    const entry = await entryOf(root);
    const client = entry.app.clientEntry!;
    const loader = entry.app.loader!;
    const preloads = client.preloads ?? [];
    // The page loads the client entry and what it imports, none of which is the runtime.
    const home = read(root, "index.html");
    const files = [client.url, ...preloads];
    for (const url of files) {
      expect(url).not.toBe(loader);
      expect(read(root, url.slice(1)).includes("script[data-l-client]"), url).toBe(false);
    }
    expect([...home.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])).toEqual([
      ...preloads,
      client.url,
    ]);
    // The lazy import still preloads and runs.
    expect(read(root, client.url.slice(1))).toMatch(/import\([`"']\.\/extra-[\w-]{8}\.js[`"']\)/);
    // An islands page still hydrates through the loader.
    expect(read(root, "island/index.html")).toContain(loader);
  });

  it("warns when a page renders a component whose client script the build did not build (TASK-463)", async () => {
    // The app in app/, and a module outside its root, which the one-time scan does not reach: its
    // `?client` import is not built.
    const base = project({
      "vendor/keys.ts": `export const key = "Enter";
`,
      "vendor/x-badge.element.ts": element("x-badge"),
      "vendor/badge.ts": `import define from "./x-badge.element.ts?client";
export function badge(): string {
  define();
  return "plain badge";
}
`,
      "app/package.json": `{ "name": "fixture", "type": "module" }`,
      "app/src/routes/page.stsx": `import { badge } from "../../../vendor/badge.ts";
export default function Home() { return <main>{badge()}</main>; }
`,
      "app/src/routes/other/page.stsx": `export default function Other() { return <main>No badge</main>; }
`,
    });
    const root = join(base, "app");
    const logger = createLogger("silent");
    const buildWarn = vi.spyOn(logger, "warn");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await build({ root, customLogger: logger, logLevel: "silent" });
      // The server build, once per script; then the page that renders it, once per script.
      expect(buildWarn.mock.calls.map(([message]) => String(message))).toContainEqual(
        expect.stringContaining("x-badge.element.ts is a client script (?client)"),
      );
      const rendered = consoleWarn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes("x-badge.element.ts"));
      expect(rendered).toEqual([expect.stringContaining('"/" renders a component that needs it')]);
      expect(read(root, "index.html")).toContain("plain badge");
      expect(moduleScripts(read(root, "index.html"))).toEqual([]);
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("loads the client scripts of server-rendered components on the pages that render them (TASK-354)", async () => {
    const root = project({
      "package.json": `{ "name": "fixture", "type": "module", "sideEffects": false }`,
      "src/ui/keys.ts": `export const key = "ArrowDown";
`,
      "src/ui/lu-menu.element.ts": element("lu-menu"),
      "src/ui/lu-combobox.element.ts": element("lu-combobox"),
      "src/ui/Menu.stsx": component("Menu", "lu-menu"),
      "src/ui/Combobox.stsx": component("Combobox", "lu-combobox"),
      "src/components/Counter.stsx": `import { signal } from "lumiose";
import { Menu } from "../ui/Menu.stsx";
export function Counter() {
  const count = signal(0);
  return <Menu><button onClick={() => count.update((n) => n + 1)}>{count()}</button></Menu>;
}
`,
      "src/routes/page.stsx": `import { Menu } from "../ui/Menu.stsx";
export default function Home() { return <main><Menu>Static</Menu><Menu>Twice</Menu></main>; }
`,
      "src/routes/plain/page.stsx": `import { Menu } from "../../ui/Menu.stsx";
const show = false;
export default function Plain() { return <main>{show ? <Menu>Hidden</Menu> : "No menu"}</main>; }
`,
      "src/routes/live/page.stsx": `import { Suspense } from "lumiose";
import { Combobox } from "../../ui/Combobox.stsx";
export const mode = "server";
async function Later() {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return <Combobox>Streamed</Combobox>;
}
export default function Live() { return <main><Suspense fallback={<p>…</p>}><Later /></Suspense></main>; }
`,
      "src/routes/island/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export default function Island() { return <main><Counter client:load /></main>; }
`,
      "src/routes/app/layout.stsx": `export const mode = "spa";
export const prerender = true;
export default function App(props: { children?: JSX.Element }) { return <div id="app">{props.children}</div>; }
`,
      "src/routes/app/page.stsx": `import { Combobox } from "../../ui/Combobox.stsx";
export default function AppHome() { return <Combobox>SPA</Combobox>; }
`,
    });
    await build({ root, ...quiet() });
    const entry = await entryOf(root);
    const assets = readdirSync(join(root, "dist/client/assets")).filter((f) => f.endsWith(".js"));
    const file = (prefix: string) => `/assets/${assets.find((f) => f.startsWith(prefix))!}`;
    const menu = file("lu-menu.element-");
    const combobox = file("lu-combobox.element-");
    const keys = file("keys-");
    const preload = `<link rel="modulepreload" href="${keys}">`;

    // Each definition is a chunk of its own, with no runtime: it defines its element.
    for (const url of [menu, combobox]) {
      const code = read(root, url.slice(1));
      expect(code).toContain("customElements.define");
      expect(code).not.toMatch(/lumiose-[\w-]{8}\.js/);
    }

    // A static page: the definition of the element it renders, once, and nothing else.
    const home = read(root, "index.html");
    expect(home).toContain(scriptTag(menu) + preload);
    expect(moduleScripts(home)).toEqual([menu]);

    // A page that imports the component without rendering it loads none.
    expect(moduleScripts(read(root, "plain/index.html"))).toEqual([]);

    // A server page: with the boundary that renders the element.
    const live = await (await entry.default.fetch(new Request("http://app.test/live"))).text();
    expect(moduleScripts(live)).toEqual([combobox]);
    expect(live.indexOf(scriptTag(combobox))).toBeGreaterThan(live.indexOf("<p>…</p>"));

    // A prerendered SPA page: from the head, and from the SPA's own code on client navigations.
    const app = read(root, "app/index.html");
    expect(moduleScripts(app)).toEqual([entry.app.spa, combobox]);
    const spaChunks = assets
      .filter((f) => f.startsWith("app-page-"))
      .map((f) => read(root, `assets/${f}`));
    expect(spaChunks.join("")).toContain(combobox.slice("/assets/".length));

    // An island: the page loads the definition with the loader; the island imports the same file.
    const island = read(root, "island/index.html");
    expect(moduleScripts(island)).toEqual([entry.app.loader, menu]);
    const counter = read(root, entry.app.islands["/src/components/Counter.stsx"]!.slice(1));
    expect(counter).toContain(menu.slice("/assets/".length));
  });

  it("stops with LUM4003 when src/instrumentation.client.ts imports server-only code (TASK-295)", async () => {
    const root = project({
      "src/instrumentation.client.ts": `import { secret } from "./lib/keys.server.ts";
console.log(secret);
`,
      "src/lib/keys.server.ts": `export const secret = "s3cr3t";
`,
      "src/routes/page.stsx": `export default function Home() { return <h1>Home</h1>; }
`,
    });
    await expect(build({ root, ...quiet() })).rejects.toThrow(
      /LUM4003: src\/lib\/keys\.server\.ts is server-only, but client code imports it:\n {2}src\/instrumentation\.client\.ts/,
    );
  });

  it("prerenders spa routes with prerender into hydrating HTML, without dist/server (TASK-216)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "spa" })] };
`,
      "src/routes/layout.stsx": `export default function Shell(props: { children?: JSX.Element }) {
  return <div class="shell">{props.children}</div>;
}
`,
      "src/routes/page.stsx": `import { Link } from "lumiose/router";
export const prerender = true;
export default function Home() {
  return <main><h1>Tracks</h1><Link href="/tracks/2">Two</Link></main>;
}
`,
      "src/routes/tracks/[id]/page.stsx": `import { params } from "lumiose/router";
export const prerender = true;
export function staticPaths() {
  return [{ params: { id: "1" } }, { params: { id: "2" } }];
}
export default function Track() { return <h1>Track {params().id}</h1>; }
`,
      "src/routes/not-found.stsx": `export default function NotFound() { return <h1>No such track</h1>; }
`,
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "index.html",
      "tracks/1/index.html",
      "tracks/2/index.html",
    ]);
    // Every page is prerendered and nothing else needs the server.
    expect(result.serverEntry).toBeUndefined();
    expect(existsSync(join(root, "dist/server"))).toBe(false);

    // Real HTML, inside the SPA root island the SPA entry hydrates (`#lumiose:spa`, not a shell).
    const home = read(root, "index.html");
    expect(home).toContain("<h1>Tracks</h1>");
    expect(home).toContain("class=shell");
    expect(home).toContain("src/routes/page.stsx#lumiose:spa");
    expect(home).not.toContain("#lumiose:csr");
    const spa = /<script type="module" async src="\/(assets\/spa-[\w-]+\.js)"><\/script>/.exec(
      home,
    );
    expect(spa).not.toBeNull();
    expect(existsSync(join(result.clientDir, spa![1]!))).toBe(true);
    // Deep links with params get their own HTML, which starts the same SPA.
    const track = read(root, "tracks/2/index.html");
    expect(track).toContain("<h1>Track <!--[-->2<!--]--></h1>");
    expect(track).toContain("src/routes/tracks/[id]/page.stsx#lumiose:spa");
    expect(track).toContain(spa![0]);
    // Unknown URLs: the _404 page, rendered inside the SPA.
    expect(read(root, "404.html")).toContain("<h1>No such track</h1>");
  });

  it("makes lumiose({ prerender: true }) the spa default, which a page turns off (TASK-216)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "spa", prerender: true })] };
`,
      "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      "src/routes/live/page.stsx": `import { cookies } from "lumiose";
export const prerender = false;
export default function Live() { return <p>{cookies().get("a") ?? "none"}</p>; }
`,
      "src/routes/shell/page.stsx": `export const ssr = false;
export default function Shell() { return <p>browser only</p>; }
`,
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "index.html",
      "shell/index.html",
    ]);
    expect(read(root, "index.html")).toContain("<h1>Home</h1>");
    // An ssr = false page stays a shell under the project default.
    expect(read(root, "shell/index.html")).toContain("src/routes/shell/page.stsx#lumiose:csr");
    // The page that opted out renders per request, so the build keeps its server.
    expect(result.serverEntry).toBe(join(root, "dist/server/entry.js"));
  });

  it("prerenders the spa pages below a layout with prerender, nearest layout first (TASK-229)", async () => {
    const root = project({
      "src/routes/layout.stsx": `export const mode = "spa";
export const prerender = true;
export default function Shell(props: { children?: JSX.Element }) { return <div class="shell">{props.children}</div>; }
`,
      "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      "src/routes/account/page.stsx": `import { cookies } from "lumiose";
export const prerender = false;
export default function Account() { return <p>{cookies().get("a") ?? "none"}</p>; }
`,
      "src/routes/studio/layout.stsx": `export const prerender = false;
export default function Studio(props: { children?: JSX.Element }) { return <section>{props.children}</section>; }
`,
      "src/routes/studio/page.stsx": "export default function Live() { return <h1>Live</h1>; }\n",
      "src/routes/studio/demo/layout.stsx": `export const prerender = true;
export default function Demo(props: { children?: JSX.Element }) { return <div>{props.children}</div>; }
`,
      "src/routes/studio/demo/page.stsx":
        "export default function Demo() { return <h1>Demo</h1>; }\n",
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "index.html",
      "studio/demo/index.html",
    ]);
    expect(read(root, "index.html")).toContain("src/routes/page.stsx#lumiose:spa");
    expect(read(root, "studio/demo/index.html")).toContain("<h1>Demo</h1>");
    // /account and /studio opted out, so they render per request.
    expect(result.serverEntry).toBe(join(root, "dist/server/entry.js"));
  });

  it("stops when a prerendered spa route reads the request or lacks staticPaths() (TASK-216)", async () => {
    const root = project({
      "src/routes/layout.stsx": `export const mode = "spa";
export default function Shell(props: { children?: JSX.Element }) { return <div>{props.children}</div>; }
`,
      "src/routes/page.stsx": `import { cookies } from "lumiose";
export const prerender = true;
export default function Home() { return <p>{cookies().get("theme") ?? "light"}</p>; }
`,
      "src/routes/tracks/[id]/page.stsx": `export const prerender = true;
export default function Track() { return <h1>Track</h1>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrerenderError);
    expect((failure as PrerenderError).problems).toEqual([
      expect.stringContaining(
        `src/routes/tracks/[id]/page.stsx: "/tracks/[id]" is prerendered and has params, so it needs \`export async function staticPaths()\``,
      ),
      expect.stringMatching(
        /^src\/routes\/page\.stsx \(\/\): cookies\(\) reads the request, but this route is prerendered.*LUM5001/,
      ),
    ]);
  });

  it("stops with LUM5006 for prerender on an ssr = false page, before building (TASK-216)", async () => {
    const root = project({
      "src/routes/page.stsx": `export const mode = "spa";
export const ssr = false;
export const prerender = true;
export default function Home() { return <h1>Home</h1>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BuildError);
    expect((failure as Error).message).toContain("src/routes/page.stsx: LUM5006");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("stops with LUM5001 when a prerendered route reads the request", async () => {
    const root = project({
      "src/routes/page.stsx": `import { cookies } from "lumiose";
export default function Home() { return <p>{cookies().get("theme") ?? "light"}</p>; }
`,
      "src/routes/search/page.stsx": `import { url } from "lumiose";
export default function Search() { return <p>{url().searchParams.get("q")}</p>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrerenderError);
    const problems = (failure as PrerenderError).problems;
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(
      /^src\/routes\/page\.stsx \(\/\): cookies\(\) reads the request.*LUM5001/,
    );
    expect(problems[1]).toMatch(
      /^src\/routes\/search\/page\.stsx \(\/search\): url\(\)\.searchParams reads the request/,
    );
  });

  it("stops with LUM5005 for a static endpoint with other methods, before building", async () => {
    const root = project({
      "src/routes/api/subscribe/route.ts":
        "export function GET() { return new Response(); }\nexport function POST() { return new Response(); }\n",
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BuildError);
    expect((failure as Error).message).toContain("src/routes/api/subscribe/route.ts: LUM5005");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("prerenders each page once per declared locale (decision-44)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  plugins: [
    lumiose({ i18n: { locales: ["en", "es", "fr"], defaultLocale: "en" }, site: "https://example.com" }),
  ],
};
`,
      "src/routes/page.stsx": `import { href, locale } from "lumiose";
export const locales = "all";
export default function Home() {
  return <a href={href("/about")}>{locale()}</a>;
}
`,
      "src/routes/about/page.stsx": `import { locale } from "lumiose";
export const locales = ["en", "es"];
export default function About() {
  return <h1>About {locale()}</h1>;
}
`,
      "src/routes/blog/[slug]/page.stsx": `import { locale, type PageProps } from "lumiose";
const translations: Record<string, string[]> = { hello: ["en", "es"], hola: ["es"] };
export function staticPaths() {
  return [{ params: { slug: "hello" } }, { params: { slug: "hola" } }];
}
export function locales({ params }: { params: { slug: string } }) {
  return translations[params.slug] ?? [];
}
export default function Post(props: PageProps<"/blog/[slug]">) {
  return <h1>{props.params.slug} {locale()}</h1>;
}
`,
      "src/routes/not-found.stsx": `export default function NotFound() { return <h1>Not found</h1>; }
`,
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "about/index.html",
      "blog/hello/index.html",
      "es/about/index.html",
      "es/blog/hello/index.html",
      "es/blog/hola/index.html",
      "es/index.html",
      "fr/index.html",
      "index.html",
    ]);
    const about = read(root, "es/about/index.html");
    expect(about).toMatch(/^<!doctype html><html lang="es">/);
    expect(about).toContain("<h1>About es</h1>");
    expect(about).toContain('<link rel="canonical" href="https://example.com/es/about">');
    expect(about).toContain(
      '<link rel="alternate" hreflang="en" href="https://example.com/about">',
    );
    expect(about).toContain(
      '<link rel="alternate" hreflang="es" href="https://example.com/es/about">',
    );
    expect(about).not.toContain('hreflang="fr"');
    expect(read(root, "fr/index.html")).toContain('<a href="/fr/about">fr</a>');
    const hola = read(root, "es/blog/hola/index.html");
    expect(hola).toContain("<h1>hola es</h1>");
    // One locale: no alternates.
    expect(hola).not.toContain("hreflang");
    expect(hola).not.toContain('rel="canonical"');
  });

  it("takes Vite's base from the path of lumiose({ site }), counted once in absolute URLs", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  plugins: [
    lumiose({
      i18n: { locales: ["en", "es"], defaultLocale: "en" },
      site: "https://example.com/docs",
      trailingSlash: "always",
    }),
  ],
};
`,
      "src/routes/about/page.stsx": `import { href } from "lumiose";
export const locales = "all";
// Outside a request: the locales come from the plugin's define (TASK-254 regression).
const spanish = href("/about", { locale: "es" });
export default function About() {
  return <a href={href("/about", { locale: "en" })} data-es={spanish}>About</a>;
}
`,
    });
    const result = await build({ root, ...quiet() });
    expect(result.prerendered.map((file) => file.file).toSorted()).toEqual([
      "404.html",
      "about/index.html",
      "es/about/index.html",
    ]);
    const about = read(root, "es/about/index.html");
    expect(about).toContain('<link rel="canonical" href="https://example.com/docs/es/about/">');
    expect(about).toContain(
      '<link rel="alternate" hreflang="en" href="https://example.com/docs/about/">',
    );
    expect(about).toContain('<a href="/docs/about/" data-es="/docs/es/about/">About</a>');
  });

  it("warns when localized pages are prerendered without lumiose({ site })", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ i18n: { locales: ["en", "es"], defaultLocale: "en" } })] };
`,
      "src/routes/page.stsx": `export const locales = "all";
export default function Home() { return <h1>Home</h1>; }
`,
    });
    const logger = createLogger("silent");
    const warn = vi.spyOn(logger, "warn");
    await build({ root, customLogger: logger, logLevel: "silent" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('lumiose({ site: "https://example.com" })'),
    );
    expect(read(root, "es/index.html")).toContain('<link rel="canonical" href="/es">');
  });

  it("lists the files it named by content hash for servers and adapters, never public/ ones (TASK-201)", async () => {
    const root = project({
      "vite.config.ts": `import { writeFileSync } from "node:fs";
import { join } from "node:path";
import lumiose from "@lumiose/vite";
const adapter = {
  name: "test-adapter",
  adapt(build) {
    const { hashedFiles, unhashedAssets } = build;
    writeFileSync(join(build.root, "adapter.json"), JSON.stringify({ hashedFiles, unhashedAssets }));
  },
};
export default { plugins: [lumiose({ adapter })] };
`,
      "public/assets/badge-v2-final.svg": "<svg/>",
      "public/assets/icons/logo.svg": "<svg/>",
      "src/app.css": "body { margin: 0; }\n",
      "src/photo.png": "p".repeat(5000),
      "src/routes/layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}<style>.layout { color: navy; }</style></div>;
}
`,
      "src/routes/page.stsx": `import photo from "../photo.png";
import { Counter } from "../components/Counter.stsx";
export default function Home() { return <main><img src={photo} /><Counter client:load /></main>; }
`,
      "src/routes/live/page.stsx": `export const mode = "server";
export default function Live() { return <h1>Live</h1>; }
`,
      "src/components/Counter.stsx": `import { signal } from "lumiose";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
    });
    const result = await build({ root, ...quiet() });
    const written = (readdirSync(join(result.clientDir, "assets"), { recursive: true }) as string[])
      .map((file) => `assets/${file.split("\\").join("/")}`)
      .filter((file) => /\.\w+$/.test(file) && !/\.(?:br|gz)$/.test(file));
    const adapter = JSON.parse(readFileSync(join(root, "adapter.json"), "utf8")) as {
      hashedFiles: string[];
      unhashedAssets: string[];
    };
    const publicFiles = ["assets/badge-v2-final.svg", "assets/icons/logo.svg"];
    expect(adapter.unhashedAssets).toEqual(publicFiles);
    // The client's chunks and CSS, the merged stylesheet, and the image only the server imports.
    expect(adapter.hashedFiles).toEqual(
      written.filter((file) => !publicFiles.includes(file)).toSorted(),
    );
    expect(adapter.hashedFiles.map((file) => file.replace(/-[\w-]{8}\./, "."))).toEqual(
      expect.arrayContaining(["assets/styles.css", "assets/photo.png", "assets/Counter.js"]),
    );
    const entry = await entryOf(root);
    expect((entry.config as { hashedFiles?: string[] }).hashedFiles).toEqual(adapter.hashedFiles);
    const cache = async (path: string) =>
      // HEAD: no file is opened for a body nobody reads.
      (
        await entry.default.fetch(new Request(`http://app.test${path}`, { method: "HEAD" }))
      ).headers.get("cache-control");
    for (const file of adapter.hashedFiles) {
      expect(await cache(`/${file}`)).toBe("public, max-age=31536000, immutable");
    }
    for (const file of publicFiles) {
      expect(await cache(`/${file}`)).toBe("public, max-age=0, must-revalidate");
    }
  });

  it("requires staticPaths() for static routes with params and a 200 response", async () => {
    const root = project({
      "src/routes/blog/[slug]/page.stsx":
        "export default function Post() { return <h1>Post</h1>; }\n",
      "src/routes/gone/page.stsx": `import { notFound } from "lumiose";
export default function Gone() { notFound(); }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect((failure as PrerenderError).problems).toEqual([
      expect.stringContaining(
        `src/routes/blog/[slug]/page.stsx: "/blog/[slug]" is static and has params, so it needs`,
      ),
      "src/routes/gone/page.stsx (/gone): responded 404; prerendered routes must respond 200 or redirect.",
    ]);
  });
});
