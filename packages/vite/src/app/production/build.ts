// `build()`: the programmatic `lumiose build` (spec §8 Build). With Vite 8's builder:
//
// 1. Scan the routes (typegen writes `.lumiose/types/routes.d.ts`; shadow TSX stays with
//    `lumiose check`). Route manifest errors (LUM5002/5003/5005) stop the build.
// 2. Client environment → `dist/client`: the island loader and islands, assets, `public/`.
// 3. Server environment → `dist/server/entry.js`, with the client build's island URLs.
// 4. Prerender `static` routes and endpoints, and `spa` routes with `prerender` (decision-38),
//    in-process through that entry (./prerender.ts).
// 5. Precompress `dist/client` (`.br` and `.gz` copies, ./precompress.ts) for adapters to serve.
// 6. With `lumiose({ adapter })` (decision-45, ./adapter.ts), the adapter writes the platform's
//    output. Platforms that serve `dist/client` themselves get no precompressed copies, and a
//    server entry without its static file layer.
//
// The output deploys with `@lumiose/adapter-node` (statics, then the handler), or runs on Bun and
// Deno as is (`export default { fetch }`); a site whose routes are all prerendered deploys with
// `dist/client` alone, so the build then removes `dist/server` (./static-site.ts).
// `lumiose({ headers })` is written to `dist/client/_headers` for static hosts.

import { readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createBuilder,
  loadEnv,
  normalizePath,
  type InlineConfig,
  type Logger,
  type LogLevel,
  type Rollup,
} from "vite";
import lumiose from "../../index.ts";
import {
  DOCUMENT_FILES,
  findAppFile,
  findViteConfig,
  INSTRUMENTATION_SERVER_FILES,
  MIDDLEWARE_FILES,
  navigationOptions,
  projectOptions,
  realProjectRoot,
} from "../project.ts";
import { DEFAULT_ROUTES_DIR, type RouteMode } from "lumiose/internal/app/routes/manifest.ts";
import type { TrailingSlash } from "lumiose/internal/app/server/handler.ts";
import { typegen } from "../typegen/index.ts";
import { lumioseBuild, type BuildState } from "./plugin.ts";
import { ISLANDS_ID } from "../../islands.ts";
import { SPA_ENTRY_ID } from "../router/entry.ts";
import { precompress } from "./precompress.ts";
import { prerender, type PrerenderedFile, type ServerEntryModule } from "./prerender.ts";
import { serverReason } from "./static-site.ts";
import { headersFile } from "lumiose/internal/app/headers.ts";

export interface BuildOptions {
  /** Project root. Default: the current directory. */
  root?: string;
  /** Vite config file, or `false` for none. Default: `vite.config.*` in the root, if any. */
  configFile?: string | false;
  /** Vite mode (`.env.[mode]` files). Default: `production`. */
  mode?: string;
  /** Project-relative routes directory. Default `src/routes`. */
  routesDir?: string;
  /** Trailing slashes of page URLs and files. Default: `lumiose({ trailingSlash })`, else `ignore`. */
  trailingSlash?: TrailingSlash;
  logLevel?: LogLevel;
  customLogger?: Logger;
}

