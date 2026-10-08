// `lumen/vite` against a real Vite 8 dev server (client and ssr environments). The fixture app is
// written to a temp dir whose node_modules/lumen links to this package; node_modules/@acme/kit
// links a workspace package next to the app (outside the Vite root) with an island.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  build,
  createLogger,
  createServer,
  type HotPayload,
  type Rolldown,
  type ViteDevServer,
} from "vite";
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
  "tokens.ts": `export const theme = { accent: "rebeccapurple", gap: 4 } as const;\n`,
  "Themed.stsx": `import { theme } from "~/tokens.ts";
export function Themed() {
  return (
    <p class="themed">
      Hi
      <style>.themed { color: $theme.accent; padding: calc($theme.gap * 1px); }</style>
    </p>
  );
}
`,
  "components/Team.tsx": `export function TeamPanel(props: { ids: number[] }) {
  return <ul>{props.ids.map((id) => <li>{id}</li>)}</ul>;
}
`,
  "routes/index.tsx": `import { TeamPanel } from "../components/Team.tsx";
export default function Home() {
  return <main><TeamPanel client:visible ids={[1, 2]} /></main>;
}
`,
  "routes/kit.tsx": `import { Header } from "@acme/kit";
export default function Kit() {
  return <Header />;
}
`,
  "package.json": `{ "name": "app", "private": true, "dependencies": { "@acme/kit": "workspace:*" } }\n`,
};

/** A linked workspace package (`../kit`), whose island call site only the server graph reaches. */
const KIT: Record<string, string> = {
  "package.json": `{ "name": "@acme/kit", "type": "module", "exports": { ".": "./src/index.ts" }, "dependencies": { "lumen": "workspace:*" } }\n`,
  "src/index.ts": `export { Header } from "./Header.stsx";\n`,
  "src/Header.stsx": `import { Nav } from "./Nav.stsx";
export function Header() {
  return <header class="top"><Nav client:load /><style>.top { margin: 0; }</style></header>;
}
`,
  "src/Nav.stsx": `export function Nav() {
  return <nav>Docs</nav>;
}
`,
};

const lumenRoot = resolve(import.meta.dirname, "../..");
let base: string;
let root: string;
let kit: string;
let server: ViteDevServer;
const warnings: string[] = [];

beforeAll(async () => {
  if (!binding) return;
  base = realpathSync(mkdtempSync(join(tmpdir(), "lumen-vite-")));
  root = join(base, "app");
  kit = join(base, "kit");
  for (const [dir, files] of [
    [root, FILES],
    [kit, KIT],
  ] as const) {
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), code);
    }
    mkdirSync(join(dir, "node_modules"));
    symlinkSync(lumenRoot, join(dir, "node_modules/lumen"), "dir");
  }
  mkdirSync(join(root, "node_modules/@acme"));
  symlinkSync(kit, join(root, "node_modules/@acme/kit"), "dir");
  const logger = createLogger("silent");
  logger.warn = (message) => void warnings.push(message);
  server = await createServer({
    root,
    configFile: false,
    customLogger: logger,
    plugins: [lumen()],
    appType: "custom",
    resolve: { alias: { "~": root } },
    server: { middlewareMode: true, ws: false, watch: null },
  });
});

/** The HMR payloads sent to the client while `edit` runs (the watcher is driven by hand). */
async function hmrPayloads(file: string, edit: () => void): Promise<HotPayload[]> {
  const payloads: HotPayload[] = [];
  const hot = server.environments.client.hot;
  const send = hot.send;
  hot.send = ((payload: HotPayload) => void payloads.push(payload)) as typeof hot.send;
  try {
    edit();
    server.watcher.emit("change", join(root, file));
    await expect.poll(() => payloads.length).toBeGreaterThan(0);
  } finally {
    hot.send = send;
  }
  return payloads;
}

function updatedPaths(payloads: HotPayload[]): string[] {
  return payloads.flatMap((payload) =>
    payload.type === "update" ? payload.updates.map((update) => update.path) : [payload.type],
  );
}

