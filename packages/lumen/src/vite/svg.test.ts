// `.svg` imports (./svg.ts) against a real Vite 8 dev server: components for both environments,
// Vite's own `?url`/`?raw`, dependencies left alone, errors and options. The fixture app is written
// to a temp dir whose node_modules/lumen links to this package.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, createServer, type ViteDevServer } from "vite";
import lumen from "./index.ts";
import { svgOptionsOf, svgoConfigOf } from "./svg.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);

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
  "node_modules/dep/logo.svg": HOME,
  "render.tsx": `import { renderToString } from "lumen";
import Home from "./icons/home.svg";
import Inline from "./icons/home.svg?inline";
export const render = () =>
  renderToString(() => (
    <p>
      <Home title="Go home" class="icon" />
      <Inline width={16} aria-label="Home" />
    </p>
  ));
`,
};

const lumenRoot = resolve(import.meta.dirname, "../..");
let root: string;
let server: ViteDevServer;
let plain: ViteDevServer;
let custom: ViteDevServer;

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
  root = join(realpathSync(mkdtempSync(join(tmpdir(), "lumen-svg-"))), "app");
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
  server = await devServer({});
  plain = await devServer({ svg: false });
  custom = await devServer({ svg: { optimize: { plugins: [] }, currentColor: true } });
});

afterAll(async () => {
  await server?.close();
  await plain?.close();
  await custom?.close();
  if (root) rmSync(dirname(root), { recursive: true, force: true });
});

describe.skipIf(!binding)(".svg imports", () => {
  it("loads a project .svg as an inline component for the client", async () => {
    const result = await server.environments.client.transformRequest("/icons/home.svg");
    expect(result!.code).toContain("template(");
    expect(result!.code).toContain("/packages/lumen/src/dom/index.ts");
    expect(result!.code).toContain("M5 12H3l9-9 9 9h-2");
    // The file's own <title>, comments and prolog are gone (`title` is a prop).
    expect(result!.code).not.toMatch(/<\?xml|editor comment|>Home</);
  });

  it("compiles for lumen/server in the ssr environment, the same for ?inline", async () => {
    const svg = await server.environments.ssr.transformRequest("/icons/home.svg");
    const inline = await server.environments.ssr.transformRequest("/icons/home.svg?inline");
    expect(svg!.code).toContain("/packages/lumen/src/server/index.ts");
    expect(svg!.code).not.toContain("template(");
    expect(inline!.code).toBe(svg!.code);
  });

  it("server-renders the component with title and props", async () => {
    const { render } = (await server.ssrLoadModule("/render.tsx")) as {
      render: () => Promise<string>;
    };
    const html = await render();
    expect(html).toMatch(/<svg[^>]* role="img" aria-labelledby="l\w+-t-Go_home" class="icon">/);
    expect(html).toMatch(/<title id="l\w+-t-Go_home">Go home<\/title><path d="M5 12H3/);
    // A label from aria-label: not hidden; width overrides the file's.
    expect(html).toMatch(/<svg width="16"[^>]* aria-label="Home"/);
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("keeps Vite's ?url and ?raw", async () => {
    const url = await server.environments.client.transformRequest("/icons/home.svg?url");
    const raw = await server.environments.client.transformRequest("/icons/home.svg?raw");
    // A URL, or a data: URL for a file under Vite's assetsInlineLimit.
    expect(url!.code).toMatch(/^export default "(?:\/icons\/home\.svg|data:image\/svg\+xml,)/);
    expect(raw!.code).toContain("An editor comment");
  });

  it("leaves .svg files of dependencies to Vite", async () => {
    const result = await server.environments.client.transformRequest("/node_modules/dep/logo.svg");
    expect(result!.code).toContain("export default");
    expect(result!.code).not.toContain("template(");
  });

  it("reports a malformed file with its location", async () => {
    await expect(server.environments.client.transformRequest("/icons/broken.svg")).rejects.toThrow(
      /broken\.svg: invalid SVG: .* at 1:/,
    );
  });

  it("sanitises with any SVGO config; currentColor runs before its plugins", async () => {
    const mono = await custom.environments.client.transformRequest("/icons/mono.svg");
    // No SVGO plugin: the path data is the file's; scripts and handlers are still removed.
    expect(mono!.code).toContain("M8 0l0 16");
    expect(mono!.code).toContain("currentColor");
    expect(mono!.code).not.toMatch(/alert|onload/);
    const optimized = await server.environments.client.transformRequest("/icons/mono.svg");
    expect(optimized!.code).toContain("M8 0v16");
    expect(optimized!.code).not.toMatch(/alert|onload|currentColor/);
  });

  it("leaves every .svg import to Vite with svg: false", async () => {
    const result = await plain.environments.client.transformRequest("/icons/home.svg");
    expect(result!.code).toMatch(/^export default "(?:\/icons\/home\.svg|data:image\/svg\+xml,)/);
  });
});

describe("lumen({ svg })", () => {
  it("defaults and validates its options", () => {
    expect(svgOptionsOf(undefined)).toEqual({ optimize: true, currentColor: false });
    expect(svgOptionsOf(true)).toEqual({ optimize: true, currentColor: false });
    expect(svgOptionsOf(false)).toBe(false);
    expect(svgOptionsOf({ currentColor: true })).toEqual({ optimize: true, currentColor: true });
    expect(() => svgOptionsOf("yes")).toThrow(
      'lumen({ svg }): expected true, false or { optimize, currentColor }, got "yes".',
    );
    expect(() => svgOptionsOf({ optimise: false })).toThrow(
      "lumen({ svg.optimise }): unknown option. Known options: optimize, currentColor.",
    );
    expect(() => svgOptionsOf({ optimize: 1 })).toThrow(
      "lumen({ svg.optimize }): expected true, false or an SVGO config, got 1.",
    );
    expect(() => svgOptionsOf({ currentColor: "yes" })).toThrow(
      'lumen({ svg.currentColor }): expected true or false, got "yes".',
    );
    const config = { multipass: true, plugins: ["removeDimensions" as const] };
    expect(svgOptionsOf({ optimize: config })).toEqual({ optimize: config, currentColor: false });
    expect(() => lumen({ svg: { sprite: true } as never })).toThrow(/svg\.sprite/);
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
