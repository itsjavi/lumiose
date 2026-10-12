// The Vite side of `lumiose build` (spec §8 Build): environment build options and the generated
// server entry. `build()` (./build.ts) runs the client environment, then the server environment,
// then prerenders; this plugin only shapes the two builds.
//
// - client → `dist/client`: the island loader (`lumiose/dom/loader`, which imports the island
//   manifest `virtual:lumiose/islands`: one chunk per island), the SPA entry (`virtual:lumiose/spa`:
//   the client route table and a chunk per SPA layout and page), assets and `public/`. The
//   runtime goes to one chunk, with a smaller preload helper (./client-runtime.ts).
// - ssr → `dist/server/entry.js` (`virtual:lumiose/server-entry`): the route manifest, a lazy
//   import per route module, the middleware and the document, the island and loader URLs of the
//   client build, the stylesheets of each module (`virtual:lumiose/css-manifest`, @lumiose/vite) and
//   `export default { fetch(request, platform?) }`: the handler of `createAppHandler()` behind the
//   static files of `dist/client`, with `lumiose({ headers })` (`serveBuild()`, decision-45).
//   Assets that only server-rendered modules
//   import (`import photo from "./photo.png"`, a relative `<img src>` in a `.md` import) are
//   emitted by this build and moved to `dist/client`, where their URLs point (TASK-126).

import { runtimeFile } from "../../runtime-files.ts";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  normalizePath,
  type Plugin,
  type ResolvedConfig,
  type Rollup,
  type UserConfig,
} from "vite";
import { CSS_MANIFEST, isStylesheet } from "../../css-manifest.ts";
import type { RouteManifest } from "lumiose/internal/app/routes/manifest.ts";
import type { BuiltAppConfig } from "lumiose/internal/app/server/app.ts";
import type { HeadersOption } from "lumiose/internal/app/headers.ts";
import type { CsrfOptions } from "lumiose/internal/app/server/csrf.ts";
import type { LimitsOption } from "lumiose/internal/app/server/body.ts";
import type { TrailingSlash } from "lumiose/internal/app/server/handler.ts";
import type { Prefetch } from "lumiose/internal/app/server/navigation.ts";
import { SPA_ENTRY, spaEntryPlugin } from "../router/entry.ts";
import { routeModuleNames, routeOutput } from "./chunk-names.ts";
import { clientRuntime } from "./client-runtime.ts";
import {
  configProjectOptions,
  hrefDefine,
  islandModules,
  projectOptions,
  siteOrigin,
} from "../project.ts";
import { ISLANDS_ID } from "../../islands.ts";
import { STYLE_TAGS_PLACEHOLDER, styleTags } from "./stylesheets.ts";

export const SERVER_ENTRY = "virtual:lumiose/server-entry";
/**
 * Placeholder of the server entry's `config.hashedFiles` (internal, not in the documented config
 * type), replaced once the server build is complete (`writeHashedFiles`). In minified code, with
 * any quotes.
 */
