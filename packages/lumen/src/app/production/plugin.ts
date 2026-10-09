// The Vite side of `lumen build` (spec §8 Build): environment build options and the generated
// server entry. `build()` (./build.ts) runs the client environment, then the server environment,
// then prerenders; this plugin only shapes the two builds.
//
// - client → `dist/client`: the island loader (`lumen/dom/loader`, which imports the island
//   manifest `virtual:lumen/islands`: one chunk per island), the SPA entry (`virtual:lumen/spa`:
//   the client route table and a chunk per SPA layout and page), assets and `public/`. The
//   runtime goes to one chunk, with a smaller preload helper (./client-runtime.ts).
// - ssr → `dist/server/entry.js` (`virtual:lumen/server-entry`): the route manifest, a lazy
//   import per route module, the middleware and the document, the island and loader URLs of the
//   client build, the stylesheets of each module (`virtual:lumen/css-manifest`, lumen/vite) and
//   `export default { fetch }` from `createAppHandler()`. Assets that only server-rendered modules
//   import (`import photo from "./photo.png"`, a relative `<img src>` in a `.md` import) are
//   emitted by this build and moved to `dist/client`, where their URLs point (TASK-126).

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { normalizePath, type Plugin, type ResolvedConfig, type Rollup } from "vite";
import { CSS_MANIFEST, isStylesheet } from "../../vite/css-manifest.ts";
import type { RouteManifest } from "../routes/manifest.ts";
import type { BuiltAppConfig } from "../server/app.ts";
import type { CsrfOptions } from "../server/csrf.ts";
import type { TrailingSlash } from "../server/handler.ts";
import type { Prefetch } from "../server/navigation.ts";
import { SPA_ENTRY, spaEntryPlugin } from "../router/entry.ts";
import { clientRuntime } from "./client-runtime.ts";
import { configProjectOptions, hrefDefine, islandModules } from "../project.ts";
import { ISLANDS_ID } from "../../vite/islands.ts";
import { STYLE_TAGS_PLACEHOLDER, styleTags } from "./stylesheets.ts";

export const SERVER_ENTRY = "virtual:lumen/server-entry";
const SERVER_ENTRY_ID = "\0lumen:server-entry";
const APP_RUNTIME = normalizePath(fileURLToPath(new URL("../server/app.ts", import.meta.url)));
/** The island loader's client entry (`lumen/dom/loader`). */
const ISLAND_LOADER = normalizePath(fileURLToPath(new URL("../../dom/loader.ts", import.meta.url)));
/** JS left of a chunk whose pure-CSS imports Vite removed. */
const EMPTY_CSS_JS = /^(?:\s|\/\*\s*empty css\s*\*\/)*$/;

/** What the build knows about the app, filled in by `build()` between the steps. */
export interface BuildState {
  /** Absolute project root (POSIX separators). */
  root: string;
  /** Absolute output directory (Vite's `build.outDir`): `client/` and `server/` go below it. */
  outDir: string;
  /** `build({ trailingSlash })`, which overrides `lumen({ trailingSlash })`. */
  trailingSlashOption?: TrailingSlash;
  /** The effective policy, set when the config resolves (`href()` reads it too). */
  trailingSlash: TrailingSlash;
  csrf: false | CsrfOptions | undefined;
  viewTransitions: boolean;
  prefetch: Prefetch;
  /** Scanned before the builds. */
  app?: {
    manifest: RouteManifest;
    middleware: string | undefined;
    document: string | undefined;
  };
  /** Island specifier → client chunk URL, from the client build. */
  islands: Record<string, string>;
  /**
   * The module of each island ref (`/src/Nav.stsx`, `@acme/ui/src/Nav.stsx` in a linked package,
   * a bare `@acme/ui`) → the file name of the chunk the island manifest loads it from.
   */
  islandChunks: Record<string, string>;
  /** URL of the island loader chunk; undefined when the app has no islands. */
  loader?: string;
  /** URL of the SPA entry chunk; undefined when the app has no `spa` pages. */
  spa?: string;
  /** SPA layout or page (project-relative) → the chunk URLs to modulepreload with it. */
  spaPreloads?: Record<string, string[]>;
}

export function lumenBuild(state: BuildState): Plugin[] {
  return [
    lumenBuildEnvironments(state),
    spaEntryPlugin(() => state.app?.manifest),
    clientRuntime(state),
  ];
}

