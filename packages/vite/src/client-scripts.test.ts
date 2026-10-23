// The client scripts a build builds (TASK-542): those of the package modules the project uses, not
// every one a Lumiose package has; and those that client code loads on the first call, when it
// only calls them conditionally (TASK-551). Fixture apps in temp dirs, built with `lumiose build`.
import { linkLumiose, LUMIOSE_ROOT } from "./test-links.ts";
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
import { dirname, isAbsolute, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createLogger, createServer, parseAst } from "vite";
import { build } from "./app/production/build.ts";
import { conditionalClientScripts } from "./client-scripts.ts";
import lumiose from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const bases: string[] = [];

afterAll(() => {
  for (const base of bases) rmSync(base, { recursive: true, force: true });
});

/**
 * Writes `files` below a temp dir and returns its `app` directory, whose `node_modules` links
 * Lumiose and `packages` (name → directory, absolute or one of the temp dir's, which gets Lumiose
 * linked too).
 */
function fixture(files: Record<string, string>, packages: Record<string, string>): string {
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-client-scripts-")));
  bases.push(base);
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(base, name)), { recursive: true });
    writeFileSync(join(base, name), code);
  }
  const root = join(base, "app");
  linkLumiose(root);
  for (const [name, path] of Object.entries(packages)) {
    const dir = isAbsolute(path) ? path : join(base, path);
    if (!isAbsolute(path)) linkLumiose(dir);
    mkdirSync(dirname(join(root, "node_modules", name)), { recursive: true });
    symlinkSync(dir, join(root, "node_modules", name), "junction");
  }
  return root;
}

/** Builds `root`, returning the build's warnings. */
async function buildQuietly(root: string): Promise<string[]> {
  const logger = createLogger("silent");
  const warn = vi.spyOn(logger, "warn");
  await build({ root, customLogger: logger, logLevel: "silent" });
  return warn.mock.calls.map(([message]) => String(message));
}

const scripts = (html: string) =>
  [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g)].map((match) => match[1]);
const assets = (root: string) => readdirSync(join(root, "dist/client/assets"));

/** A custom element definition: a client script. */
const element = (tag: string) => `import { key } from "./keys.ts";
customElements.define("${tag}", class extends HTMLElement { key = key; });
`;
/** A component rendering `<tag>`, with its definition as a client script. */
const component = (name: string, tag: string) => `import define from "./${tag}.element.ts?client";
export function ${name}(props: { children?: JSX.Element }) {
  define();
  return <${tag}>{props.children}</${tag}>;
}
`;

/** `@acme/ui`, with three components behind an index, and an app that renders its Menu. */
const acme = (exports: unknown): Record<string, string> => ({
  "ui/package.json": JSON.stringify({
    name: "@acme/ui",
    type: "module",
    sideEffects: ["**/*.element.ts"],
    exports,
    peerDependencies: { lumiose: "*" },
  }),
  "ui/src/index.ts": `export { Menu } from "./menu.tsx";
export { Dialog } from "./dialog.tsx";
export * from "./more.ts";
`,
  "ui/src/more.ts": `export { Tabs } from "./tabs.tsx";\n`,
  "ui/src/keys.ts": `export const key = "Enter";\n`,
  "ui/src/menu.tsx": component("Menu", "lu-menu"),
  "ui/src/dialog.tsx": component("Dialog", "lu-dialog"),
  "ui/src/tabs.tsx": component("Tabs", "lu-tabs"),
  "ui/src/lu-menu.element.ts": element("lu-menu"),
  "ui/src/lu-dialog.element.ts": element("lu-dialog"),
  "ui/src/lu-tabs.element.ts": element("lu-tabs"),
  "app/package.json": JSON.stringify({
    name: "fixture",
    type: "module",
    dependencies: { "@acme/ui": "*" },
  }),
  "app/src/routes/page.stsx": `import { Menu } from "@acme/ui";
export default function Home() { return <main><Menu>Open</Menu></main>; }
`,
});