const HASHED_FILES_PLACEHOLDER = "__LUMIOSE_HASHED_FILES__";
const HASHED_FILES_LITERAL = /(["'`])__LUMIOSE_HASHED_FILES__\1/g;
const SERVER_ENTRY_ID = "\0lumiose:server-entry";
const APP_RUNTIME = runtimeFile("app/server/app.ts");
/** The static files of `dist/client` for the entry's `fetch`, read with `node:fs`. */
const STATIC_RUNTIME = runtimeFile("app/server/static-fs.ts");
/** The island loader's client entry (`lumiose/dom/loader`). */
const ISLAND_LOADER = runtimeFile("dom/loader.ts");
/** JS left of a chunk whose pure-CSS imports Vite removed. */
const EMPTY_CSS_JS = /^(?:\s|\/\*\s*empty css\s*\*\/)*$/;

/** What the build knows about the app, filled in by `build()` between the steps. */
export interface BuildState {
  /** Absolute project root (POSIX separators). */
  root: string;
  /** Absolute output directory (Vite's `build.outDir`): `client/` and `server/` go below it. */
  outDir: string;
  /** `build({ trailingSlash })`, which overrides `lumiose({ trailingSlash })`. */
  trailingSlashOption?: TrailingSlash;
  /** The effective policy, set when the config resolves (`href()` reads it too). */
  trailingSlash: TrailingSlash;
  csrf: false | CsrfOptions | undefined;
  /** `lumiose({ limits })`, for the server entry. */
  limits?: LimitsOption;
  /** `lumiose({ headers })`, for adapters (`config.headers` of the server entry). */
  headers?: HeadersOption;
  /**
   * The deploy adapter's platform serves `dist/client` (`staticFiles: "platform"`): the server
   * entry's `fetch` has no static file layer, so the output does not import `node:fs`.
   */
  platformStaticFiles?: boolean;
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
  /**
   * Files of `dist/client` (relative) the builds named by content hash: the client bundle's
   * outputs, the merged stylesheets and the assets moved from the server build (TASK-201).
   */
  hashedFiles: Set<string>;
  /** `hashedFiles` of the written files, sorted, once the server build is complete. */
  hashedFileList?: string[];
}

export function lumioseBuild(state: BuildState): Plugin[] {
  return [
    lumioseBuildEnvironments(state),
    spaEntryPlugin(() => state.app?.manifest),
    clientRuntime(state),
  ];
}

function lumioseBuildEnvironments(state: BuildState): Plugin {
  return {
    name: "lumiose:build",
    apply: "build",

    config(config) {
      state.outDir = normalizePath(resolve(state.root, config.build?.outDir ?? "dist"));
      state.trailingSlash =
        state.trailingSlashOption ?? configProjectOptions(config.plugins).trailingSlash ?? "ignore";
      // Route modules' chunks and stylesheets are named after their route folder (TASK-260).
      let names: Map<string, string> | undefined;
      const routeNames = () =>
        state.app === undefined ? undefined : (names ??= routeModuleNames(state.app.manifest));
      const rootPrefix = `${state.root}/`;
      const projectFile = (id: string) =>
        id.startsWith(rootPrefix) ? id.slice(rootPrefix.length) : undefined;
      const output = (dir: string) => routeOutput(dir, routeNames, projectFile);
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
                // The app's own file names, if it sets any, win.
                ...(setsFileNames(config)
                  ? {}
                  : { output: output(config.build?.assetsDir ?? "assets") }),
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
                output: {
                  entryFileNames: "entry.js",
                  chunkFileNames: output("chunks").chunkFileNames,
                  // Smaller server output (-29% on the fullstack bench) with function and class
                  // names kept, so production stack traces stay readable (TASK-174). Mangling would
                  // save 20% more for no measurable cold-start or throughput gain on Node.
                  minify: { compress: true, mangle: false, codegen: { removeWhitespace: true } },
                },
              },
            },
          },
        },
      };
    },

    resolveId: {
      filter: { id: /^virtual:lumiose\/server-entry$/ },
      handler: () => SERVER_ENTRY_ID,
    },

    load: {
      filter: { id: /^\0lumiose:server-entry$/ },
      handler() {
        if (state.app === undefined) throw new Error("lumiose build: routes were not scanned.");
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
          written: (fileName) => state.hashedFiles.add(fileName),
        });
        // The placeholder ends its line: no mapped code moves.
        return {
          code: code.replace(
            placeholder,
            () => `JSON.parse(${JSON.stringify(JSON.stringify(tags))})`,
          ),
          map: null,
        };
      },
    },

    // @lumiose/vite builds every stylesheet as an entry of the client build (its CSS manifest). When
    // an island imports one too, Rolldown moves the stylesheet to a shared chunk and gives the entry
    // a facade chunk that only imports it; Vite then drops the pure-CSS chunk and blanks the import
    // (`/* empty css */`). Nothing loads the facade, so it is not written either (TASK-94).
    //
    // It also finds the chunk of each island, by the module part of its ref (TASK-98), and records
    // the files named by content hash; the server build writes their list into its entry's config.
    generateBundle: {
      order: "post",
      async handler(options, bundle) {
        if (this.environment.name === "ssr") {
          const config = this.environment.getTopLevelConfig();
          const clientDir = resolve(config.root, config.environments.client!.build.outDir);
          for (const asset of await moveServerAssets(bundle, config.build.assetsDir, clientDir)) {
            if (isHashedOutput(asset, options)) state.hashedFiles.add(asset.fileName);
          }
          writeHashedFiles(bundle, state, clientDir);
          return;
        }
        if (this.environment.name !== "client") return;
        for (const [fileName, file] of Object.entries(bundle)) {
          if (isEmptyStylesheetFacade(file)) delete bundle[fileName];
        }
        for (const file of Object.values(bundle)) {
          if (isHashedOutput(file, options)) state.hashedFiles.add(file.fileName);
        }
        state.islandChunks = await islandChunks(this, bundle);
      },
    },
  };
}

