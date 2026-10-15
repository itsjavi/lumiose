// Scoped state ids (TASK-193): which module-scope states get `$$id`, in which environment.
import { parseAst, type EnvironmentModuleGraph, type EnvironmentModuleNode } from "vite";
import { describe, expect, it } from "vitest";
import { Packages } from "./packages.ts";
import { StateRegistry, stableModuleId, stateBindings, statePlugin } from "./states.ts";

const bindings = (code: string) => stateBindings(parseAst(code));

describe("stateBindings", () => {
  it("finds module-scope defineState() bindings imported from lumiose, named by their export", () => {
    expect(
      bindings(`
        import { defineState, signal } from "lumiose";
        import { defineState as scoped } from "lumiose";
        export const cart = defineState(() => ({ items: signal([]) }));
        const theme = scoped(() => signal("dark")), other = signal(1);
        const local = defineState(() => 1);
        const shared = defineState(() => 2);
        export { theme as colors, shared };
        const fallback = defineState(() => 3);
        export default fallback;
        function later() { const inner = defineState(() => 4); return inner; }
      `),
    ).toEqual([
      { local: "cart", name: "cart" },
      { local: "theme", name: "colors" },
      { local: "local", name: "local" },
      { local: "shared", name: "shared" },
      { local: "fallback", name: "default" },
    ]);
  });

  it("ignores defineState from other modules", () => {
    expect(
      bindings(`import { defineState } from "./mine"; export const a = defineState(() => 1);`),
    ).toEqual([]);
    expect(bindings(`export const a = defineState(() => 1);`)).toEqual([]);
  });
});

describe("stableModuleId", () => {
  it("names modules like island refs: root-relative, then by the innermost package", () => {
    const packages = [
      { name: "@acme/kit", dir: "/repo/packages/kit/" },
      { name: "@acme/kit-icons", dir: "/repo/packages/kit/icons" },
    ];
    const id = (file: string) => stableModuleId(file, "/repo/apps/web", packages);
    expect(id("/repo/apps/web/src/lib/cart.ts")).toBe("/src/lib/cart.ts");
    expect(id("/repo/packages/kit/src/state.ts")).toBe("@acme/kit/src/state.ts");
    expect(id("/repo/packages/kit/icons/state.ts")).toBe("@acme/kit-icons/state.ts");
    expect(id("/elsewhere/state.ts")).toBe("/elsewhere/state.ts");
  });

  it("names a package installed under the root by its package, a root inside a package by the root", () => {
    const ui = "/app/node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui";
    const installed = [{ name: "@acme/ui", dir: ui }];
    expect(stableModuleId(`${ui}/dist/state.ts`, "/app", installed)).toBe("@acme/ui/dist/state.ts");
    expect(stableModuleId("/app/src/state.ts", "/app", installed)).toBe("/src/state.ts");
    const kit = [{ name: "@acme/kit", dir: "/repo/kit" }];
    expect(stableModuleId("/repo/kit/demo/src/a.ts", "/repo/kit/demo", kit)).toBe("/src/a.ts");
  });
});

describe("lumiose:state", () => {
  const root = "/app";
  const source = `import { defineState, signal } from "lumiose";
export const cart = defineState(() => ({ items: signal([]) }));
const panel = defineState(() => signal(false));
export { panel };
`;

  function plugin(serve: boolean) {
    const registry = new StateRegistry();
    const transform = statePlugin({
      registry,
      root: () => root,
      packages: () => new Packages(root, /node_modules/),
      serve: () => serve,
    }).transform as { handler: (code: string, id: string) => { code: string; map: null } | null };
    const run = (consumer: "client" | "server", code = source, id = "/app/src/lib/cart.ts") =>
      transform.handler.call({ environment: { config: { consumer } } }, code, id);
    return { registry, run };
  }

  it("appends the ids at the end, so no code moves (map: null)", () => {
    const { run } = plugin(false);
    expect(run("client")).toEqual({
      code: `${source}\ncart.$$id = "/src/lib/cart.ts#cart";\npanel.$$id = "/src/lib/cart.ts#panel";`,
      map: null,
    });
    expect(run("client", `export const a = 1; // defineState`)).toBe(null);
  });

  it("builds: the server gives ids only to states the client build compiled", () => {
    const { run } = plugin(false);
    expect(run("server")).toBe(null);
    run(
      "client",
      `import { defineState } from "lumiose";\nexport const panel = defineState(() => 1);`,
      "/app/src/lib/cart.ts",
    );
    expect(run("server")?.code).toBe(`${source}\npanel.$$id = "/src/lib/cart.ts#panel";`);
  });

  it("dev: the server gives every state its id and records its module for isClientState", () => {
    const { registry, run } = plugin(true);
    expect(run("server")?.code).toContain(`cart.$$id = "/src/lib/cart.ts#cart"`);
    expect(registry.files.get("/src/lib/cart.ts")).toBe("/app/src/lib/cart.ts");
  });
});

/** A module graph from `file → importers`. */
function graph(importers: Record<string, string[]>): EnvironmentModuleGraph {
  const nodes = new Map<string, EnvironmentModuleNode>();
  const node = (file: string): EnvironmentModuleNode => {
    let found = nodes.get(file);
    if (found === undefined) {
      found = { file, importers: new Set() } as unknown as EnvironmentModuleNode;
      nodes.set(file, found);
      for (const importer of importers[file] ?? []) found.importers.add(node(importer));
    }
    return found;
  };
  for (const file of Object.keys(importers)) node(file);
  return {
    getModulesByFile: (file: string) => (nodes.has(file) ? new Set([nodes.get(file)!]) : undefined),
  } as unknown as EnvironmentModuleGraph;
}

const isIsland = (file: string) => file === "/app/src/components/Badge.stsx";

describe("StateRegistry.reachable", () => {
  it("follows importers from the state's module to an island or SPA route module", () => {
    const registry = new StateRegistry();
    registry.files.set("/src/lib/cart.ts", "/app/src/lib/cart.ts");
    registry.files.set("/src/lib/note.ts", "/app/src/lib/note.ts");
    const modules = graph({
      "/app/src/lib/cart.ts": ["/app/src/lib/index.ts"],
      "/app/src/lib/index.ts": ["/app/src/components/Badge.stsx", "/app/src/routes/index.stsx"],
      "/app/src/lib/note.ts": ["/app/src/routes/index.stsx"],
      "/app/src/routes/index.stsx": [],
      "/app/src/components/Badge.stsx": ["/app/src/routes/index.stsx"],
    });
    expect(registry.reachable("/src/lib/cart.ts#cart", modules, isIsland)).toBe(true);
    expect(registry.reachable("/src/lib/note.ts#note", modules, isIsland)).toBe(false);
    expect(registry.reachable("/src/lib/gone.ts#gone", modules, isIsland)).toBe(false);
  });
});
