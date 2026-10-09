// LUM4003 (spec §7.2, TASK-116): server-only modules never enter a client graph. A `*.server.*`
// file or a file under `src/server/` of the project (the compiler's rule, module_id.rs) may hold
// secrets; when the client environment reaches one (an island, an SPA route, a client entry or
// anything they import), `lumen build` fails and `lumen dev` reports the error, with the chain of
// importers from the client entry.
//
// - Build: at `buildEnd` of the client environment, every module of the graph is known with its
//   importers.
// - Dev: the client environment loads modules as the browser asks for them; the importers of a
//   module are in the module graph by the time it is requested.
//
// Stylesheets are not code: the CSS of a `.server.stsx` file is built in the client environment
// (./css-manifest.ts) and is allowed.

import { relative } from "node:path";
import { isCSSRequest, normalizePath, type Plugin, type Rollup } from "vite";
import { cleanId } from "./styles.ts";

export const SERVER_ONLY_CODE = "LUM4003";

/** Candidate ids for the hook filter; {@link isServerOnly} decides. */
const CANDIDATE = /\.server\.|\/src\/server\//;
const NODE_MODULES = /[\\/]node_modules[\\/]/;

/** Whether a module id names server-only code of the project at `root`. */
export function isServerOnly(id: string, root: string): boolean {
  if (id.startsWith("\0") || isCSSRequest(id)) return false;
  const file = normalizePath(cleanId(id));
  if (NODE_MODULES.test(file)) return false;
  const rest = relative(normalizePath(root), file).replaceAll("\\", "/");
  if (rest.startsWith("../") || rest.startsWith("/")) return false;
  const name = rest.slice(rest.lastIndexOf("/") + 1);
  return name.split(".").slice(1).includes("server") || rest.startsWith("src/server/");
}

/** The LUM4003 message: the server-only module and the chain of importers that reach it. */
export function serverOnlyMessage(chain: readonly string[], root: string): string {
  const shown = chain.map((id) => relative(root, cleanId(id)).replaceAll("\\", "/"));
  const module = shown.at(-1)!;
  return (
    `${SERVER_ONLY_CODE}: ${module} is server-only, but client code imports it:\n` +
    shown.map((id, i) => `  ${i === 0 ? "" : "→ "}${id}`).join("\n") +
    `\nhelp: keep server code on the server: call it through an endpoint or a form action ` +
    `(fetchJSON, submit()) from the client. Server-only: *.server.* files and src/server/.`
  );
}

/** The importer chain from an entry down to `id`, following the first importer of each module. */
export function importerChain(id: string, importers: (id: string) => readonly string[]): string[] {
  const chain = [id];
  const seen = new Set(chain);
  for (let current = id; ;) {
    const next = importers(current).find((importer) => !seen.has(importer));
    if (next === undefined) return chain.toReversed();
    chain.push(next);
    seen.add(next);
    current = next;
  }
}

export function serverOnlyPlugin(): Plugin {
  return {
    name: "lumen:server-only",
    enforce: "pre",
    load: {
      filter: { id: CANDIDATE },
      handler(id) {
        const environment = this.environment;
        if (environment.mode !== "dev" || environment.config.consumer !== "client") return null;
        const root = environment.config.root;
        if (!isServerOnly(id, root)) return null;
        const graph = environment.moduleGraph;
        const chain = importerChain(id, (current) =>
          [...(graph.getModuleById(current)?.importers ?? [])].flatMap((mod) =>
            mod.id === null ? [] : [mod.id],
          ),
        );
        this.error({ message: serverOnlyMessage(chain, root), id });
      },
    },
    buildEnd(error) {
      const environment = this.environment;
      if (error || environment.mode !== "build" || environment.config.consumer !== "client") return;
      const root = environment.config.root;
      const offenders = [...this.getModuleIds()].filter((id) => isServerOnly(id, root));
      if (offenders.length === 0) return;
      const importers = (id: string): readonly string[] => {
        const info: Rollup.ModuleInfo | null = this.getModuleInfo(id);
        return info === null ? [] : [...info.importers, ...info.dynamicImporters];
      };
      const messages = offenders.map((id) => serverOnlyMessage(importerChain(id, importers), root));
      this.error({ message: messages.join("\n\n"), id: offenders[0] });
    },
  };
}
