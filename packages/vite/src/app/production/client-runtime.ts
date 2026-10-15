// How `lumiose build` packages the client runtime (owner: Spark; TASK-91, spec §6 budgets: the
// 10 kB brotli cap applies to the runtime an app ships). Four changes to the client build:
//
// - One runtime chunk. Lumiose's modules (core, DOM, hydration, the island loader, the router) and
//   Vite's and Rolldown's client helpers go to one chunk instead of the shared chunks Rolldown
//   would cut by importer: a page loads all of them anyway, and one file compresses better and
//   needs no import lists between runtime chunks. When the app has only one client entry (the
//   island loader without `spa` pages, or the SPA entry without islands), the runtime goes into
//   that entry's chunk, so the page loads a single file before its islands or routes. The router's
//   History API fallback stays a chunk of its own: only browsers without the Navigation API load it.
// - Except the runtime that only one island needs (TASK-228). The runtime chunk holds what the
//   client entries import, plus the runtime that two or more lazy chunks (islands, SPA pages)
//   share. A runtime module that a single island (or SPA page) imports stays in that island's
//   chunk, which only the pages rendering it load: the keyed list selector of one island does not
//   grow the loader of every page with an island. The trade-off: runtime that several islands share
//   is in the runtime chunk, so a page with none of those islands loads it too, but no page loads
//   more files than it has islands (Rolldown would otherwise cut a chunk per set of islands, one
//   more request each). The public entries (`lumiose`, `lumiose/dom`) only re-export; they are
//   marked free of side effects so that an island's import reaches only the modules that declare
//   what it imports (./runtime-chunks.ts). One exception stays in the runtime chunk: the gate
//   between fetchJSON and its cache (`FOLDED` below).
// - Except the client helpers of `src/instrumentation.client.ts` (TASK-346). Vite's preload helper,
//   which every `import()` uses, is runtime by the rule above; a client entry with an `import()`
//   would then load the runtime chunk on pages without islands, which decision-49 rules out. Unless
//   the entry imports the runtime itself, its helpers go to its own chunk, or to a `helpers` chunk
//   when the runtime uses them too: one more small file on pages with islands.
// - An app without islands builds an empty island loader, so nothing lands in a chunk that
//   `lumiose build` removes afterwards.
// - A smaller preload helper. Vite wraps every dynamic `import()` in `__vitePreload`, which adds
//   `<link>` tags for the chunk's CSS and imports first. The replacement keeps that (stylesheets
//   it waits for, module preloads, deduplication, the CSP nonce of `<meta property="csp-nonce">`)
//   in about a third of the size. A stylesheet the page already holds in a merged file or an inline
//   `<style>` (`data-l-css`, ./stylesheets.ts) is not linked again.

import { LUMIOSE_SRC, runtimeFile } from "../../runtime-files.ts";
import { type Plugin } from "vite";
import { hasIslands, hasSpa, SPA_ENTRY_ID } from "../router/entry.ts";
import type { BuildState } from "./plugin.ts";
import { join } from "node:path";
import { barrel, clientEntryHelpers, singleEntryModules, type Barrel } from "./runtime-chunks.ts";

/** The island loader's client entries: `lumiose/dom/loader`, or the one that waits for the client entry. */
const ISLAND_LOADER = runtimeFile("dom/loader.ts");
export const CLIENT_LOADER = runtimeFile("app/client-loader.ts");
const isLoader = (id: string): boolean => id === ISLAND_LOADER || id === CLIENT_LOADER;
const PRELOAD_HELPER = "\0vite/preload-helper.js";
/** The router's History API fallback, loaded only without the Navigation API. */
const HISTORY_FALLBACK = runtimeFile("app/router/history.ts");
/**
 * Runtime modules that stay in the runtime chunk even when one island alone imports them, because
 * they read a flag of that chunk which the minifier folds only within one chunk. fetchJSON's cache
 * gate (app/cache/run-fetch.ts, TASK-233) reads `hasRuns` (core/effect.ts): `false` in apps without
 * async components or resources, so the minifier empties the gate and drops the cache. Imported from
 * another chunk the flag cannot be folded, and the island would load the dead cache: +1.4 kB brotli
 * on every page of ssg-travel-journal. fetchJSON itself follows the rule above.
 */
const FOLDED = new Set([runtimeFile("app/cache/run-fetch.ts")]);

