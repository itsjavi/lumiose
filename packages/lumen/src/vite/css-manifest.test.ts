// The CSS manifest (TASK-19) through real Vite 8 client and server builds: every stylesheet is
// built in the client environment, the server build emits no CSS, and each route module maps to
// the client URLs of the stylesheets its static import graph reaches.
import {
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBuilder, createLogger } from "vite";
import { createDevServer } from "../app/dev/server.ts";
import type { CssManifestModule } from "./css-manifest.ts";
import { stylesheetImports } from "./scan.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const lumenRoot = resolve(import.meta.dirname, "../..");

const FILES: Record<string, string> = {
  "src/app.css": `body { margin: 0; }\n`,
  "src/routes/_layout.stsx": `import "../app.css";
export default function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="shell">
      {props.children}
      <style>.shell { display: grid; }</style>
    </div>
  );
}
`,
  "src/routes/index.stsx": `import { Suspense } from "lumen";
import { Card } from "../components/Card.stsx";
import { Late } from "../components/Late.stsx";
import { Counter } from "../components/Counter.stsx";
async function Slow() {
  await new Promise((done) => setTimeout(done, 1));
  return <Late />;
}
export default function Home() {
  return (
    <main>
      <Card />
      <Suspense fallback={<p>Loading</p>}><Slow /></Suspense>
      <Counter client:load start={1} />
    </main>
  );
}
`,
  "src/routes/about.stsx": `export default function About() {
  return <p>About</p>;
}
`,
  "src/components/Card.stsx": `export function Card() {
  return <article>Card<style>article { color: teal; }</style></article>;
}
`,
  "src/components/Late.stsx": `export function Late() {
  return <aside>Late<style>aside { color: olive; }</style></aside>;
}
`,
  "src/components/Counter.stsx": `import { signal } from "lumen";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return (
    <button onClick={() => count.update((n) => n + 1)}>
      {count()}
      <style>button { color: crimson; }</style>
    </button>
  );
}
`,
  "package.json": `{ "type": "module" }\n`,
  "vite.config.ts": `import lumen from "lumen/vite";
export default {
  base: "/app/",
  plugins: [lumen()],
  environments: {
    client: {
      build: { outDir: "dist/client", rolldownOptions: { input: { islands: "virtual:lumen/islands" } } },
    },
    ssr: {
      build: {
        outDir: "dist/server",
        sourcemap: true,
        rolldownOptions: { input: { entry: "server.ts" }, output: { entryFileNames: "entry.js" } },
      },
    },
  },
};
`,
  "server.ts": `import manifest, { stylesheets } from "virtual:lumen/css-manifest";
export { manifest, stylesheets };
export const routes = {
  "src/routes/_layout.stsx": () => import("./src/routes/_layout.stsx"),
  "src/routes/index.stsx": () => import("./src/routes/index.stsx"),
  "src/routes/about.stsx": () => import("./src/routes/about.stsx"),
};
`,
};

let root: string;
let server: {
  manifest: CssManifestModule["default"];
  stylesheets: CssManifestModule["stylesheets"];
};
const warnings: string[] = [];