describe.skipIf(!binding)("client scripts of Lumiose packages", () => {
  it("builds only those of the components the app imports, through the package's index", async () => {
    const root = fixture(acme({ ".": "./src/index.ts", "./*": "./src/*.tsx" }), {
      "@acme/ui": "ui",
    });
    const warnings = await buildQuietly(root);
    expect(warnings.filter((message) => message.includes("client script"))).toEqual([]);
    const built = assets(root).filter((file) => file.includes(".element-"));
    expect(built).toEqual([expect.stringMatching(/^lu-menu\.element-[\w-]{8}\.js$/)]);
    const html = readFileSync(join(root, "dist/client/index.html"), "utf8");
    expect(html).toContain("<lu-menu>Open</lu-menu>");
    expect(scripts(html)).toEqual([`/assets/${built[0]}`]);
  });

  it("builds all of a package's scripts when it may resolve otherwise on the server", async () => {
    // The client build follows the browser's resolution; pages render with the server's.
    const root = fixture(acme({ ".": { browser: "./src/index.ts", default: "./src/index.ts" } }), {
      "@acme/ui": "ui",
    });
    await buildQuietly(root);
    const built = assets(root)
      .filter((file) => file.includes(".element-"))
      .map((file) => file.replace(/-[\w-]{8}\.js$/, ""));
    expect(built).toEqual(["lu-dialog.element", "lu-menu.element", "lu-tabs.element"]);
  });

  it("builds one @lumiose/ui script for an app that renders Tabs", async () => {
    const root = fixture(
      {
        "app/package.json": JSON.stringify({
          name: "fixture",
          type: "module",
          dependencies: { "@lumiose/ui": "*" },
        }),
        "app/src/routes/page.stsx": `import { Tabs } from "@lumiose/ui";
export default function Home() {
  return (
    <Tabs.Root defaultValue="a">
      <Tabs.List><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="a">Panel</Tabs.Panel>
    </Tabs.Root>
  );
}
`,
      },
      { "@lumiose/ui": realpathSync(join(LUMIOSE_ROOT, "../ui")) },
    );
    const warnings = await buildQuietly(root);
    expect(warnings.filter((message) => message.includes("client script"))).toEqual([]);
    const built = assets(root).filter((file) => /\.script-[\w-]{8}\.js$/.test(file));
    expect(built).toEqual([expect.stringMatching(/^tabs\.script-/)]);
    const html = readFileSync(join(root, "dist/client/index.html"), "utf8");
    expect(scripts(html)).toEqual([`/assets/${built[0]}`]);
  });
});

const conditional = (code: string) => conditionalClientScripts(parseAst(code, { lang: "tsx" }));

describe("conditionalClientScripts", () => {
  it("finds the scripts a module calls only under a condition", () => {
    expect(
      conditional(`import a from "./a.ts?client";
import b from "./b.ts?client";
import c from "./c.ts?client";
import d from "./d.ts?client";
export function Part(props) {
  a();
  if (props.hover) b();
  props.modal && c();
  const style = () => (d(), {});
  return <i style={style()} />;
}
`),
    ).toEqual(["./b.ts?client", "./c.ts?client", "./d.ts?client"]);
  });

  it("leaves those it calls as a statement of their own, or uses otherwise, to load with it", () => {
    expect(
      conditional(`import a from "./a.ts?client";
import b from "./b.ts?client";
import c from "./c.ts?client";
import d from "./d.ts?client";
import "./e.ts?client";
import * as f from "./f.ts?client";
a();
export const Part = () => {
  if (open) b();
  b();
  effect(() => {
    c();
  });
  register(d);
  return f;
};
`),
    ).toEqual([]);
  });

  it("does not count property names as uses", () => {
    expect(
      conditional(`import a from "./a.ts?client";
const parts = { a: 1, b() { return parts.a; } };
if (open) a();
`),
    ).toEqual(["./a.ts?client"]);
  });
});