const STYLE = "?lumen&type=style&lang.css";

afterAll(async () => {
  await server?.close();
  if (base) rmSync(base, { recursive: true, force: true });
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

  it("compiles island call sites with root-relative refs and serves the island manifest", async () => {
    const ssr = await server.environments.ssr.transformRequest("/routes/index.tsx");
    expect(ssr!.code).toContain('island)("/components/Team.tsx#TeamPanel"');
    const client = server.environments.client.pluginContainer;
    const manifest = await client.resolveId("virtual:lumen/islands");
    const loaded = await client.load(manifest!.id);
    const code = typeof loaded === "string" ? loaded : loaded!.code;
    expect(code).toContain(
      `"/components/Team.tsx#TeamPanel": () => import("/components/Team.tsx").then((m) => m["TeamPanel"]),`,
    );
  });

  it("names islands of linked packages package-relatively and scans their call sites", async () => {
    // No kit module has been transformed yet: the project scan found the call site.
    const client = server.environments.client.pluginContainer;
    const loaded = await client.load("\0lumen:islands");
    const code = typeof loaded === "string" ? loaded : loaded!.code;
    expect(code).toContain(
      `"@acme/kit/src/Nav.stsx#Nav": () => import(${JSON.stringify(`${kit}/src/Nav.stsx`)})`,
    );
    const ssr = await server.environments.ssr.transformRequest(`/@fs${kit}/src/Header.stsx`);
    expect(ssr!.code).toContain('island)("@acme/kit/src/Nav.stsx#Nav"');
    // Its JS and CSS hash the same package-relative path into the scope token.
    const token = /data-l-(\w+)/.exec(ssr!.code)![1];
    const css = await server.environments.client.transformRequest(
      `/@fs${kit}/src/Header.stsx${STYLE}`,
    );
    expect(css!.code).toContain(`[data-l-${token}]`);
  });

  it("builds every island into its own chunk from the manifest", async () => {
    const output = (await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [lumen()],
      build: {
        write: false,
        // App builds drop entry exports; the island loader is what imports the manifest.
        rolldownOptions: {
          input: { islands: "virtual:lumen/islands" },
          preserveEntrySignatures: "strict",
        },
      },
    })) as Rolldown.RolldownOutput;
    const chunks = output.output.filter((item) => item.type === "chunk");
    const manifest = chunks.find((chunk) => chunk.name === "islands")!;
    const team = chunks.find((chunk) => chunk.facadeModuleId?.endsWith("components/Team.tsx"))!;
    expect(team).toBeDefined();
    expect(manifest.code).toContain(`import(\`./${team.fileName.split("/").pop()}\`)`);
    expect(team.code).toContain("`<li>`");
    expect(team.exports).toEqual(["TeamPanel"]);
    // A linked package's island, reached only through the server graph, with a stable ref.
    const nav = chunks.find((chunk) => chunk.facadeModuleId === `${kit}/src/Nav.stsx`)!;
    expect(nav).toBeDefined();
    expect(manifest.code).toContain('"@acme/kit/src/Nav.stsx#Nav"');
    expect(manifest.code).toContain(`import(\`./${nav.fileName.split("/").pop()}\`)`);
    expect(manifest.code).not.toContain(base);
  });

  it("serves the scoped CSS of a file through Vite's CSS pipeline", async () => {
    const js = await server.environments.client.transformRequest("/Counter.stsx");
    const token = /data-l-[0-9a-z]{8}/.exec(js!.code)![0];
    const css = await server.environments.client.transformRequest(`/Counter.stsx${STYLE}`);
    // Vite's dev CSS module: the stylesheet injected by `updateStyle`, self-accepting.
    expect(css!.code).toContain(`button[${token}] {`);
    expect(css!.code).toContain("color: #dc143c;");
    expect(css!.code).toContain("updateStyle");
    // `<link rel="stylesheet">` requests (Accept: text/css) get plain CSS: Vite adds `direct`.
    const linked = await server.environments.client.transformRequest(
      `/Counter.stsx?direct&${STYLE.slice(1)}`,
    );
    expect(linked!.code).toContain(`button[${token}]`);
    expect(linked!.code).not.toContain("updateStyle");
    // The ssr environment loads the same CSS module (for the dev server's stylesheet links).
    const ssr = await server.environments.ssr.transformRequest(`/Counter.stsx${STYLE}`);
    expect(ssr).toBeTruthy();
  });

  it("folds imported constants through Vite's resolver and tracks them as CSS dependencies", async () => {
    const js = await server.environments.client.transformRequest("/Themed.stsx");
    expect(js!.code).not.toContain("tokens.ts");
    const css = await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    expect(css!.code).toContain("color: #639;");
    expect(css!.code).toContain("padding: 4px;");
    const graph = server.environments.client.moduleGraph;
    const cssModule = await graph.getModuleByUrl(`/Themed.stsx${STYLE}`);
    const imported = [...cssModule!.importedModules].map((mod) => mod.file);
    expect(imported).toContain(join(root, "tokens.ts"));
  });

  it("hot-updates only the CSS module when an edit only touches style blocks", async () => {
    const file = join(root, "Themed.stsx");
    const source = readFileSync(file, "utf8");
    await server.environments.client.transformRequest("/Themed.stsx");
    await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    const styleOnly = await hmrPayloads("Themed.stsx", () =>
      writeFileSync(file, source.replace("$theme.accent;", "$theme.accent; margin: 0;")),
    );
    expect(updatedPaths(styleOnly)).toEqual([`/Themed.stsx${STYLE}`]);
    const css = await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    expect(css!.code).toContain("margin: 0;");

    // A JS edit updates the module itself (here a full reload: no HMR boundary imports it).
    await server.environments.client.transformRequest("/Themed.stsx");
    await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    const jsEdit = await hmrPayloads("Themed.stsx", () =>
      writeFileSync(file, source.replace("Hi", "Hello")),
    );
    expect(updatedPaths(jsEdit)).toEqual(["full-reload"]);

    // A JS error the parser recovers from (same code): still a JS update, so the error shows.
    await hmrPayloads("Themed.stsx", () => writeFileSync(file, source));
    await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    const jsError = await hmrPayloads("Themed.stsx", () =>
      writeFileSync(file, source.replace("</p>", "</b>")),
    );
    expect(updatedPaths(jsError)).toEqual(["full-reload"]);
    writeFileSync(file, source);
  });

  it("reports style errors of a style-only edit from the CSS module", async () => {
    const file = join(root, "Themed.stsx");
    const source = readFileSync(file, "utf8");
    await server.environments.client.transformRequest("/Themed.stsx");
    await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    const payloads = await hmrPayloads("Themed.stsx", () =>
      writeFileSync(file, source.replace("$theme.accent;", "$nope;")),
    );
    expect(updatedPaths(payloads)).toEqual([`/Themed.stsx${STYLE}`]);
    const error = await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`).then(
      () => undefined,
      (thrown: unknown) => thrown as Error & { loc?: object },
    );
    expect(error!.message).toContain("LUM3008");
    expect(error!.loc).toMatchObject({ file, line: 6 });
    writeFileSync(file, source);
  });

  it("hot-updates the CSS of the files that read an edited constants module", async () => {
    const tokens = join(root, "tokens.ts");
    const source = readFileSync(tokens, "utf8");
    await server.environments.client.transformRequest("/Themed.stsx");
    await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    const payloads = await hmrPayloads("tokens.ts", () =>
      writeFileSync(tokens, source.replace("rebeccapurple", "teal")),
    );
    expect(updatedPaths(payloads)).toEqual([`/Themed.stsx${STYLE}`]);
    const css = await server.environments.client.transformRequest(`/Themed.stsx${STYLE}`);
    expect(css!.code).toContain("color: teal;");
    writeFileSync(tokens, source);
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
