// The Vite side of `lumen build` (spec §8 Build): environment build options and the generated
// server entry. `build()` (./build.ts) runs the client environment, then the server environment,
// then prerenders; this plugin only shapes the two builds.
//
// - client → `dist/client`: the island manifest (`virtual:lumen/islands`, one chunk per island),
//   SPA entries once TASK-25 lands, assets and `public/`.
// - ssr → `dist/server/entry.js` (`virtual:lumen/server-entry`): the route manifest, a lazy
//   import per route module, the middleware and the document, the island URLs of the client
//   build, and `export default { fetch }` from `createAppHandler()`.

import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { normalizePath, type Plugin, type ResolvedConfig } from "vite";
import { ISLANDS } from "../../vite/islands.ts";
import type { RouteManifest } from "../routes/manifest.ts";
import type { BuiltAppConfig } from "../server/app.ts";
import type { CsrfOptions } from "../server/csrf.ts";
import type { TrailingSlash } from "../server/handler.ts";

export const SERVER_ENTRY = "virtual:lumen/server-entry";
const SERVER_ENTRY_ID = "\0lumen:server-entry";
const APP_RUNTIME = normalizePath(fileURLToPath(new URL("../server/app.ts", import.meta.url)));

/** What the build knows about the app, filled in by `build()` between the steps. */
export interface BuildState {
  /** Absolute project root (POSIX separators). */
  root: string;
  /** Absolute output directory (Vite's `build.outDir`): `client/` and `server/` go below it. */
  outDir: string;
  trailingSlash: TrailingSlash;
  csrf: false | CsrfOptions | undefined;
  /** Scanned before the builds. */
  app?: {
    manifest: RouteManifest;
    middleware: string | undefined;
    document: string | undefined;
  };
  /** Island specifier → client chunk URL, from the client build. */
  islands: Record<string, string>;
}

export function lumenBuild(state: BuildState): Plugin {
  return {
    name: "lumen:build",
    apply: "build",

    config(config) {
      state.outDir = normalizePath(resolve(state.root, config.build?.outDir ?? "dist"));
      return {
        appType: "custom",
        environments: {
          client: {
            build: {
              outDir: join(state.outDir, "client"),
              rolldownOptions: {
                input: { islands: ISLANDS },
                // Vite drops the exports of app entries; the island manifest's lazy imports are
                // what puts each island in its own chunk.
                preserveEntrySignatures: "exports-only",
              },
            },
          },
          ssr: {
            build: {
              outDir: join(state.outDir, "server"),
              copyPublicDir: false,
              rolldownOptions: {
                input: { entry: SERVER_ENTRY },
                output: { entryFileNames: "entry.js", chunkFileNames: "chunks/[name]-[hash].js" },
              },
            },
          },
        },
      };
    },

    resolveId: {
      filter: { id: /^virtual:lumen\/server-entry$/ },
      handler: () => SERVER_ENTRY_ID,
    },

    load: {
      filter: { id: /^\0lumen:server-entry$/ },
      handler() {
        if (state.app === undefined) throw new Error("lumen build: routes were not scanned.");
        return serverEntryCode(state, this.environment.config);
      },
    },
  };
}

/** The server entry module: data of the built app plus its handler. */
export function serverEntryCode(state: BuildState, config: ResolvedConfig): string {
  const { manifest, middleware, document } = state.app!;
  const files = new Set<string>([
    ...manifest.routes.map((route) => route.file),
    ...manifest.layouts.map((layout) => layout.file),
    ...manifest.notFoundPages.map((page) => page.file),
    ...manifest.errorPages.map((page) => page.file),
  ]);
  if (middleware !== undefined) files.add(middleware);
  if (document !== undefined) files.add(document);
  const modules = [...files]
    .toSorted()
    .map(
      (file) =>
        `  ${JSON.stringify(file)}: () => import(${JSON.stringify(normalizePath(join(state.root, file)))}),`,
    );
  const appConfig: BuiltAppConfig = {
    base: config.base,
    trailingSlash: state.trailingSlash,
    assetsDir: config.build.assetsDir,
  };
  const data = {
    manifest: {
      routes: manifest.routes,
      layouts: manifest.layouts,
      notFoundPages: manifest.notFoundPages,
      errorPages: manifest.errorPages,
    },
    ...(middleware === undefined ? {} : { middleware }),
    ...(document === undefined ? {} : { document }),
    ...(state.csrf === undefined ? {} : { csrf: state.csrf }),
    islands: state.islands,
  };
  // The runtime is imported dynamically so it lands in a chunk: route chunks then never import
  // this entry, which can be loaded again under another URL (the build's prerender pass).
  return `const { createAppHandler } = await import(${JSON.stringify(APP_RUNTIME)});

const modules = {
${modules.join("\n")}
};

/** Options adapters need to serve dist/client next to the handler. */
export const config = ${JSON.stringify(appConfig)};

export const app = {
  ...config,
  ...${JSON.stringify(data)},
  loadModule(file) {
    const load = modules[file];
    return load === undefined
      ? Promise.reject(new Error(\`\${file} is not part of this build.\`))
      : load();
  },
};

/** A request handler for this app: \`createHandler({ env, onError })\`. */
export function createHandler(options) {
  return createAppHandler(app, options);
}

export default createHandler();
`;
}
