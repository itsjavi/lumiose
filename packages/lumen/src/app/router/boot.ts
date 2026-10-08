// The SPA entry's runtime (owner: Spark; spec §7.1, §7.5). Pages with an SPA load the SPA entry
// (`virtual:lumen/spa`, ./entry.ts) instead of the island loader: it runs the island loader with the
// app's island manifest plus the SPA root island, whose ref names the leaf the server rendered
// (`/<file>#lumen:spa`, hydrated) or the shell's (`/<file>#lumen:csr`, client-rendered). Once the
// first view's modules have loaded, the loader hydrates (or renders) the island with the router's
// root component. Islands outside the SPA (in the layouts the server renders around it) hydrate as
// usual.
import { loadIslands, type IslandManifest } from "../../dom/islands.ts";
import { createRouter, prepareRoot, type SpaConfig } from "./router.ts";
import { CSR_REF, SPA_REF } from "./table.ts";

export type { SpaConfig };

export function startSpa(islands: IslandManifest, config: SpaConfig): void {
  const manifest: IslandManifest = { ...islands };
  const leaves: Record<string, string> = {};
  for (const route of config.routes) {
    if (route.levels !== undefined) leaves[route.levels.at(-1)!] = route.app!;
  }
  for (const [file, page] of Object.entries(config.pages)) leaves[file] = page.app;
  for (const [leaf, app] of Object.entries(leaves)) {
    const start = (csr: boolean) => () => {
      createRouter(config, app);
      return prepareRoot(leaf, csr);
    };
    manifest[`/${leaf}${SPA_REF}`] = start(false);
    manifest[`/${leaf}${CSR_REF}`] = start(true);
  }
  loadIslands(manifest);
}
