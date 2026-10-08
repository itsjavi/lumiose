// `lumen/vite` against a real Vite 8 dev server (client and ssr environments). The fixture app is
// written to a temp dir whose node_modules/lumen links to this package.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, createServer, type ViteDevServer } from "vite";
import lumen from "./index.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "Counter.stsx": `import { signal } from "lumen";
export function Counter() {
  const count = signal(0);
  return (
    <button onClick={() => count.update((c) => c + 1)}>
      Clicked {count()} times
      <style>button { color: crimson; }</style>
    </button>
  );
}
`,
  "main.tsx": `import { mount } from "lumen/dom";
import { Counter } from "./Counter.stsx";
mount(() => <Counter />, document.body);
`,
  "Broken.tsx": `export const ok = 1;
export const Broken = () => <div>;
`,
  "Warning.tsx": `export function Rows(props: { items: string[] }) {
  return (
    <ul>
      {props.items.map((item, i) => {
        const position = i;
        return <li>{item}{position}</li>;
      })}
    </ul>
  );
}
`,
  "util.ts": `export const answer: number = 42;\n`,
};

const lumenRoot = resolve(import.meta.dirname, "../..");
let root: string;
let server: ViteDevServer;
const warnings: string[] = [];

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-vite-")));
  for (const [name, code] of Object.entries(FILES)) writeFileSync(join(root, name), code);
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
  const logger = createLogger("silent");
  logger.warn = (message) => void warnings.push(message);
  server = await createServer({
    root,
    configFile: false,
    customLogger: logger,
    plugins: [lumen()],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
});

afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!binding)("lumen/vite", () => {
  it("compiles Lumen modules for the client environment, with a source map", async () => {
    const result = await server.environments.client.transformRequest("/Counter.stsx");
    expect(result!.code).toContain("template(");
    expect(result!.code).toContain("/packages/lumen/src/dom/index.ts");
    expect(result!.code).toContain("Counter.stsx?lumen&type=style&lang.css");
    const map = result!.map as { sources: string[]; mappings: string };
    expect(map.sources.some((source) => source.endsWith("Counter.stsx"))).toBe(true);
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it("compiles for lumen/server in the ssr environment", async () => {
    const result = await server.environments.ssr.transformRequest("/Counter.stsx");
    expect(result!.code).toContain("/packages/lumen/src/server/index.ts");
    expect(result!.code).toContain(".ssr)(");
    expect(result!.code).not.toContain("template");
  });

  it("resolves lumen's browser export on the client and its node export on the server", async () => {
    const importer = join(root, "Counter.stsx");
    const client = await server.environments.client.pluginContainer.resolveId("lumen", importer);
    const ssr = await server.environments.ssr.pluginContainer.resolveId("lumen", importer);
    expect(client!.id).toBe(join(lumenRoot, "src/index.ts"));
    expect(ssr!.id).toBe(join(lumenRoot, "src/index.server.ts"));
    expect(server.environments.ssr.config.resolve.noExternal).toContain("lumen");
    expect(server.environments.client.config.optimizeDeps.exclude).toContain("lumen");
  });

  it("keeps Vite's OXC transform away from Lumen modules only", async () => {
    expect(server.config.oxc && server.config.oxc.exclude).toEqual([/\.js$/, /\.(?:stsx|tsx)$/]);
    const result = await server.environments.client.transformRequest("/util.ts");
    expect(result!.code).toContain("export const answer = 42");
  });

  it("reports errors with a location and a code frame (the dev overlay)", async () => {
    const error = await server.environments.client.transformRequest("/Broken.tsx").then(
      () => undefined,
      (thrown: unknown) => thrown as Error & { plugin?: string; loc?: object; frame?: string },
    );
    expect(error).toBeDefined();
    expect(error!.plugin).toBe("lumen");
    expect(error!.message).toContain("LUM1001");
    expect(error!.loc).toMatchObject({ file: join(root, "Broken.tsx"), line: 2 });
    expect(error!.frame).toContain("export const Broken = () => <div>;");
  });

  it("reports warnings", async () => {
    await server.environments.client.transformRequest("/Warning.tsx");
    expect(warnings.some((w) => w.includes("LUM2006") && w.includes("Warning.tsx"))).toBe(true);
  });

  it("makes app entries HMR boundaries that re-mount through the wrapper", async () => {
    const result = await server.environments.client.transformRequest("/main.tsx");
    expect(result!.code).toContain("lumen:hmr-dom");
    expect(result!.code).toContain("import.meta.hot.accept()");
    const component = await server.environments.client.transformRequest("/Counter.stsx");
    expect(component!.code).not.toContain("import.meta.hot.accept");
    const ssr = await server.environments.ssr.transformRequest("/main.tsx");
    expect(ssr!.code).not.toContain("hmr-dom");
  });
});
