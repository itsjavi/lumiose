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

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compile, type IslandMeta } from "@lumen/compiler";

export const ISLANDS = "virtual:lumen/islands";
export const ISLANDS_ID = "\0lumen:islands";

/** Directories never scanned for call sites. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage"]);

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

  /** Compiles every Lumen module under `root` (once) and records its call sites. */
  scan(root: string, include: RegExp, exclude: RegExp): void {
    if (this.#scanned) return;
    this.#scanned = true;
    for (const file of lumenModules(root, include, exclude)) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const result = compile(source, file, { root, sourceMap: false, styleImport: false });
      this.add(result.meta.islands);
    }
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

function lumenModules(root: string, include: RegExp, exclude: RegExp): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !SKIPPED_DIRECTORIES.has(entry.name)) visit(path);
      } else if (entry.isFile() && include.test(path) && !exclude.test(path)) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}