/** The JS a page loads statically: its module scripts, its modulepreloads and their imports. */
function staticClosure(root: string, html: string): string[] {
  const urls = [
    ...scripts(html),
    ...[...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((match) => match[1]),
  ];
  return withImports(
    root,
    urls.map((url) => url!.slice("/assets/".length)),
  );
}

/** `chunks` and the chunks they import statically. */
function withImports(root: string, chunks: readonly string[]): string[] {
  const seen = new Set<string>();
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const code = readFileSync(join(root, "dist/client/assets", name), "utf8");
    for (const match of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) visit(match[1]!);
  };
  for (const chunk of chunks) visit(chunk);
  return [...seen].toSorted();
}

/** The files `chunk` imports with `import()`. */
function dynamicImports(root: string, chunk: string): string[] {
  const code = readFileSync(join(root, "dist/client/assets", chunk), "utf8");
  return [...code.matchAll(/import\(\s*[`"']\.\/([^`"']+\.js)[`"']\s*\)/g)].map((m) => m[1]!);
}

describe.skipIf(!binding)("client scripts that islands call conditionally (TASK-551)", () => {
  it("load when an island calls them, not with its code", async () => {
    // Menu calls the hover script only with `hover`; Card calls it as a statement of its own.
    const root = fixture(
      {
        "app/package.json": JSON.stringify({ name: "fixture", type: "module" }),
        "app/src/ui/keys.ts": `export const key = "Enter";\n`,
        "app/src/ui/lu-menu.element.ts": element("lu-menu"),
        "app/src/ui/lu-hover.element.ts": element("lu-hover"),
        "app/src/ui/Menu.tsx": `import define from "./lu-menu.element.ts?client";
import hover from "./lu-hover.element.ts?client";
export function Menu(props: { hover?: boolean; children?: JSX.Element }) {
  define();
  if (props.hover) hover();
  return <lu-menu>{props.children}</lu-menu>;
}
`,
        "app/src/ui/Card.tsx": `import hover from "./lu-hover.element.ts?client";
export function Card() {
  hover();
  return <lu-hover>Card</lu-hover>;
}
`,
        "app/src/islands/Plain.tsx": `import { Menu } from "../ui/Menu.tsx";
export function Plain() { return <Menu>Plain</Menu>; }
`,
        "app/src/islands/Hover.tsx": `import { Menu } from "../ui/Menu.tsx";
export function Hover() { return <Menu hover>Hover</Menu>; }
`,
        "app/src/islands/Cards.tsx": `import { Card } from "../ui/Card.tsx";
export function Cards() { return <Card />; }
`,
        "app/src/routes/page.stsx": `import { Plain } from "../islands/Plain.tsx";
export default function Home() { return <main><Plain client:load /></main>; }
`,
        "app/src/routes/hover/page.stsx": `import { Hover } from "../../islands/Hover.tsx";
export default function Page() { return <main><Hover client:load /></main>; }
`,
        "app/src/routes/cards/page.stsx": `import { Cards } from "../../islands/Cards.tsx";
export default function Page() { return <main><Cards client:load /></main>; }
`,
      },
      {},
    );
    expect((await buildQuietly(root)).filter((message) => message.includes("client"))).toEqual([]);
    const menu = assets(root).find((name) => name.startsWith("lu-menu.element-"))!;
    const defines = (chunks: readonly string[], tag: string) =>
      withImports(root, chunks).some((name) =>
        new RegExp(`customElements\\.define\\(["'\`]${tag}["'\`]`).test(
          readFileSync(join(root, "dist/client/assets", name), "utf8"),
        ),
      );

    // The island without `hover` loads Menu's script with its code, and the hover script only
    // through the call, which it never makes; neither does its server HTML.
    const home = readFileSync(join(root, "dist/client/index.html"), "utf8");
    const loaded = staticClosure(root, home);
    expect(loaded).toContain(menu);
    expect(defines(loaded, "lu-hover")).toBe(false);
    expect(scripts(home).filter((url) => url!.includes(".element-"))).toEqual([`/assets/${menu}`]);
    // The call imports a file the build wrote, which defines the element, also when Card's island
    // imports the script with its code (a chunk they share). (The loader imports the islands.)
    const lazy = loaded
      .flatMap((name) => dynamicImports(root, name))
      .filter((name) => !/^(?:Plain|Hover|Cards)-/.test(name));
    expect(lazy).toHaveLength(1);
    expect(assets(root)).toContain(lazy[0]);
    expect(defines(lazy, "lu-hover")).toBe(true);

    // A page whose island calls it gets it as a module script, from its server HTML.
    const page = readFileSync(join(root, "dist/client/hover/index.html"), "utf8");
    expect(scripts(page)).toHaveLength(3);
    expect(defines(staticClosure(root, page), "lu-hover")).toBe(true);
    // So does a page whose island imports it with its code.
    const cards = readFileSync(join(root, "dist/client/cards/index.html"), "utf8");
    expect(defines(staticClosure(root, cards), "lu-hover")).toBe(true);
  });

  it("load on the first call in dev too", async () => {
    const root = fixture(
      {
        "app/package.json": JSON.stringify({ name: "fixture", type: "module" }),
        "app/src/ui/Menu.tsx": `import define from "./lu-menu.element.ts?client";
import hover from "./lu-hover.element.ts?client";
export function Menu(props: { hover?: boolean }) {
  define();
  if (props.hover) hover();
  return <lu-menu />;
}
`,
        "app/src/ui/lu-menu.element.ts": `customElements.define("lu-menu", class extends HTMLElement {});\n`,
        "app/src/ui/lu-hover.element.ts": `customElements.define("lu-hover", class extends HTMLElement {});\n`,
      },
      {},
    );
    const server = await createServer({
      root,
      configFile: false,
      plugins: [lumiose()],
      appType: "custom",
      logLevel: "silent",
      server: { middlewareMode: true, ws: false, watch: null },
    });
    try {
      const client = server.environments.client;
      const menu = (await client.transformRequest("/src/ui/Menu.tsx"))!.code;
      const imports = [...menu.matchAll(/import \w+ from "([^"]+)"/g)].map((m) => m[1]!);
      const eager = imports.find((url) => url.includes("lumiose:client-script:"))!;
      const lazy = imports.find((url) => url.includes("lumiose:client-script-lazy:"))!;
      expect(eager).toContain("lu-menu.element.ts");
      expect(lazy).toContain("lu-hover.element.ts");
      // As the dev server's middleware unwraps a virtual module's URL.
      const code = async (url: string) =>
        (await client.transformRequest(url.replace(/^\/@id\/__x00__/, "\0")))!.code;
      expect(await code(eager)).toContain('import "/src/ui/lu-menu.element.ts"');
      expect(await code(lazy)).toContain('import("/src/ui/lu-hover.element.ts")');
    } finally {
      await server.close();
    }
  });

  it("keeps Popover's hover and modal scripts out of an island with a plain Popover", async () => {
    const root = fixture(
      {
        "app/package.json": JSON.stringify({
          name: "fixture",
          type: "module",
          dependencies: { "@lumiose/ui": "*" },
        }),
        "app/src/islands/Filters.tsx": `import { Popover } from "@lumiose/ui";
export function Filters() {
  return (
    <Popover.Root>
      <Popover.Trigger>Filters</Popover.Trigger>
      <Popover.Popup>Pick some</Popover.Popup>
    </Popover.Root>
  );
}
`,
        "app/src/routes/page.stsx": `import { Filters } from "../islands/Filters.tsx";
export default function Home() { return <main><Filters client:load /></main>; }
`,
      },
      { "@lumiose/ui": realpathSync(join(LUMIOSE_ROOT, "../ui")) },
    );
    await buildQuietly(root);
    const html = readFileSync(join(root, "dist/client/index.html"), "utf8");
    const loaded = staticClosure(root, html);
    expect(loaded.filter((name) => name.includes(".script-"))).toEqual([
      expect.stringMatching(/^popover\.script-/),
    ]);
    const island = loaded.find((name) => name.startsWith("Filters-"))!;
    expect(dynamicImports(root, island).toSorted()).toEqual([
      expect.stringMatching(/^dialog\.script-/),
      expect.stringMatching(/^popover-hover\.script-/),
    ]);
  });
});
