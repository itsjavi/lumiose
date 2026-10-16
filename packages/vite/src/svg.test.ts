// `.svg` imports (./svg.ts) against a real Vite 8 dev server: `?component` for both environments,
// from the project and from dependencies, Vite's own bare/`?url`/`?raw`/`?inline` imports, errors
// and options. The fixture app is written to a temp dir whose node_modules/lumiose links to this
// package.
import { linkLumiose } from "./test-links.ts";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, createServer, normalizePath, type ViteDevServer } from "vite";
import lumiose from "./index.ts";
import { svgOptionsOf, svgoConfigOf } from "./svg.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const HOME = `<?xml version="1.0"?>
<!-- An editor comment -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
  stroke="currentColor"><title>Home</title><path d="M5 12l-2 0l9 -9l9 9l-2 0"/></svg>
`;

const FILES: Record<string, string> = {
  "icons/home.svg": HOME,
  "icons/broken.svg": `<svg><path></svg>`,
  "icons/mono.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" onload="alert(1)">
  <script>alert(2)</script><path fill="#000000" d="M8 0l0 16"/></svg>`,
  // An icon set shipped as SVG files, like lucide-static.
  "node_modules/dep/package.json": `{ "name": "dep", "version": "1.0.0" }`,
  "node_modules/dep/logo.svg": HOME,
  "render.tsx": `import { renderToString } from "lumiose";
import Home from "./icons/home.svg?component";
import Logo from "dep/logo.svg?component";
export const render = () =>
  renderToString(() => (
    <p>
      <Home title="Go home" class="icon" />
      <Logo width={16} aria-label="Logo" />
    </p>
  ));
`,
  "client.ts": `import Logo from "dep/logo.svg?component";
export { Logo };
`,
};

let root: string;
let server: ViteDevServer;
let plain: ViteDevServer;
let custom: ViteDevServer;

async function devServer(options: Parameters<typeof lumiose>[0]): Promise<ViteDevServer> {
  return createServer({
    root,
    configFile: false,
    customLogger: createLogger("silent"),
    plugins: [lumiose(options)],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
    // No dependency pre-bundling: its writes to node_modules/.vite/deps could outlive close() and
    // make the cleanup fail with ENOTEMPTY (TASK-409).
    optimizeDeps: { noDiscovery: true, include: [] },
  });
}

beforeAll(async () => {
  if (!binding) return;
  // Native realpath (no 8.3 short names on Windows) and `/` separators, as Vite ids have.
  root = `${normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-svg-"))))}/app`;
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(`${root}/${name}`), { recursive: true });
    writeFileSync(`${root}/${name}`, code);
  }
  linkLumiose(root);
  server = await devServer({});
  plain = await devServer({ svg: false });
  custom = await devServer({ svg: { optimize: { plugins: [] }, currentColor: true } });
});