export interface BuildResult {
  /** Absolute output directory (`dist`). */
  outDir: string;
  /** Absolute `dist/client`: static assets and prerendered files. */
  clientDir: string;
  /** Absolute `dist/server/entry.js`; undefined when every route is prerendered (no `dist/server`). */
  serverEntry: string | undefined;
  /** Prerendered files, relative to `clientDir`. */
  prerendered: PrerenderedFile[];
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;

/** Route manifest errors and other problems found before building. */
export class BuildError extends Error {
  override name = "BuildError";
}

export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  // Real (symlinks and Windows short names resolved), as Vite's module ids are.
  const root = normalizePath(realProjectRoot(options.root));
  const configFile = options.configFile ?? findViteConfig(root);
  const routesDir = options.routesDir ?? DEFAULT_ROUTES_DIR;
  const state: BuildState = {
    root,
    outDir: "",
    ...(options.trailingSlash === undefined ? {} : { trailingSlashOption: options.trailingSlash }),
    trailingSlash: "ignore",
    csrf: undefined,
    viewTransitions: false,
    prefetch: "hover",
    islands: {},
    islandChunks: {},
    hashedFiles: new Set(),
  };
  const config: InlineConfig = {
    root,
    configFile,
    mode: options.mode ?? "production",
    plugins: [...(configFile === false ? [lumiose()] : []), lumioseBuild(state)],
  };
  if (options.logLevel !== undefined) config.logLevel = options.logLevel;
  if (options.customLogger !== undefined) config.customLogger = options.customLogger;

  const builder = await createBuilder(config);
  const resolved = builder.config;
  const logger = resolved.logger;
  const project = projectOptions(resolved, "build");
  state.csrf = project.csrf;
  if (project.limits !== undefined) state.limits = project.limits;
  if (project.headers !== undefined) state.headers = project.headers;
  if (project.adapter?.staticFiles === "platform") state.platformStaticFiles = true;
  Object.assign(state, navigationOptions(project));
  const defaultMode: RouteMode = project.mode ?? "static";

  const { manifest } = await typegen(root, {
    routesDir,
    defaultMode,
    ...(project.ssr === undefined ? {} : { defaultSsr: project.ssr }),
    ...(project.prerender === undefined ? {} : { defaultPrerender: project.prerender }),
    ...(project.i18n === undefined ? {} : { i18n: project.i18n }),
  });
  const errors = manifest.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  for (const diagnostic of manifest.diagnostics.filter((d) => d.severity === "warning")) {
    logger.warn(`${diagnostic.code}: ${diagnostic.message} (${diagnostic.file})`);
  }
  if (errors.length > 0) {
    throw new BuildError(
      `The routes have errors:\n${errors
        .map(
          (diagnostic) =>
            `  - ${diagnostic.file}: ${diagnostic.code}: ${diagnostic.message}${diagnostic.help === undefined ? "" : ` ${diagnostic.help}`}`,
        )
        .join("\n")}`,
    );
  }
  state.app = {
    manifest,
    middleware: findAppFile(root, MIDDLEWARE_FILES),
    document: findAppFile(root, DOCUMENT_FILES),
    instrumentation: findAppFile(root, INSTRUMENTATION_SERVER_FILES),
  };

  const client = builder.environments.client!;
  const clientDir = resolve(root, client.config.build.outDir);
  const clientOutput = await builder.build(client);
  Object.assign(state, await islandUrls(clientOutput, root, clientDir, client.config.base));
  // Island refs, including those of linked packages and bare specifiers (TASK-98).
  for (const [module, fileName] of Object.entries(state.islandChunks)) {
    state.islands[module] = client.config.base + fileName;
  }

  const ssr = builder.environments.ssr!;
  const serverDir = resolve(root, ssr.config.build.outDir);
  await builder.build(ssr);
  const serverEntry = join(serverDir, "entry.js");

