// Client scripts of server-rendered components (TASK-354; the renderer's side is
// lumiose/src/server/client-script.ts). A component imports a module that must run in the browser
// on the pages that render the component, without the island runtime, such as the definition of a
// custom element it renders, through a marker, and calls what the marker exports when it renders:
//
//   import menuElement from "./menu.element.ts?lumiose-client";
//   export function MenuRoot(props) { menuElement(); return <lu-menu>…</lu-menu>; }
//
// - Client environments: the marker module imports the module, so it runs wherever the component's
//   client code does (islands, SPA pages), and exports a function that does nothing.
// - Server environments: the marker module exports a function that records the module's client URL,
//   and the chunks it imports, for the page being rendered (`clientScript()`): the page loads it
//   once, as a module script. The module itself never runs on the server.
// - Builds: the server graph does not exist yet when the client is built, so the client build
//   builds every module that a marker of the one-time scan names (./scan.ts) as an entry, and the
//   server build embeds its URL. A marker the scan did not see is a warning, and records nothing.
// - Dev: the URL is the module's own (root-relative, or `/@fs/` outside the root).
//
// `?lumiose-client` is an internal name until the user approves a public one (TASK-354).

import { basename, relative } from "node:path";
import { normalizePath, type Plugin, type ResolvedConfig, type Rollup } from "vite";
import { runtimeFile } from "./runtime-files.ts";
import type { ScannedModule } from "./scan.ts";

export const CLIENT_SCRIPT_QUERY = "?lumiose-client";
const PREFIX = "\0lumiose-client:";
const MARKER = /\?lumiose-client$/;
const MARKER_ID = /^\0lumiose-client:/;

export interface ClientScriptsOptions {
  /** `lumiose dev` (or any Vite dev server). */
  serve: () => boolean;
  /** The one-time scan of the project's modules. */
  scan: () => readonly ScannedModule[];
  /** Whether the build has a server environment (a client-only build records nothing). */
  hasServerBuild: (config: ResolvedConfig) => boolean;
}

/** A client script as the client build wrote it: its URL and those of the chunks it imports. */
interface Built {
  url: string;
  preloads: string[];
}

export function clientScriptsPlugin(options: ClientScriptsOptions): Plugin {
  /** Files the client build builds as entries. */
  const emitted = new Set<string>();
  const built = new Map<string, Built>();
  const warned = new Set<string>();
  /** Files that marker modules of a client environment import. */
  const scripts = new Set<string>();

  return {
    name: "lumiose:client-scripts",
    // Before Vite's resolver, which would resolve the marker to the module with a query.
    enforce: "pre",
    // The client build's URLs, for the server build.
    sharedDuringBuild: true,

    resolveId: {
      filter: { id: MARKER },
      async handler(source, importer) {
        const resolved = await this.resolve(
          source.slice(0, -CLIENT_SCRIPT_QUERY.length),
          importer,
          {
            skipSelf: true,
          },
        );
        if (resolved === null || resolved.external) return null;
        return PREFIX + resolved.id;
      },
    },

    load: {
      filter: { id: MARKER_ID },
      handler(id) {
        const file = id.slice(PREFIX.length);
        const config = this.environment.config;
        if (config.consumer === "client") {
          scripts.add(file);
          return `import ${JSON.stringify(file)};\nexport default function clientScript() {}\n`;
        }
        let script: Built | undefined;
        if (options.serve()) {
          script = { url: devUrl(file, config), preloads: [] };
        } else {
          script = built.get(file);
          if (script === undefined && !warned.has(file)) {
            warned.add(file);
            this.warn(
              `${normalizePath(relative(config.root, file))} is a client script (${CLIENT_SCRIPT_QUERY}), but the client build did not build it: the module that imports it is outside the project and its linked packages. Pages that render it do not load it.`,
            );
          }
        }
        if (script === undefined) return "export default function clientScript() {}\n";
        return `import { clientScript as record } from ${JSON.stringify(runtimeFile("server/client-script.ts"))};
export default function clientScript() {
  record(${JSON.stringify(script.url)}, ${JSON.stringify(script.preloads)});
}
`;
      },
    },

    // A script runs for its side effects, whatever its package's `sideEffects` says: islands and
    // SPA pages keep importing it.
    transform: {
      filter: { id: /\.[cm]?[jt]sx?$/ },
      handler(code, id) {
        if (options.serve() || !(emitted.has(id) || scripts.has(id))) return null;
        return { code, map: null, moduleSideEffects: true };
      },
    },

    async buildStart() {
      const environment = this.environment;
      if (options.serve() || environment.config.consumer !== "client") return;
      if (!options.hasServerBuild(environment.getTopLevelConfig())) return;
      emitted.clear();
      built.clear();
      warned.clear();
      for (const module of options.scan()) {
        for (const specifier of module.clientScripts ?? []) {
          const target = specifier.slice(0, -CLIENT_SCRIPT_QUERY.length);
          const resolved = await this.resolve(target, module.file);
          if (resolved !== null && !resolved.external) emitted.add(resolved.id);
        }
      }
      for (const id of [...emitted].toSorted()) {
        this.emitFile({ type: "chunk", id, name: chunkName(id), preserveSignature: false });
      }
    },

    generateBundle(_, bundle) {
      const config = this.environment.config;
      if (options.serve() || config.consumer !== "client" || emitted.size === 0) return;
      const chunks = new Map<string, Rollup.OutputChunk>();
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") chunks.set(file.fileName, file);
      }
      for (const entry of chunks.values()) {
        const id = entry.facadeModuleId;
        if (!entry.isEntry || id === null || !emitted.has(id)) continue;
        // When islands or SPA pages import the module too, Rolldown puts it in a chunk they share,
        // and the entry is a facade that only imports that chunk: pages load the chunk itself, the
        // file islands import, and the facade is not written.
        let chunk = entry;
        for (const other of chunks.values()) {
          if (other !== entry && other.moduleIds.includes(id)) chunk = other;
        }
        if (chunk !== entry) {
          delete bundle[entry.fileName];
          chunks.delete(entry.fileName);
        }
        // The chunks it imports, which the page modulepreloads with it.
        const preloads = new Set<string>();
        const visit = (name: string): void => {
          if (preloads.has(name) || name === chunk.fileName) return;
          preloads.add(name);
          for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
        };
        for (const imported of chunk.imports) visit(imported);
        built.set(id, {
          url: config.base + chunk.fileName,
          preloads: [...preloads].map((name) => config.base + name),
        });
      }
    },
  };
}

/** The URL the dev server serves `file` at. */
function devUrl(file: string, config: ResolvedConfig): string {
  const path = normalizePath(relative(config.root, file));
  if (!path.startsWith("../") && !/^[a-z]:/i.test(path)) return config.base + path;
  return `${config.base}@fs/${normalizePath(file).replace(/^\//, "")}`;
}

/** `menu.element.ts` → `menu.element`. */
function chunkName(id: string): string {
  const name = basename(id);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