/** Matches a name that a `[hash]` ends, before the extension: `page-D-i-jZkv.css`. */
const HASHED_OUTPUT = /[-.][\w-]{8}\.[^./]+$/;

/**
 * Whether a bundle output was named by content hash: by a file-name pattern with `[hash]` (Vite's
 * defaults, Lumiose's route names), not by a plugin's explicit `fileName`.
 */
function isHashedOutput(
  file: Rollup.OutputAsset | Rollup.OutputChunk,
  options: Rollup.NormalizedOutputOptions,
): boolean {
  const pattern =
    file.type === "asset"
      ? options.assetFileNames
      : file.isEntry
        ? options.entryFileNames
        : options.chunkFileNames;
  if (typeof pattern === "string" && !pattern.includes("[hash")) return false;
  return HASHED_OUTPUT.test(file.fileName);
}

/**
 * Fills the server entry's `config.hashedFiles` with the hashed files the client output holds
 * (the build removes some chunks, such as a loader without islands), sorted. Static file servers
 * cache exactly those for a year (TASK-201).
 */
function writeHashedFiles(bundle: Rollup.OutputBundle, state: BuildState, clientDir: string): void {
  const list = [...state.hashedFiles]
    .filter((file) => existsSync(join(clientDir, file)))
    .toSorted();
  state.hashedFileList = list;
  for (const file of Object.values(bundle)) {
    if (file.type !== "chunk" || !file.moduleIds.includes(SERVER_ENTRY_ID)) continue;
    const code = file.code.replace(
      HASHED_FILES_LITERAL,
      () => `JSON.parse(${JSON.stringify(JSON.stringify(list))})`,
    );
    if (code === file.code) throw new Error("lumiose build: the server entry lost its file list.");
    file.code = code;
  }
}