afterAll(async () => {
  await server?.close();
  await plain?.close();
  await custom?.close();
  // Retries cover a file still being written or released (ENOTEMPTY, EBUSY, EPERM on Windows).
  if (root) rmSync(dirname(root), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.skipIf(!binding)(".svg imports", () => {
  it("loads an .svg?component import as an inline component for the client", async () => {
    const result = await server.environments.client.transformRequest("/icons/home.svg?component");
    expect(result!.code).toContain("template(");
    expect(result!.code).toContain("/packages/lumiose/src/dom/index.ts");
    expect(result!.code).toContain("M5 12H3l9-9 9 9h-2");
    // The file's own <title>, comments and prolog are gone (`title` is a prop).
    expect(result!.code).not.toMatch(/<\?xml|editor comment|>Home</);
  });

  it("compiles for lumiose/server in the ssr environment", async () => {
    const svg = await server.environments.ssr.transformRequest("/icons/home.svg?component");
    expect(svg!.code).toContain("/packages/lumiose/src/server/index.ts");
    expect(svg!.code).not.toContain("template(");
  });

  it("loads a dependency's .svg?component, among the queries Vite adds", async () => {
    const client = await server.environments.client.transformRequest("/client.ts");
    const specifier = /"(\/node_modules\/dep\/logo\.svg\?[^"]+)"/.exec(client!.code)?.[1];
    expect(specifier).toMatch(/[?&]component(?:&|$)/);
    // The browser requests it with `import` (and `v=<hash>` for a dependency); Vite's middleware
    // drops `import` before the plugins see the id.
    const id = specifier!.replace(/([?&])import(?:&|$)/, "$1").replace(/[?&]$/, "");
    const logo = await server.environments.client.transformRequest(`${id}&v=0123abcd`);
    expect(logo!.code).toContain("template(");
  });

  it("server-renders the components with title and props", async () => {
    const { render } = (await server.ssrLoadModule("/render.tsx")) as {
      render: () => Promise<string>;
    };
    const html = await render();
    expect(html).toMatch(/<svg[^>]* role="img" aria-labelledby="l\w+-t-Go_home" class="icon">/);
    expect(html).toMatch(/<title id="l\w+-t-Go_home">Go home<\/title><path d="M5 12H3/);
    // The dependency's icon, labelled by aria-label: not hidden; width overrides the file's.
    expect(html).toMatch(/<svg width="16"[^>]* aria-label="Logo"/);
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("leaves bare, ?url, ?raw and ?inline imports to Vite", async () => {
    const client = server.environments.client;
    // A URL, or a data: URL for a file under Vite's assetsInlineLimit.
    const url = /^export default "(?:\/icons\/home\.svg|data:image\/svg\+xml,)/;
    expect((await client.transformRequest("/icons/home.svg"))!.code).toMatch(url);
    expect((await client.transformRequest("/icons/home.svg?url"))!.code).toMatch(url);
    expect((await client.transformRequest("/icons/home.svg?raw"))!.code).toContain(
      "An editor comment",
    );
    expect((await client.transformRequest("/icons/home.svg?inline"))!.code).toMatch(
      /^export default "data:image\/svg\+xml/,
    );
    const dependency = await client.transformRequest("/node_modules/dep/logo.svg");
    expect(dependency!.code).toMatch(/^export default "/);
  });

  it("reports a malformed file with its location", async () => {
    await expect(
      server.environments.client.transformRequest("/icons/broken.svg?component"),
    ).rejects.toThrow(/broken\.svg: invalid SVG: .* at 1:/);
  });

  it("sanitises with any SVGO config; currentColor runs before its plugins", async () => {
    const mono = await custom.environments.client.transformRequest("/icons/mono.svg?component");
    // No SVGO plugin: the path data is the file's; scripts and handlers are still removed.
    expect(mono!.code).toContain("M8 0l0 16");
    expect(mono!.code).toContain("currentColor");
    expect(mono!.code).not.toMatch(/alert|onload/);
    const optimized = await server.environments.client.transformRequest(
      "/icons/mono.svg?component",
    );
    expect(optimized!.code).toContain("M8 0v16");
    expect(optimized!.code).not.toMatch(/alert|onload|currentColor/);
  });

  it("leaves ?component imports to Vite with svg: false", async () => {
    const result = await plain.environments.client.transformRequest("/icons/home.svg?component");
    expect(result!.code).toMatch(/^export default "/);
    expect(result!.code).not.toContain("template(");
  });
});

describe("lumiose({ svg })", () => {
  it("defaults and validates its options", () => {
    expect(svgOptionsOf(undefined)).toEqual({ optimize: true, currentColor: false });
    expect(svgOptionsOf(true)).toEqual({ optimize: true, currentColor: false });
    expect(svgOptionsOf(false)).toBe(false);
    expect(svgOptionsOf({ currentColor: true })).toEqual({ optimize: true, currentColor: true });
    expect(() => svgOptionsOf("yes")).toThrow(
      'lumiose({ svg }): expected true, false or { optimize, currentColor }, got "yes".',
    );
    expect(() => svgOptionsOf({ optimise: false })).toThrow(
      "lumiose({ svg.optimise }): unknown option. Known options: optimize, currentColor.",
    );
    expect(() => svgOptionsOf({ optimize: 1 })).toThrow(
      "lumiose({ svg.optimize }): expected true, false or an SVGO config, got 1.",
    );
    expect(() => svgOptionsOf({ currentColor: "yes" })).toThrow(
      'lumiose({ svg.currentColor }): expected true or false, got "yes".',
    );
    const config = { multipass: true, plugins: ["removeDimensions" as const] };
    expect(svgOptionsOf({ optimize: config })).toEqual({ optimize: config, currentColor: false });
    expect(() => lumiose({ svg: { sprite: true } as never })).toThrow(/svg\.sprite/);
  });
});

describe("svgoConfigOf", () => {
  const path = "/app/icon.svg";
  it("uses the default preset, with currentColor as its convertColors override", () => {
    expect(svgoConfigOf({ optimize: true, currentColor: false }, path)).toEqual({
      path,
      plugins: ["convertStyleToAttrs", "preset-default", "convertStyleToAttrs"],
    });
    expect(svgoConfigOf({ optimize: true, currentColor: true }, path)!.plugins![1]).toEqual({
      name: "preset-default",
      params: { overrides: { convertColors: { currentColor: true } } },
    });
  });

  it("runs only convertColors, or nothing, without optimisation", () => {
    expect(svgoConfigOf({ optimize: false, currentColor: false }, path)).toBeNull();
    expect(svgoConfigOf({ optimize: false, currentColor: true }, path)).toEqual({
      path,
      plugins: [{ name: "convertColors", params: { currentColor: true } }],
    });
  });

  it("keeps a custom config, without datauri, and puts currentColor first", () => {
    const own = {
      multipass: true,
      datauri: "base64" as const,
      plugins: ["removeDimensions" as const],
    };
    expect(svgoConfigOf({ optimize: own, currentColor: false }, path)).toEqual({
      path,
      multipass: true,
      plugins: ["removeDimensions"],
    });
    expect(svgoConfigOf({ optimize: { floatPrecision: 2 }, currentColor: true }, path)).toEqual({
      path,
      floatPrecision: 2,
      plugins: [{ name: "convertColors", params: { currentColor: true } }, "preset-default"],
    });
  });
});