function files(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" }).map((file) =>
    file.replaceAll("\\", "/"),
  );
}

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumen-css-manifest-")));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "junction");
  const logger = createLogger("silent");
  logger.warn = (message) => void warnings.push(message);
  // A config file is resolved again per environment: the plugin instance must still be shared.
  const builder = await createBuilder({
    root,
    configFile: join(root, "vite.config.ts"),
    customLogger: logger,
  });
  await builder.build(builder.environments.client!);
  await builder.build(builder.environments.ssr!);
  const entry = join(root, "dist/server/entry.js");
  server = await import(pathToFileURL(entry).href);
}, 60_000);

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!binding)("the CSS manifest", () => {
  it("maps each route module to the client stylesheets its static graph reaches", () => {
    const manifest = server.manifest;
    expect(Object.keys(manifest).toSorted()).toEqual([
      "src/routes/_layout.stsx",
      "src/routes/index.stsx",
    ]);
    // Import order: Card, Late (streamed inside Suspense, still linked in the shell), Counter.
    expect(manifest["src/routes/index.stsx"]!.map(css)).toEqual([
      expect.stringContaining("color:teal"),
      expect.stringContaining("color:olive"),
      expect.stringContaining("color:#dc143c"),
    ]);
    expect(manifest["src/routes/_layout.stsx"]!.map(css)).toEqual([
      expect.stringContaining("margin:0"),
      expect.stringContaining("display:grid"),
    ]);
    for (const href of Object.values(manifest).flat()) expect(href).toMatch(/^\/app\/assets\//);
    expect(warnings).toEqual([]);
  });

  it("deduplicates the stylesheets of a route's modules, in order", () => {
    const manifest = server.manifest;
    expect(
      server.stylesheets([
        "src/routes/_layout.stsx",
        "src/routes/index.stsx",
        "src/routes/_layout.stsx",
      ]),
    ).toEqual([...manifest["src/routes/_layout.stsx"]!, ...manifest["src/routes/index.stsx"]!]);
    expect(server.stylesheets(["src/routes/about.stsx", "missing.stsx"])).toEqual([]);
  });

  it("builds every stylesheet once, in the client environment only", () => {
    const client = files(join(root, "dist/client")).filter((file) => file.endsWith(".css"));
    expect(client.map((file) => file.replace(/-[\w-]{8}\.css$/, ".css")).toSorted()).toEqual([
      "assets/Card.css",
      "assets/Counter.css",
      "assets/Late.css",
      "assets/_layout.css",
      "assets/app.css",
    ]);
    // No empty JS for the stylesheet entries; the island chunk links its CSS through the
    // manifest's file, not a copy.
    const js = files(join(root, "dist/client")).filter((file) => file.endsWith(".js"));
    expect(js.some((file) => /\/(?:Card|Late|_layout|app)-/.test(file))).toBe(false);
    expect(
      client.filter(
        (file) =>
          css(`/app/${file}`).includes("crimson") || css(`/app/${file}`).includes("#dc143c"),
      ),
    ).toHaveLength(1);
    expect(files(join(root, "dist/server")).filter((file) => file.endsWith(".css"))).toEqual([]);
  });
});

describe.skipIf(!binding)("stylesheets in dev", () => {
  it("links them with the id of the client's CSS module, so an island never injects a copy", async () => {
    const dev = await createDevServer({ root, port: 0, customLogger: createLogger("silent") });
    try {
      const html = await (await fetch(new URL("/", dev.url))).text();
      const links = [
        ...html.matchAll(/<link rel="stylesheet" href="([^"]+)" data-vite-dev-id="([^"]+)">/g),
      ].map(([, href, id]) => ({ href: unescape(href!), id: unescape(id!) }));
      const style = "?lumen&type=style&lang.css";
      expect(links.map((link) => link.href)).toEqual(
        expect.arrayContaining([
          "/app/src/app.css",
          `/app/src/routes/_layout.stsx${style}`,
          `/app/src/components/Card.stsx${style}`,
          `/app/src/components/Late.stsx${style}`,
          `/app/src/components/Counter.stsx${style}`,
        ]),
      );
      // The island's client module imports the same CSS module: its update is skipped by the
      // Vite client because a <link> with that id exists, and style edits are CSS HMR.
      const counter = links.find((link) => link.href.includes("Counter.stsx"))!;
      expect(counter.id).toBe(`${root}/src/components/Counter.stsx${style}`);
      const island = await dev.vite.environments.client.transformRequest(
        "/src/components/Counter.stsx",
      );
      expect(island!.code).toContain(`import "${counter.href}"`);
      const cssModule = await dev.vite.environments.client.transformRequest(
        counter.href.slice("/app".length),
      );
      expect(cssModule!.code).toContain(`const __vite__id = ${JSON.stringify(counter.id)}`);
      expect(cssModule!.code).toContain("__vite__updateStyle(__vite__id, __vite__css)");
    } finally {
      await dev.close();
    }
    // Starting a dev server and rendering the page takes ~0.25 s alone and several times that
    // under full-suite parallelism plus a concurrent cargo build: Vitest's 5 s default flaked.
  }, 30_000);
});

/** The content of a built stylesheet, by URL. */
function css(href: string): string {
  return readFileSync(join(root, "dist/client", href.replace(/^\/app\//, "")), "utf8");
}

function unescape(attribute: string): string {
  return attribute.replaceAll("&amp;", "&");
}

describe("stylesheetImports", () => {
  it("finds static stylesheet imports, not @import, dynamic, ?inline or ?url ones", () => {
    const code = `import "./a.css";
import styles from "./b.module.css";
import inline from "./c.css?inline";
import url from "./d.css?url";
const lazy = import("./e.css");
const css = \`@import "./f.css";\`;
import { x } from "./g.ts";
import"pkg/theme.scss";`;
    expect(stylesheetImports(code)).toEqual(["./a.css", "./b.module.css", "pkg/theme.scss"]);
  });
});