/** Whether the Vite config names the client build's output files itself. */
function setsFileNames(config: UserConfig): boolean {
  const outputs = [
    config.build?.rolldownOptions?.output,
    config.build?.rollupOptions?.output,
    config.environments?.client?.build?.rolldownOptions?.output,
    config.environments?.client?.build?.rollupOptions?.output,
  ].flat();
  return outputs.some(
    (output) =>
      output !== undefined &&
      (output.entryFileNames !== undefined ||
        output.chunkFileNames !== undefined ||
        output.assetFileNames !== undefined),
  );
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
    .plugins.find((plugin) => plugin.name === "lumiose");
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
 * kept. Stylesheets are dropped: the client build emits every stylesheet (@lumiose/vite's CSS
 * manifest), and pages link those.
 */
async function moveServerAssets(
  bundle: Rollup.OutputBundle,
  assetsDir: string,
  clientDir: string,
): Promise<Rollup.OutputAsset[]> {
  const prefix = `${normalizePath(assetsDir).replace(/\/$/, "")}/`;
  const moved: Rollup.OutputAsset[] = [];
  for (const [fileName, file] of Object.entries(bundle)) {
    if (file.type !== "asset" || !fileName.startsWith(prefix)) continue;
    delete bundle[fileName];
    if (fileName.endsWith(".css")) continue;
    moved.push(file);
    const target = join(clientDir, fileName);
    if (existsSync(target)) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.source);
  }
  return moved;
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
    ...(state.headers === undefined ? {} : { headers: state.headers }),
  };
  const data = {
    manifest: {
      routes: manifest.routes,
      layouts: manifest.layouts,
      notFoundPages: manifest.notFoundPages,
      errorPages: manifest.errorPages,
      ...(manifest.i18n === undefined ? {} : { i18n: manifest.i18n }),
    },
    ...(middleware === undefined ? {} : { middleware }),
    ...(document === undefined ? {} : { document }),
    ...(state.csrf === undefined ? {} : { csrf: state.csrf }),
    ...(state.limits === undefined ? {} : { limits: state.limits }),
    ...(state.viewTransitions ? { viewTransitions: true } : {}),
    ...(projectOptions(config, "build").csp === undefined ? {} : { csp: "strict" }),
    ...(projectOptions(config, "build").site === undefined
      ? {}
      : { site: siteOrigin(projectOptions(config, "build").site) }),
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
  // A build runs in production: NODE_ENV defaults to "production" (an explicit value is kept)
  // before the runtime, the routes and the dependencies they import are loaded (TASK-149).
  // The static file layer (`node:fs`) only when the server serves dist/client (no deploy adapter
  // whose platform does, decision-45).
  const defaultExport =
    state.platformStaticFiles === true
      ? `/** { fetch(request, platform?) }: the app, with lumiose({ headers }). The platform serves dist/client. */
export default serveBuild(createHandler(), config);`
      : `/**
 * { fetch(request, platform?) }: the static files of dist/client, then the app, with
 * lumiose({ headers }). Bun and Deno run it as is.
 */
export default serveBuild(
  createHandler(),
  config,
  staticFiles(new URL("../client/", import.meta.url), config),
);`;
  const staticImport =
    state.platformStaticFiles === true
      ? ""
      : `const { staticFiles } = await import(${JSON.stringify(STATIC_RUNTIME)});\n`;
  return `import { stylesheets } from ${JSON.stringify(CSS_MANIFEST)};
// Through a variable: bundlers that define process.env.NODE_ENV (wrangler) leave it alone.
const processEnv = typeof process === "undefined" ? undefined : process.env;
if (processEnv && processEnv.NODE_ENV === undefined) processEnv.NODE_ENV = "production";
const { createAppHandler, serveBuild } = await import(${JSON.stringify(APP_RUNTIME)});
${staticImport}
const modules = {
${modules.join("\n")}
};
const loadedModules = new Map();

/** Options adapters need to serve dist/client next to the handler. */
export const config = ${JSON.stringify({ ...appConfig, hashedFiles: HASHED_FILES_PLACEHOLDER })};

export const app = {
  ...config,
  ...${JSON.stringify(data)},
  stylesheets,
  styleTags: ${JSON.stringify(STYLE_TAGS_PLACEHOLDER)},
  loadModule(file) {
    // One import() per module for the server's lifetime, not one per request (TASK-150).
    let loaded = loadedModules.get(file);
    if (loaded === undefined) {
      const load = modules[file];
      loaded = load === undefined
        ? Promise.reject(new Error(\`\${file} is not part of this build.\`))
        : load();
      loadedModules.set(file, loaded);
    }
    return loaded;
  },
};

/** The app's request handler (no static files): \`createHandler({ env, onError })\`. */
export function createHandler(options) {
  return createAppHandler(app, options);
}

${defaultExport}
`;
}
