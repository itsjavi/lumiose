// How `lumen build` packages the client runtime (owner: Spark; TASK-91, spec §6 budgets: the
// 10 kB brotli cap applies to the runtime an app ships). Three changes to the client build:
//
// - One runtime chunk. Lumen's modules (core, DOM, hydration, the island loader, the router) and
//   Vite's and Rolldown's client helpers go to one chunk instead of the shared chunks Rolldown
//   would cut by importer: a page loads all of them anyway, and one file compresses better and
//   needs no import lists between runtime chunks. When the app has only one client entry (the
//   island loader without `spa` pages, or the SPA entry without islands), the runtime goes into
//   that entry's chunk, so the page loads a single file before its islands or routes. The router's
//   History API fallback stays a chunk of its own: only browsers without the Navigation API load it.
// - An app without islands builds an empty island loader, so nothing lands in a chunk that
//   `lumen build` removes afterwards.
// - A smaller preload helper. Vite wraps every dynamic `import()` in `__vitePreload`, which adds
//   `<link>` tags for the chunk's CSS and imports first. The replacement keeps that (stylesheets
//   it waits for, module preloads, deduplication, the CSP nonce of `<meta property="csp-nonce">`)
//   in about a third of the size. A stylesheet the page already holds in a merged file or an inline
//   `<style>` (`data-l-css`, ./stylesheets.ts) is not linked again.

import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { hasIslands, hasSpa, SPA_ENTRY_ID } from "../router/entry.ts";
import type { BuildState } from "./plugin.ts";

/** Lumen's source directory: every runtime module the client imports lives below it. */
const LUMEN_SRC = normalizePath(fileURLToPath(new URL("../../", import.meta.url)));
/** The island loader's client entry (`lumen/dom/loader`). */
const ISLAND_LOADER = `${LUMEN_SRC}dom/loader.ts`;
const PRELOAD_HELPER = "\0vite/preload-helper.js";
/** The router's History API fallback, loaded only without the Navigation API. */
const HISTORY_FALLBACK = `${LUMEN_SRC}app/router/history.ts`;

export function clientRuntime(state: BuildState): Plugin {
  // Known once the client build transformed the island loader.
  let islands = true;
  const spa = (): boolean => state.app !== undefined && hasSpa(state.app.manifest);

  /** Whether module `id` goes to the runtime chunk. */
  const runtime = (id: string): boolean => {
    if (id === ISLAND_LOADER) return islands && !spa();
    if (id === SPA_ENTRY_ID) return !islands && spa();
    if (id === HISTORY_FALLBACK) return false;
    return id.startsWith(LUMEN_SRC) || id.startsWith("\0vite/") || id.startsWith("\0rolldown/");
  };

  return {
    name: "lumen:client-runtime",
    apply: "build",
    enforce: "pre",

    config() {
      return {
        environments: {
          client: {
            build: {
              rolldownOptions: {
                output: { codeSplitting: { groups: [{ name: "lumen", test: runtime }] } },
              },
            },
          },
        },
      };
    },

    transform: {
      filter: { id: exact(ISLAND_LOADER) },
      async handler() {
        if (this.environment.name !== "client") return;
        islands = await hasIslands(this);
        return islands ? undefined : { code: "export {};\n", map: null };
      },
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

function exact(id: string): RegExp {
  return new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
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