export function clientRuntime(state: BuildState): Plugin {
  // Known once the client build transformed the island loader.
  let islands = true;
  // The runtime's re-export-only modules, and the runtime modules only one island or SPA page
  // imports: known once the client build parsed every module.
  const barrels = new Map<string, Barrel>();
  let single = new Set<string>();
  // The client helpers `src/instrumentation.client.ts` imports, when it imports no runtime.
  let helpers = { shared: new Set<string>(), own: new Set<string>() };
  const spa = (): boolean => state.app !== undefined && hasSpa(state.app.manifest);

  /** Whether module `id` goes to the runtime chunk. */
  const runtime = (id: string): boolean => {
    if (isLoader(id)) return islands && !spa();
    if (id === SPA_ENTRY_ID) return !islands && spa();
    if (helpers.shared.has(id) || helpers.own.has(id)) return false;
    return isRuntime(id) && (FOLDED.has(id) || !single.has(id));
  };

  return {
    name: "lumiose:client-runtime",
    apply: "build",
    enforce: "pre",

    config() {
      return {
        environments: {
          client: {
            build: {
              rolldownOptions: {
                output: {
                  codeSplitting: {
                    // A group takes the modules its own imports, unless an earlier group has them.
                    groups: [
                      { name: "helpers", test: (id) => helpers.shared.has(id) },
                      { name: "lumiose", test: runtime },
                    ],
                  },
                },
              },
            },
          },
        },
      };
    },

    transform: {
      filter: { id: new RegExp(`^${escape(LUMIOSE_SRC)}.*\\.ts$`) },
      async handler(code, id) {
        if (this.environment.name !== "client") return;
        if (isLoader(id)) {
          islands = await hasIslands(this);
          return islands ? undefined : { code: "export {};\n", map: null };
        }
        const exports = barrel(code);
        if (exports === undefined) return;
        barrels.set(id, exports);
        return { code, map: null, moduleSideEffects: false };
      },
    },

    async buildEnd(error) {
      if (this.environment.name !== "client" || error !== undefined) return;
      single = await singleEntryModules(
        {
          ids: this.getModuleIds(),
          info: (id) => this.getModuleInfo(id),
          resolve: async (source, importer) => (await this.resolve(source, importer))?.id ?? null,
        },
        barrels,
        (id) => isRuntime(id) && !isLoader(id),
      );
      if (state.clientEntryFile !== undefined) {
        helpers = clientEntryHelpers(
          { ids: this.getModuleIds(), info: (id) => this.getModuleInfo(id) },
          join(state.root, state.clientEntryFile),
          isHelper,
          isRuntime,
        );
      }
    },

    load: {
      filter: { id: exact(PRELOAD_HELPER) },
      handler() {
        if (this.environment.name !== "client") return;
        return { code: preloadHelper(this.environment.config.base) };
      },
    },
  };
}

/** Lumiose's modules and Vite's and Rolldown's client helpers, but the History API fallback. */
function isRuntime(id: string): boolean {
  if (id === HISTORY_FALLBACK) return false;
  return id.startsWith(LUMIOSE_SRC) || isHelper(id);
}

/** Vite's and Rolldown's client helpers (`__vitePreload`, …). */
function isHelper(id: string): boolean {
  return id.startsWith("\0vite/") || id.startsWith("\0rolldown/");
}

function exact(id: string): RegExp {
  return new RegExp(`^${escape(id)}$`);
}

function escape(id: string): string {
  return id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `__vitePreload(load, deps, importerUrl)`: Vite passes the files to fetch before `load()` (CSS and
 * the imports of the chunk), relative to `base`, or relative to `importerUrl` with a relative base.
 * A stylesheet that fails rejects the import; unlike Vite's helper, no `vite:preloadError` event
 * is dispatched (the router falls back to a document navigation when a page does not load).
 */
export function preloadHelper(base: string): string {
  return `const base = ${JSON.stringify(base)};
const seen = {};
export const __vitePreload = (load, deps, importer) =>
  Promise.all(
    (deps || []).map((dep) => {
      const href = new URL(importer ? dep : base + dep, importer || location.href).href;
      return (seen[href] ||= new Promise((resolve, reject) => {
        const css = href.endsWith(".css");
        if (css && !importer && document.querySelector('[data-l-css~="' + base + dep + '"]')) return resolve();
        for (const link of document.querySelectorAll("link")) {
          if (link.href === href && (!css || link.rel === "stylesheet")) return resolve();
        }
        const link = document.createElement("link");
        link.rel = css ? "stylesheet" : "modulepreload";
        link.crossOrigin = "";
        link.href = href;
        const nonce = document.querySelector("meta[property=csp-nonce]")?.nonce;
        if (nonce) link.nonce = nonce;
        if (css) {
          link.onload = resolve;
          link.onerror = () => reject(new Error(href), (seen[href] = undefined));
        } else resolve();
        document.head.append(link);
      }));
    }),
  ).then(load);
`;
}