function lumenBuildEnvironments(state: BuildState): Plugin {
  return {
    name: "lumen:build",
    apply: "build",

    config(config) {
      state.outDir = normalizePath(resolve(state.root, config.build?.outDir ?? "dist"));
      state.trailingSlash =
        state.trailingSlashOption ?? configProjectOptions(config.plugins).trailingSlash ?? "ignore";
      return {
        appType: "custom",
        define: hrefDefine(state.trailingSlash),
        environments: {
          client: {
            build: {
              outDir: join(state.outDir, "client"),
              rolldownOptions: {
                // The SPA entry is an input of every build; without `spa` pages it is empty and
                // removed afterwards, like a loader without islands.
                input: { loader: ISLAND_LOADER, spa: SPA_ENTRY },
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
              // Assets only server-rendered modules import: moved to the client output below.
              emitAssets: true,
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

    // Each page's stylesheets, grouped into a shared file and the page's own (./stylesheets.ts),
    // once the server graph (the CSS manifest) is complete.
    renderChunk: {
      async handler(code, chunk) {
        if (this.environment.name !== "ssr" || !chunk.moduleIds.includes(SERVER_ENTRY_ID)) return;
        const placeholder = JSON.stringify(STYLE_TAGS_PLACEHOLDER);
        if (!code.includes(placeholder)) return;
        const config = this.environment.getTopLevelConfig();
        const { pages, others } = pageStylesheets(this, state);
        const tags = await styleTags(pages, others, {
          clientDir: resolve(config.root, config.environments.client!.build.outDir),
          base: config.base,
          assetsDir: config.build.assetsDir,
        });
        // The placeholder ends its line: no mapped code moves.
        return {
          code: code.replace(placeholder, () => `JSON.parse(${JSON.stringify(JSON.stringify(tags))})`),
          map: null,
        };
      },
    },

    // lumen/vite builds every stylesheet as an entry of the client build (its CSS manifest). When
    // an island imports one too, Rolldown moves the stylesheet to a shared chunk and gives the entry
    // a facade chunk that only imports it; Vite then drops the pure-CSS chunk and blanks the import
    // (`/* empty css */`). Nothing loads the facade, so it is not written either (TASK-94).
    //
    // It also finds the chunk of each island, by the module part of its ref (TASK-98).
    generateBundle: {
      order: "post",
      async handler(_, bundle) {
        if (this.environment.name === "ssr") {
          const config = this.environment.getTopLevelConfig();
          const clientDir = resolve(config.root, config.environments.client!.build.outDir);
          await moveServerAssets(bundle, config.build.assetsDir, clientDir);
          return;
        }
        if (this.environment.name !== "client") return;
        for (const [fileName, file] of Object.entries(bundle)) {
          if (isEmptyStylesheetFacade(file)) delete bundle[fileName];
        }
        state.islandChunks = await islandChunks(this, bundle);
      },
    },
  };
}

/**
 * The chunk of each island module. Refs name modules root-relatively, package-relatively in linked
 * packages (`@acme/ui/src/Nav.stsx`, TASK-74) or by a bare specifier (`@acme/ui`), so chunks are
 * found by resolving the island manifest's import of each module, as the build did.
 */
async function islandChunks(
  context: Rollup.PluginContext,
  bundle: Rollup.OutputBundle,
): Promise<Record<string, string>> {
  // A lazily imported module is the facade of its chunk, or part of a chunk that also holds the
  // modules importing it statically (a package's index that re-exports the island).
  const chunkOf = new Map<string, string>();
  const chunks = Object.values(bundle).filter((file) => file.type === "chunk");
  for (const chunk of chunks) {
    if (chunk.isDynamicEntry && chunk.facadeModuleId !== null) {
      chunkOf.set(chunk.facadeModuleId, chunk.fileName);
    }
  }
  for (const chunk of chunks) {
    for (const id of chunk.moduleIds) if (!chunkOf.has(id)) chunkOf.set(id, chunk.fileName);
  }
  const found: Record<string, string> = {};
  const modules = islandModules(context.environment.getTopLevelConfig());
  for (const [module, specifier] of modules) {
    const resolved = await context.resolve(specifier, ISLANDS_ID);
    const fileName = resolved === null ? undefined : chunkOf.get(resolved.id);
    if (fileName !== undefined) found[module] = fileName;
  }
  return found;
}

/**
 * The stylesheet URLs of every page the app renders (routes, `_404` and `_error` pages: the
 * document, the layouts, then the page), as the CSS manifest's `stylesheets()` lists them.
 */
function pageStylesheets(
  context: Rollup.PluginContext,
  state: BuildState,
): { pages: string[][]; others: string[][] } {
  const compiler = context.environment
    .getTopLevelConfig()
    .plugins.find((plugin) => plugin.name === "lumen");
  const api = compiler?.api as
    | {
        cssManifest?: (
          context: Rollup.PluginContext,
        ) => Readonly<Record<string, readonly string[]>>;
      }
    | undefined;
  const manifest = api?.cssManifest?.(context);
  if (manifest === undefined || state.app === undefined) return { pages: [], others: [] };
  const { manifest: routes, document } = state.app;
  const layoutsFor = (dir: string): string[] =>
    routes.layouts
      .filter(
        (layout) => layout.dir === "" || dir === layout.dir || dir.startsWith(`${layout.dir}/`),
      )
      .toSorted((a, b) => a.dir.length - b.dir.length)
      .map((layout) => layout.file);
  const hrefsOf = (files: readonly string[]): string[] => {
    const hrefs = new Set<string>();
    for (const file of document === undefined ? files : [document, ...files]) {
      for (const href of manifest[file] ?? []) hrefs.add(href);
    }
    return [...hrefs];
  };
  return {
    pages: routes.routes.flatMap((route) =>
      route.kind === "page" ? [hrefsOf([...route.layouts, route.file])] : [],
    ),
    others: [...routes.notFoundPages, ...routes.errorPages].map((page) =>
      hrefsOf([...layoutsFor(page.dir), page.file]),
    ),
  };
}

/**
 * Moves the server build's emitted assets to the client output: files under `assetsDir`, named by
 * content hash as in the client build, so one the client build already wrote is identical and
 * kept. Stylesheets are dropped: the client build emits every stylesheet (lumen/vite's CSS
 * manifest), and pages link those.
 */
async function moveServerAssets(
  bundle: Rollup.OutputBundle,
  assetsDir: string,
  clientDir: string,
): Promise<void> {
  const prefix = `${normalizePath(assetsDir).replace(/\/$/, "")}/`;
  for (const [fileName, file] of Object.entries(bundle)) {
    if (file.type !== "asset" || !fileName.startsWith(prefix)) continue;
    delete bundle[fileName];
    if (fileName.endsWith(".css")) continue;
    const target = join(clientDir, fileName);
    if (existsSync(target)) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.source);
  }
}

function isEmptyStylesheetFacade(file: Rollup.OutputAsset | Rollup.OutputChunk): boolean {
  return (
    file.type === "chunk" &&
    file.isEntry &&
    file.facadeModuleId !== null &&
    isStylesheet(file.facadeModuleId) &&
    file.exports.length === 0 &&
    EMPTY_CSS_JS.test(file.code)
  );
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
    ...(state.viewTransitions ? { viewTransitions: true } : {}),
    ...(state.prefetch === "none" ? {} : { prefetch: state.prefetch }),
    islands: state.islands,
    ...(state.loader === undefined ? {} : { loader: state.loader }),
    ...(state.spa === undefined ? {} : { spa: state.spa }),
    ...(state.spaPreloads === undefined || Object.keys(state.spaPreloads).length === 0
      ? {}
      : { spaPreloads: state.spaPreloads }),
  };
  // The runtime is imported dynamically so it lands in a chunk: route chunks then never import
  // this entry, which can be loaded again under another URL (the build's prerender pass).
  return `import { stylesheets } from ${JSON.stringify(CSS_MANIFEST)};
const { createAppHandler } = await import(${JSON.stringify(APP_RUNTIME)});

const modules = {
${modules.join("\n")}
};

/** Options adapters need to serve dist/client next to the handler. */
export const config = ${JSON.stringify(appConfig)};

export const app = {
  ...config,
  ...${JSON.stringify(data)},
  stylesheets,
  styleTags: ${JSON.stringify(STYLE_TAGS_PLACEHOLDER)},
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