  logger.info("\nprerendering routes…");
  // A fresh module instance per build (repeated builds in one process, such as tests).
  const entry = (await import(
    `${pathToFileURL(serverEntry).href}?t=${Date.now()}`
  )) as ServerEntryModule;
  const prerendered = await prerender({
    entry,
    clientDir,
    defaultMode,
    env: loadEnv(resolved.mode, resolved.envDir === false ? root : resolved.envDir, ""),
  });
  for (const file of prerendered) {
    logger.info(`  ${normalizePath(relative(root, join(clientDir, file.file)))}`);
  }
  logger.info(`✓ ${prerendered.length} file${prerendered.length === 1 ? "" : "s"} prerendered.`);
  // Prerendered pages in several locales get hreflang and canonical links (decision-44).
  const localized = manifest.routes.some(
    (route) =>
      route.kind === "page" &&
      (route.mode === "static" || route.prerender) &&
      (route.localesFrom !== undefined || (route.locales?.length ?? 0) > 1),
  );
  if (project.site === undefined && localized) {
    logger.warn(
      'Prerendered localized pages got root-relative hreflang and canonical URLs, which search engines ignore: set the site\'s URL with lumiose({ site: "https://example.com" }).',
    );
  }
  {
    // Lumiose's default headers and lumiose({ headers }) for static hosts. After `public/`: a
    // hand-written `_headers` keeps its rules, ours follow.
    const file = join(clientDir, "_headers");
    const own = await readFile(file, "utf8").catch(() => "");
    await writeFile(
      file,
      (own === "" || own.endsWith("\n") ? own : `${own}\n`) +
        headersFile(project.headers, client.config.base),
    );
  }
  const needsServer = await serverReason(entry, clientDir);
  if (needsServer === undefined) {
    await rm(serverDir, { recursive: true, force: true });
    logger.info("✓ every route is prerendered: dist/client is the whole site (no dist/server).");
  }
  if (state.platformStaticFiles !== true) {
    const compressed = await precompress(clientDir);
    if (compressed.files > 0) {
      logger.info(
        `✓ ${compressed.files} file${compressed.files === 1 ? "" : "s"} precompressed (.br, .gz): ${kb(compressed.bytes)} → ${kb(compressed.brotliBytes)} brotli.`,
      );
    }
  }
  const result: BuildResult = {
    outDir: state.outDir,
    clientDir,
    serverEntry: needsServer === undefined ? undefined : serverEntry,
    prerendered,
  };
  if (project.adapter !== undefined) {
    logger.info(`\nadapting the build with ${project.adapter.name}…`);
    await project.adapter.adapt({
      root,
      outDir: result.outDir,
      clientDir,
      serverEntry: result.serverEntry,
      config: entry.config,
      hashedFiles: state.hashedFileList ?? [],
      unhashedAssets: await unhashedAssets(clientDir, client.config.build.assetsDir, state),
      prerendered,
      mode: resolved.mode,
      logger,
    });
  }
  return result;
}

/**
 * The files of the assets directory (relative to `clientDir`) the build did not name by content
 * hash: `public/` copies, which static hosts must not cache for a year (TASK-201).
 */
async function unhashedAssets(
  clientDir: string,
  assetsDir: string,
  state: BuildState,
): Promise<string[]> {
  const hashed = new Set(state.hashedFileList);
  const dir = join(clientDir, assetsDir);
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => normalizePath(relative(clientDir, join(entry.parentPath, entry.name))))
    .filter((file) => !hashed.has(file) && !hashed.has(file.replace(/\.(?:br|gz)$/, "")))
    .toSorted();
}

/**
 * Island module specifier (`/src/components/Team.stsx`) → URL of its chunk in the client build
 * (SPA layouts and pages too), and the URLs of the island loader and the SPA entry. A loader
 * without islands, or an SPA entry without `spa` pages, is removed: no page loads it. `spaPreloads`
 * lists, per SPA layout and page, its chunk and the chunks it imports statically: the server
 * modulepreloads them so that a deep link does not wait for the entry to run first (TASK-123).
 * `clientEntry` is the chunk of `src/instrumentation.client.ts` and the chunks it imports.
 */
