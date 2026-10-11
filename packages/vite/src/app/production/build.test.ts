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
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "vite";
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
  "src/routes/_layout.stsx": `import "../app.css";
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
  "src/routes/index.stsx": `import { Suspense, Title } from "lumiose";
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
  "src/routes/about.stsx": `export default function About() { return <h1>About</h1>; }
`,
  "src/routes/blog/[slug].stsx": `import { params } from "lumiose";
export async function staticPaths() {
  return [{ params: { slug: "hello" } }, { params: { slug: "hola mundo" } }];
}
export default function Post() { return <h1>Post {params().slug}</h1>; }
`,
  "src/routes/docs/[...path].stsx": `export function staticPaths() {
  return [{ params: { path: "guide/intro" } }];
}
export default function Doc(props: { params: { path: string } }) { return <h1>Doc {props.params.path}</h1>; }
`,
  "src/routes/old.stsx": `import { redirect } from "lumiose";
export default function Old() { throw redirect("/about"); }
`,
  "src/routes/sitemap.xml.ts": `export function GET(ctx: { url: URL }) {
  return new Response(\`<urlset><url>\${ctx.url.origin}/</url></urlset>\`, { headers: { "content-type": "application/xml" } });
}
`,
  "src/routes/live.stsx": `import { cookies, url } from "lumiose";
export const mode = "server";
export default function Live() { return <p>live {cookies().get("a") ?? "none"} {url().searchParams.get("q")}</p>; }
`,
  "src/routes/api/echo.ts": `export const mode = "server";
export function POST() { return new Response("posted"); }
`,
  "src/routes/_404.stsx": `export default function NotFound(props: { status: number }) { return <h1>Missing {props.status}</h1>; }
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

async function entryOf(root: string): Promise<ServerEntryModule> {
  return (await import(
    pathToFileURL(join(root, "dist/server/entry.js")).href
  )) as ServerEntryModule;
}

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
    const nodeEnv = entrySource.search(/process\.env\.NODE_ENV\s*=\s*["'`]production["'`]/);
    expect(nodeEnv).toBeGreaterThan(-1);
    expect(nodeEnv).toBeLessThan(entrySource.indexOf("import("));

    // dist/server/entry.js: `export default { fetch }` serves every route.
    const entry = await entryOf(root);
    // Route modules are imported once for the server's lifetime, not per request (TASK-150).
    const first = entry.app.loadModule("src/routes/index.stsx");
    expect(entry.app.loadModule("src/routes/index.stsx")).toBe(first);
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
    expect(entry.config).toEqual({ base: "/", trailingSlash: "ignore", assetsDir: "assets" });
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
      "src/routes/index.stsx": `import { Visits } from "../components/Visits.stsx";
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
    expect(entry.config).toEqual({ base: "/sub/", trailingSlash: "never", assetsDir: "assets" });
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
      "src/routes/index.stsx": `import { Toggle } from "../components/Toggle.stsx";
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
      "src/routes/index.stsx": `import { Badge, Header } from "@acme/kit";
export default function Home() { return <main><Header /><Badge client:load /></main>; }
`,
      // A server route keeps dist/server, whose entry maps the refs too.
      "src/routes/live.stsx": `export const mode = "server";\nexport default function Live() { return <h1>Live</h1>; }\n`,
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
      "src/routes/index.stsx": `export default function Home() { return <a href="/live">Live</a>; }
`,
      "src/routes/live.stsx": `export const mode = "server";
export default function Live() { return <h1>Live</h1>; }
`,
      "src/routes/feed.xml.ts": 'export function GET() { return new Response("<feed/>"); }\n',
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
      "src/routes/index.stsx": `import { href } from "lumiose";
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
      "src/routes/blog/[slug].stsx": `export const staticPaths = () => [{ params: { slug: "hello" } }];
export default function Post() { return <h1>Post</h1>; }
`,
      "src/routes/feed.xml.ts": 'export function GET() { return new Response("<feed/>"); }\n',
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
    expect(runtime[0]).not.toContain("LUMIOSE_TRAILING_SLASH");
  });

  it("links one shared stylesheet, then inlines or merges each page's own (TASK-121)", async () => {
    const big = Array.from({ length: 120 }, (_, i) => `.rule-${i} { margin-left: ${i}px; }`);
    const root = project({
      "src/app.css": "body { margin: 0; }\n",
      "src/routes/_layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}<style>.layout { color: navy; }</style></div>;
}
`,
      "src/routes/index.stsx": `export default function Home() {
  return <main class="home">Home<style>.home { color: teal; }</style></main>;
}
`,
      "src/routes/big.stsx": `export default function Big() {
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
    const inline = /<style data-l-css="\/assets\/index-[\w-]+\.css">([^<]*)<\/style>/.exec(home);
    expect(inline![1]).toMatch(/\.home\[data-l-\w+\]\{color:teal\}/);
    expect(home.indexOf(shared[0])).toBeLessThan(home.indexOf(inline![0]));
    expect(page).toMatch(
      /<link rel="stylesheet" href="\/assets\/big-[\w-]+\.css" data-l-css="\/assets\/big-[\w-]+\.css">/,
    );
    expect([...home.matchAll(/rel="stylesheet"/g)]).toHaveLength(1);
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
      "src/routes/index.stsx": `import "../app.css";
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
      "src/routes/index.stsx": "export default function Home() { return <h1>Static</h1>; }\n",
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
      "src/routes/index.stsx": `export const actions = { save: () => ({ ok: true }) };
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
      "/static/*\n  x-own: 1\n# Generated by lumiose build: Lumiose's default headers and lumiose({ headers }).\n/sub/*\n  x-content-type-options: nosniff\n  referrer-policy: strict-origin-when-cross-origin\n/sub/*\n  x-frame-options: DENY\n",
    );
    const entry = await entryOf(root);
    expect(entry.config.headers).toEqual([{ path: "/**", headers: { "x-frame-options": "DENY" } }]);
  });

  it("prerenders spa routes with prerender into hydrating HTML, without dist/server (TASK-216)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "spa" })] };
`,
      "src/routes/_layout.stsx": `export default function Shell(props: { children?: JSX.Element }) {
  return <div class="shell">{props.children}</div>;
}
`,
      "src/routes/index.stsx": `import { Link } from "lumiose/router";
export const prerender = true;
export default function Home() {
  return <main><h1>Tracks</h1><Link href="/tracks/2">Two</Link></main>;
}
`,
      "src/routes/tracks/[id].stsx": `import { params } from "lumiose/router";
export const prerender = true;
export function staticPaths() {
  return [{ params: { id: "1" } }, { params: { id: "2" } }];
}
export default function Track() { return <h1>Track {params().id}</h1>; }
`,
      "src/routes/_404.stsx": `export default function NotFound() { return <h1>No such track</h1>; }
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
    expect(home).toContain("src/routes/index.stsx#lumiose:spa");
    expect(home).not.toContain("#lumiose:csr");
    const spa = /<script type="module" async src="\/(assets\/spa-[\w-]+\.js)"><\/script>/.exec(
      home,
    );
    expect(spa).not.toBeNull();
    expect(existsSync(join(result.clientDir, spa![1]!))).toBe(true);
    // Deep links with params get their own HTML, which starts the same SPA.
    const track = read(root, "tracks/2/index.html");
    expect(track).toContain("<h1>Track <!--[-->2<!--]--></h1>");
    expect(track).toContain("src/routes/tracks/[id].stsx#lumiose:spa");
    expect(track).toContain(spa![0]);
    // Unknown URLs: the _404 page, rendered inside the SPA.
    expect(read(root, "404.html")).toContain("<h1>No such track</h1>");
  });

  it("makes lumiose({ prerender: true }) the spa default, which a page turns off (TASK-216)", async () => {
    const root = project({
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "spa", prerender: true })] };
`,
      "src/routes/index.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      "src/routes/live.stsx": `import { cookies } from "lumiose";
export const prerender = false;
export default function Live() { return <p>{cookies().get("a") ?? "none"}</p>; }
`,
      "src/routes/shell.stsx": `export const ssr = false;
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
    expect(read(root, "shell/index.html")).toContain("src/routes/shell.stsx#lumiose:csr");
    // The page that opted out renders per request, so the build keeps its server.
    expect(result.serverEntry).toBe(join(root, "dist/server/entry.js"));
  });

  it("stops when a prerendered spa route reads the request or lacks staticPaths() (TASK-216)", async () => {
    const root = project({
      "src/routes/_layout.stsx": `export const mode = "spa";
export default function Shell(props: { children?: JSX.Element }) { return <div>{props.children}</div>; }
`,
      "src/routes/index.stsx": `import { cookies } from "lumiose";
export const prerender = true;
export default function Home() { return <p>{cookies().get("theme") ?? "light"}</p>; }
`,
      "src/routes/tracks/[id].stsx": `export const prerender = true;
export default function Track() { return <h1>Track</h1>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrerenderError);
    expect((failure as PrerenderError).problems).toEqual([
      expect.stringContaining(
        `src/routes/tracks/[id].stsx: "/tracks/[id]" is prerendered and has params, so it needs \`export async function staticPaths()\``,
      ),
      expect.stringMatching(
        /^src\/routes\/index\.stsx \(\/\): cookies\(\) reads the request, but this route is prerendered.*LUM5001/,
      ),
    ]);
  });

  it("stops with LUM5006 for prerender on an ssr = false page, before building (TASK-216)", async () => {
    const root = project({
      "src/routes/index.stsx": `export const mode = "spa";
export const ssr = false;
export const prerender = true;
export default function Home() { return <h1>Home</h1>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BuildError);
    expect((failure as Error).message).toContain("src/routes/index.stsx: LUM5006");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("stops with LUM5001 when a prerendered route reads the request", async () => {
    const root = project({
      "src/routes/index.stsx": `import { cookies } from "lumiose";
export default function Home() { return <p>{cookies().get("theme") ?? "light"}</p>; }
`,
      "src/routes/search.stsx": `import { url } from "lumiose";
export default function Search() { return <p>{url().searchParams.get("q")}</p>; }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrerenderError);
    const problems = (failure as PrerenderError).problems;
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(
      /^src\/routes\/index\.stsx \(\/\): cookies\(\) reads the request.*LUM5001/,
    );
    expect(problems[1]).toMatch(
      /^src\/routes\/search\.stsx \(\/search\): url\(\)\.searchParams reads the request/,
    );
  });

  it("stops with LUM5005 for a static endpoint with other methods, before building", async () => {
    const root = project({
      "src/routes/api/subscribe.ts":
        "export function GET() { return new Response(); }\nexport function POST() { return new Response(); }\n",
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BuildError);
    expect((failure as Error).message).toContain("src/routes/api/subscribe.ts: LUM5005");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("requires staticPaths() for static routes with params and a 200 response", async () => {
    const root = project({
      "src/routes/blog/[slug].stsx": "export default function Post() { return <h1>Post</h1>; }\n",
      "src/routes/gone.stsx": `import { notFound } from "lumiose";
export default function Gone() { notFound(); }
`,
    });
    const failure = await build({ root, ...quiet() }).catch((error: unknown) => error);
    expect((failure as PrerenderError).problems).toEqual([
      expect.stringContaining(
        `src/routes/blog/[slug].stsx: "/blog/[slug]" is static and has params, so it needs`,
      ),
      "src/routes/gone.stsx (/gone): responded 404; prerendered routes must respond 200 or redirect.",
    ]);
  });
});
