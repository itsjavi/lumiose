// The SPA entry's runtime (owner: Spark; spec §7.1, §7.5). Pages with an SPA load the SPA entry
// (`virtual:lumiose/spa`, ./entry.ts) instead of the island loader: it runs the island loader with the
// app's island manifest plus the SPA root island, whose ref names the leaf the server rendered
// (`/<file>#lumiose:spa`, hydrated) or the shell's (`/<file>#lumiose:csr`, client-rendered). Once the
// first view's modules have loaded, the loader hydrates (or renders) the island with the router's
// root component. Islands outside the SPA (in the layouts the server renders around it) hydrate as
// usual.
//
// A build whose SPA pages are all client-rendered and that has no islands starts with ./csr.ts.
// With `src/instrumentation.client.ts`, the entry passes `gate` (../client-entry.ts): the islands
// and the router's root wait for it (decision-49).
import { loadIslands, type IslandManifest } from "../../dom/islands.ts";
import { createRouter, prepareRoot, type SpaConfig } from "./router.ts";
import { leavesOf } from "./csr.ts";
import { CSR_REF, SPA_REF } from "./table.ts";

export type { SpaConfig };

export function startSpa(
  islands: IslandManifest,
  config: SpaConfig,
  gate?: (manifest: IslandManifest) => IslandManifest,
): void {
  const manifest: IslandManifest = { ...islands };
  for (const [leaf, app] of Object.entries(leavesOf(config))) {
    const start = (csr: boolean) => () => {
      createRouter(config, app);
      return prepareRoot(leaf, csr);
    };
    manifest[`/${leaf}${SPA_REF}`] = start(false);
    manifest[`/${leaf}${CSR_REF}`] = start(true);
  }
  loadIslands(gate === undefined ? manifest : gate(manifest));
}