async function islandUrls(
  output: Awaited<ReturnType<Awaited<ReturnType<typeof createBuilder>>["build"]>>,
  root: string,
  clientDir: string,
  base: string,
): Promise<{
  islands: Record<string, string>;
  loader: string | undefined;
  spa: string | undefined;
  spaPreloads: Record<string, string[]>;
  clientEntry?: { url: string; preloads: string[] };
}> {
  const outputs = (Array.isArray(output) ? output : [output]) as Rollup.RolldownOutput[];
  const chunks = outputs.flatMap(({ output: files }) =>
    files.filter((file): file is Rollup.OutputChunk => file.type === "chunk"),
  );
  const remove = async (chunk: Rollup.OutputChunk): Promise<void> => {
    await rm(join(clientDir, chunk.fileName), { force: true });
    // And its directory, when that leaves it empty.
    await rmdir(dirname(join(clientDir, chunk.fileName))).catch(() => {});
  };
  // The island manifest's lazy imports are the islands. It lives in the loader chunk, or in a chunk
  // the loader shares with the SPA entry (TASK-25), whose own lazy imports are SPA modules.
  const manifest = chunks.find((chunk) => chunk.moduleIds.includes(ISLANDS_ID));
  const hasIslands =
    manifest !== undefined &&
    (manifest.isEntry && manifest.name === "spa" ? true : manifest.dynamicImports.length > 0);
  // The SPA entry's module, with the lazy imports of the SPA's layouts and pages: in the `spa` entry
  // chunk, or in the runtime chunk that entry chunk then only imports (TASK-295: an app with more
  // entries than the loader and the SPA's).
  const spaModule = chunks.find((chunk) => chunk.moduleIds.includes(SPA_ENTRY_ID));
  const islands: Record<string, string> = {};
  let loader: string | undefined;
  let spa: string | undefined;
  for (const chunk of chunks) {
    if (chunk.isEntry && chunk.name === "loader") {
      if (hasIslands) loader = base + chunk.fileName;
      else await remove(chunk);
    }
    if (chunk.isEntry && chunk.name === "spa") {
      // An app without `spa` pages builds an empty SPA entry.
      if ((spaModule?.dynamicImports.length ?? 0) > 0) spa = base + chunk.fileName;
      else await remove(chunk);
    }
    if (!chunk.isDynamicEntry || chunk.facadeModuleId === null) continue;
    const path = normalizePath(relative(root, chunk.facadeModuleId));
    if (!path.startsWith("../")) islands[`/${path}`] = base + chunk.fileName;
  }
  const spaPreloads: Record<string, string[]> = {};
  const spaEntry = chunks.find((chunk) => chunk.isEntry && chunk.name === "spa");
  if (spa !== undefined && spaEntry !== undefined) {
    const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    for (const fileName of spaModule?.dynamicImports ?? []) {
      const chunk = byFile.get(fileName);
      if (chunk?.facadeModuleId == null) continue;
      const path = normalizePath(relative(root, chunk.facadeModuleId));
      if (path.startsWith("../")) continue;
      // The entry itself is already a <script> of the page.
      const closure = new Set<string>([spaEntry.fileName]);
      const visit = (name: string): void => {
        if (closure.has(name)) return;
        closure.add(name);
        for (const imported of byFile.get(name)?.imports ?? []) visit(imported);
      };
      visit(fileName);
      closure.delete(spaEntry.fileName);
      spaPreloads[path] = [...closure].map((name) => base + name);
    }
  }
  // `src/instrumentation.client.ts` (decision-49): its chunk and those it imports statically, which
  // pages preload with it.
  const instrumentation = chunks.find((chunk) => chunk.isEntry && chunk.name === "instrumentation");
  let clientEntry: { url: string; preloads: string[] } | undefined;
  if (instrumentation !== undefined) {
    const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    const closure = new Set<string>();
    const visit = (name: string): void => {
      if (closure.has(name)) return;
      closure.add(name);
      for (const imported of byFile.get(name)?.imports ?? []) visit(imported);
    };
    for (const imported of instrumentation.imports) visit(imported);
    closure.delete(instrumentation.fileName);
    clientEntry = {
      url: base + instrumentation.fileName,
      preloads: [...closure].map((name) => base + name),
    };
  }
  return {
    islands,
    loader,
    spa,
    spaPreloads,
    ...(clientEntry === undefined ? {} : { clientEntry }),
  };
}
