// The SPA entry module `virtual:lumiose/spa` (owner: Spark; spec §7.5, §8 Build): generated from the
// route manifest by `lumiose dev` and `lumiose build`, which load it on pages that render an SPA
// instead of the island loader. It holds the client route table (every route, so that the router
// knows which URLs are not its own), a lazy import per SPA layout and page, `viewTransition()` with
// `lumiose({ viewTransitions: true })`, and starts the router (./boot.ts) with the app's island
// manifest. A build where nothing hydrates (every SPA page is client-rendered and the island
// manifest is empty) starts it with ./csr.ts instead, which leaves the island loader and hydration
// out of the bundle.

import { runtimeFile } from "../../runtime-files.ts";
import { type Plugin, type Rollup } from "vite";
import type { RouteManifest } from "lumiose/internal/app/routes/manifest.ts";
import { ISLANDS } from "../../islands.ts";
import type { ProjectOptions } from "../project.ts";
import { clientFiles, clientTable, spaHydrates } from "lumiose/internal/app/router/table.ts";

export const SPA_ENTRY = "virtual:lumiose/spa";
export const SPA_ENTRY_ID = "\0lumiose:spa";
const BOOT = runtimeFile("app/router/boot.ts");
const CSR = runtimeFile("app/router/csr.ts");
const VIEW_TRANSITION = runtimeFile("dom/view-transition.ts");

type Manifest = Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;

/** Whether the app has `spa` pages (and so an SPA entry). */
export function hasSpa(manifest: Manifest): boolean {
  return manifest.routes.some((route) => route.kind === "page" && route.mode === "spa");
}

export interface SpaEntryOptions {
  /** The SPA starts client-rendered without the island loader (only valid when nothing on its pages hydrates). */
  csr?: boolean;
  /** `lumiose({ viewTransitions: true })`: navigations swap pages inside `viewTransition()`, which the entry imports only then. */
  viewTransitions?: boolean;
}

/** The code of `virtual:lumiose/spa` for a route manifest and Vite's `base`. */
export function spaEntryCode(
  manifest: Manifest,
  base: string,
  { csr = false, viewTransitions = false }: SpaEntryOptions = {},
): string {
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
  },${viewTransitions ? "\n  viewTransition," : ""}
}`;
  const transition = viewTransitions
    ? `import { viewTransition } from ${JSON.stringify(VIEW_TRANSITION)};\n`
    : "";
  return csr
    ? `${transition}import { startCsr } from ${JSON.stringify(CSR)};

startCsr(${config});
`
    : `${transition}import islands from "virtual:lumiose/islands";
import { startSpa } from ${JSON.stringify(BOOT)};

startSpa(islands, ${config});
`;
}

/**
 * Serves `virtual:lumiose/spa` in the client environment from the current route manifest (`undefined`
 * until the routes were scanned).
 */
export function spaEntryPlugin(manifest: () => Manifest | undefined): Plugin {
  return {
    name: "lumiose:spa",
    resolveId: {
      filter: { id: /^virtual:lumiose\/spa$|^\0lumiose:spa$/ },
      handler: () => SPA_ENTRY_ID,
    },
    load: {
      filter: { id: /^\0lumiose:spa$/ },
      async handler() {
        const current = manifest();
        if (current === undefined) throw new Error("lumiose: the routes were not scanned.");
        // Builds only: in dev, islands can appear while the server runs.
        const csr =
          this.environment.mode === "build" &&
          !spaHydrates(current) &&
          !(await hasIslands(this as unknown as Rollup.PluginContext));
        const lumiose = this.environment.config.plugins.find((plugin) => plugin.name === "lumiose");
        const options = (lumiose?.api as { options?: ProjectOptions } | undefined)?.options;
        return spaEntryCode(current, this.environment.config.base, {
          csr,
          viewTransitions: options?.viewTransitions,
        });
      },
    },
  };
}

/** Whether the island manifest (`virtual:lumiose/islands`, one lazy import per island) has islands. */
export async function hasIslands(context: Rollup.PluginContext): Promise<boolean> {
  const resolved = await context.resolve(ISLANDS);
  if (resolved === null) return true;
  const { code } = await context.load(resolved);
  return code === null || code.includes("import(");
}
