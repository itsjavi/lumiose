// The client scripts a build builds (TASK-542): those of the package modules the project uses, not
// every one a Lumiose package has. Fixture apps in temp dirs, built with `lumiose build`.
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
import { createLogger } from "vite";
import { build } from "./app/production/build.ts";

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

describe.skipIf(!binding)("client scripts of Lumiose packages", () => {
  it("builds only those of the components the app imports, through the package's index", async () => {
    const root = fixture(
      {
        "ui/package.json": JSON.stringify({
          name: "@acme/ui",
          type: "module",
          sideEffects: ["**/*.element.ts"],
          exports: { ".": "./src/index.ts", "./*": "./src/*.tsx" },
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
      },
      { "@acme/ui": "ui" },
    );
    const warnings = await buildQuietly(root);
    expect(warnings.filter((message) => message.includes("client script"))).toEqual([]);
    const built = assets(root).filter((file) => file.includes(".element-"));
    expect(built).toEqual([expect.stringMatching(/^lu-menu\.element-[\w-]{8}\.js$/)]);
    const html = readFileSync(join(root, "dist/client/index.html"), "utf8");
    expect(html).toContain("<lu-menu>Open</lu-menu>");
    expect(scripts(html)).toEqual([`/assets/${built[0]}`]);
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
