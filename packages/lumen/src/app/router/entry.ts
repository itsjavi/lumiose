// The SPA entry module `virtual:lumen/spa` (owner: Spark; spec §7.5, §8 Build): generated from the
// route manifest by `lumen dev` and `lumen build`, which load it on pages that render an SPA
// instead of the island loader. It holds the client route table (every route, so that the router
// knows which URLs are not its own), a lazy import per SPA layout and page, and starts the router
// (./boot.ts) with the app's island manifest.

import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import type { RouteManifest } from "../routes/manifest.ts";
import { clientFiles, clientTable } from "./table.ts";

export const SPA_ENTRY = "virtual:lumen/spa";
export const SPA_ENTRY_ID = "\0lumen:spa";
const BOOT = normalizePath(fileURLToPath(new URL("./boot.ts", import.meta.url)));

type Manifest = Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;

/** Whether the app has `spa` pages (and so an SPA entry). */
export function hasSpa(manifest: Manifest): boolean {
  return manifest.routes.some((route) => route.kind === "page" && route.mode === "spa");
}

/** The code of `virtual:lumen/spa` for a route manifest and Vite's `base`. */
export function spaEntryCode(manifest: Manifest, base: string): string {
  const table = clientTable(manifest);
  if (table === undefined) return "export {};\n";
  const modules = clientFiles(table).map(
    (file) => `    ${JSON.stringify(file)}: () => import(${JSON.stringify(`/${file}`)}),`,
  );
  return `import islands from "virtual:lumen/islands";
import { startSpa } from ${JSON.stringify(BOOT)};

startSpa(islands, {
  base: ${JSON.stringify(base)},
  routes: ${JSON.stringify(table.routes)},
  notFoundPages: ${JSON.stringify(table.notFoundPages)},
  pages: ${JSON.stringify(table.pages)},
  modules: {
${modules.join("\n")}
  },
});
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
      handler() {
        const current = manifest();
        if (current === undefined) throw new Error("lumen: the routes were not scanned.");
        return spaEntryCode(current, this.environment.config.base);
      },
    },
  };
}
