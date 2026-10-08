// `lumen build` end to end: Vite 8 client and server builds plus prerendering, on fixture apps
// written to temp dirs whose node_modules/lumen links to this package.
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
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "vite";
import { build, BuildError, type BuildOptions } from "./build.ts";
import { PrerenderError, type ServerEntryModule } from "./prerender.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const lumenRoot = resolve(import.meta.dirname, "../../..");
const roots: string[] = [];

const SITE: Record<string, string> = {
  "public/robots.txt": "User-agent: *\n",
  "src/middleware.ts": `import type { Middleware } from "lumen";
// Middleware runs while prerendering too, and may read the (empty) request.
const middleware: Middleware = (ctx, next) => {
  (ctx.locals as { theme?: string }).theme = ctx.cookies.get("theme") ?? "light";
  return next();
};
export default middleware;
`,
  "src/routes/_layout.stsx": `export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout"><nav><a href="/about">About</a></nav>{props.children}</div>;
}
`,
  "src/routes/index.stsx": `import { Suspense, Title } from "lumen";
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
  "src/components/Counter.stsx": `import { signal } from "lumen";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
  "src/routes/about.stsx": `export default function About() { return <h1>About</h1>; }
`,
  "src/routes/blog/[slug].stsx": `import { params } from "lumen";
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
  "src/routes/old.stsx": `import { redirect } from "lumen";
export default function Old() { throw redirect("/about"); }
`,
  "src/routes/sitemap.xml.ts": `export function GET(ctx: { url: URL }) {
  return new Response(\`<urlset><url>\${ctx.url.origin}/</url></urlset>\`, { headers: { "content-type": "application/xml" } });
}
`,
  "src/routes/live.stsx": `import { cookies, url } from "lumen";
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
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-build-")));
  roots.push(root);
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
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

describe.skipIf(!binding)("lumen build", () => {
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

    // dist/server/entry.js: `export default { fetch }` serves every route.
    const entry = await entryOf(root);
    const live = await entry.default.fetch(
      new Request("http://app.test/live?q=1", { headers: { cookie: "a=b" } }),
    );
    expect(await live.text()).toContain("<p>live b 1</p>");
    const posted = await entry.default.fetch(
      new Request("http://app.test/api/echo", { method: "POST" }),
    );
    expect(await posted.text()).toBe("posted");
    expect(entry.config).toEqual({ base: "/", trailingSlash: "ignore", assetsDir: "assets" });
  });

  it("applies Vite's base and trailingSlash: never", async () => {
    const root = project({
      ...SITE,
      "vite.config.ts": `import lumen from "lumen/vite";
export default { base: "/sub/", build: { outDir: "out" }, plugins: [lumen()] };
`,
    });
    const result = await build({ root, trailingSlash: "never", ...quiet() });
    expect(result.clientDir).toBe(join(root, "out/client"));
    const files = result.prerendered.map((file) => file.file);
    expect(files).toEqual(expect.arrayContaining(["index.html", "about.html", "blog/hello.html"]));
    const home = readFileSync(join(result.clientDir, "index.html"), "utf8");
    expect(home).toMatch(/<link rel="modulepreload" href="\/sub\/assets\/Counter-[\w-]+\.js">/);

    const entry = (await import(pathToFileURL(result.serverEntry).href)) as ServerEntryModule;
    expect(entry.config).toEqual({ base: "/sub/", trailingSlash: "never", assetsDir: "assets" });
    const about = await entry.default.fetch(new Request("http://app.test/sub/about/"));
    expect(about.status).toBe(308);
    expect(about.headers.get("location")).toBe("/sub/about");
    expect((await entry.default.fetch(new Request("http://app.test/about"))).status).toBe(404);
  });

  it("builds a site without islands or server routes to a self-contained dist/client", async () => {
    const root = project({
      "src/routes/index.stsx": "export default function Home() { return <h1>Static</h1>; }\n",
    });
    const result = await build({ root, ...quiet() });
    expect(readdirSync(result.clientDir).toSorted()).toEqual(["404.html", "index.html"]);
  });

  it("stops with LUM5001 when a prerendered route reads the request", async () => {
    const root = project({
      "src/routes/index.stsx": `import { cookies } from "lumen";
export default function Home() { return <p>{cookies().get("theme") ?? "light"}</p>; }
`,
      "src/routes/search.stsx": `import { url } from "lumen";
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
      "src/routes/gone.stsx": `import { notFound } from "lumen";
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
