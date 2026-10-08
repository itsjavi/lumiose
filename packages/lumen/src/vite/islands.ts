// The island manifest (spec §5.5, §7.4): `virtual:lumen/islands` maps every island ref
// (`<module>#<export>`, as in the server's island records) to a lazy import of the component:
//
//   export default { "/src/components/Team.stsx#TeamPanel": () => import("/src/components/Team.stsx").then((m) => m["TeamPanel"]) };
//
// The island loader (TASK-18) imports it in the client environment; in a client build each
// entry becomes its own chunk. Call sites are found in two ways: every Lumen module the plugin
// compiles reports its `meta.islands`, and the first load of the manifest compiles every Lumen
// module under the project root once, because route modules (where most call sites live) are in
// the server graph, which is built after the client.

import type { IslandMeta } from "@lumen/compiler";
import type { ScannedModule } from "./scan.ts";

export const ISLANDS = "virtual:lumen/islands";
export const ISLANDS_ID = "\0lumen:islands";

interface Island {
  module: string;
  export: string;
}

export class IslandRegistry {
  readonly #islands = new Map<string, Island>();
  #scanned = false;

  /** Records call sites; true when one of them is new. */
  add(islands: readonly IslandMeta[]): boolean {
    let added = false;
    for (const island of islands) {
      if (this.#islands.has(island.ref)) continue;
      this.#islands.set(island.ref, { module: island.module, export: island.export });
      added = true;
    }
    return added;
  }

  /** Records the call sites of every Lumen module under the root (./scan.ts), once. */
  scan(project: () => readonly ScannedModule[]): void {
    if (this.#scanned) return;
    this.#scanned = true;
    for (const module of project()) this.add(module.islands);
  }

  /** The manifest module, with refs in a stable order. */
  code(): string {
    const entries = [...this.#islands]
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([ref, island]) =>
          `  ${JSON.stringify(ref)}: () => import(${JSON.stringify(island.module)}).then((m) => m[${JSON.stringify(island.export)}]),`,
      );
    return `export default {\n${entries.join("\n")}\n};\n`;
  }
}
