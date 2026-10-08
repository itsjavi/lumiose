// The SPA entry module `virtual:lumen/spa` (owner: Spark; spec §7.5, §8 Build): generated from the
// route manifest by `lumen dev` and `lumen build`, which load it on pages that render an SPA
// instead of the island loader. It holds the client route table (every route, so that the router
// knows which URLs are not its own), a lazy import per SPA layout and page, and starts the router
// (./boot.ts) with the app's island manifest. A build where nothing hydrates (every SPA page is
// client-rendered and the island manifest is empty) starts it with ./csr.ts instead, which leaves
// the island loader and hydration out of the bundle.

import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin, type Rollup } from "vite";
import type { RouteManifest } from "../routes/manifest.ts";
import { ISLANDS } from "../../vite/islands.ts";
import { clientFiles, clientTable, spaHydrates } from "./table.ts";

export const SPA_ENTRY = "virtual:lumen/spa";
export const SPA_ENTRY_ID = "\0lumen:spa";
const BOOT = normalizePath(fileURLToPath(new URL("./boot.ts", import.meta.url)));
const CSR = normalizePath(fileURLToPath(new URL("./csr.ts", import.meta.url)));

type Manifest = Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;

/** Whether the app has `spa` pages (and so an SPA entry). */
export function hasSpa(manifest: Manifest): boolean {
  return manifest.routes.some((route) => route.kind === "page" && route.mode === "spa");
}

/**
 * The code of `virtual:lumen/spa` for a route manifest and Vite's `base`. With `csr`, the SPA starts
 * client-rendered without the island loader (only valid when nothing on its pages hydrates).
 */
export function spaEntryCode(manifest: Manifest, base: string, csr = false): string {
  const table = clientTable(manifest);
  if (table === undefined) return "export {};\n";
  const modules = clientFiles(table).map(
    (file) => `    ${JSON.stringify(file)}: () => import(${JSON.stringify(`/${file}`)}),`,
  );
  const config = `{
  base: ${JSON.stringify(base)},
  routes: ${JSON.stringify(table.routes)},
  notFoundPages: ${JSON.stringify(table.notFoundPages)},
  pages: ${JSON.stringify(table.pages)},
  modules: {
${modules.join("\n")}
  },
}`;
  return csr
    ? `import { startCsr } from ${JSON.stringify(CSR)};

startCsr(${config});
`
    : `import islands from "virtual:lumen/islands";
import { startSpa } from ${JSON.stringify(BOOT)};

startSpa(islands, ${config});
`;
}

/**
 * Serves `virtual:lumen/spa` in the client environment from the current route manifest (`undefined`
 * until the routes were scanned).
 */
export function spaEntryPlugin(manifest: () => Manifest | undefined): Plugin {
  return {
    name: "lumen:spa",
    resolveId: {
      filter: { id: /^virtual:lumen\/spa$|^\0lumen:spa$/ },
      handler: () => SPA_ENTRY_ID,
    },
    load: {
      filter: { id: /^\0lumen:spa$/ },
      async handler() {
        const current = manifest();
        if (current === undefined) throw new Error("lumen: the routes were not scanned.");
        // Builds only: in dev, islands can appear while the server runs.
        const csr =
          this.environment.mode === "build" &&
          !spaHydrates(current) &&
          !(await hasIslands(this as unknown as Rollup.PluginContext));
        return spaEntryCode(current, this.environment.config.base, csr);
      },
    },
  };
}

/** Whether the island manifest (`virtual:lumen/islands`, one lazy import per island) has islands. */
export async function hasIslands(context: Rollup.PluginContext): Promise<boolean> {
  const resolved = await context.resolve(ISLANDS);
  if (resolved === null) return true;
  const { code } = await context.load(resolved);
  return code === null || code.includes("import(");
}
