// `build()`: the programmatic `lumen build` (spec §8 Build). With Vite 8's builder:
//
// 1. Scan the routes (typegen writes `.lumen/types/routes.d.ts`; shadow TSX stays with
//    `lumen check`). Route manifest errors (LUM5002/5003/5005) stop the build.
// 2. Client environment → `dist/client`: the island loader and islands, assets, `public/`.
// 3. Server environment → `dist/server/entry.js`, with the client build's island URLs.
// 4. Prerender `static` routes and endpoints in-process through that entry (./prerender.ts).
// 5. Precompress `dist/client` (`.br` and `.gz` copies, ./precompress.ts) for adapters to serve.
//
// The output deploys with `@lumen/adapter-node` (statics, then the handler); a site whose routes
// are all prerendered deploys with `dist/client` alone, so the build then removes `dist/server`
// (./static-site.ts). `lumen({ headers })` is written to `dist/client/_headers` for static hosts.

import { readFile, rm, rmdir, writeFile } from "node:fs/promises";
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
import lumen from "../../vite/index.ts";
import {
  DOCUMENT_FILES,
  findAppFile,
  findViteConfig,
  MIDDLEWARE_FILES,
  navigationOptions,
  projectOptions,
} from "../project.ts";
import { DEFAULT_ROUTES_DIR, type RouteMode } from "../routes/manifest.ts";
import type { TrailingSlash } from "../server/handler.ts";
import { typegen } from "../typegen/index.ts";
import { lumenBuild, type BuildState } from "./plugin.ts";
import { ISLANDS_ID } from "../../vite/islands.ts";
import { precompress } from "./precompress.ts";
import { prerender, type PrerenderedFile, type ServerEntryModule } from "./prerender.ts";
import { serverReason } from "./static-site.ts";
import { headersFile } from "../headers.ts";

export interface BuildOptions {
  /** Project root. Default: the current directory. */
  root?: string;
  /** Vite config file, or `false` for none. Default: `vite.config.*` in the root, if any. */
  configFile?: string | false;
  /** Vite mode (`.env.[mode]` files). Default: `production`. */
  mode?: string;
  /** Project-relative routes directory. Default `src/routes`. */
  routesDir?: string;
  /** Trailing slashes of page URLs and files. Default: `lumen({ trailingSlash })`, else `ignore`. */
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
  const root = normalizePath(resolve(options.root ?? process.cwd()));
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
  };
  const config: InlineConfig = {
    root,
    configFile,
    mode: options.mode ?? "production",
    plugins: [...(configFile === false ? [lumen()] : []), lumenBuild(state)],
  };
  if (options.logLevel !== undefined) config.logLevel = options.logLevel;
  if (options.customLogger !== undefined) config.customLogger = options.customLogger;

  const builder = await createBuilder(config);
  const resolved = builder.config;
  const logger = resolved.logger;
  const project = projectOptions(resolved, "build");
  state.csrf = project.csrf;
  if (project.headers !== undefined) state.headers = project.headers;
  Object.assign(state, navigationOptions(project));
  const defaultMode: RouteMode = project.mode ?? "static";

  const { manifest } = await typegen(root, {
    routesDir,
    defaultMode,
    ...(project.ssr === undefined ? {} : { defaultSsr: project.ssr }),
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

  logger.info("\nprerendering static routes…");
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
  if (project.headers !== undefined) {
    // After `public/`: a hand-written `_headers` keeps its rules, ours follow.
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
  const compressed = await precompress(clientDir);
  if (compressed.files > 0) {
    logger.info(
      `✓ ${compressed.files} file${compressed.files === 1 ? "" : "s"} precompressed (.br, .gz): ${kb(compressed.bytes)} → ${kb(compressed.brotliBytes)} brotli.`,
    );
  }
  return {
    outDir: state.outDir,
    clientDir,
    serverEntry: needsServer === undefined ? undefined : serverEntry,
    prerendered,
  };
}

/**
 * Island module specifier (`/src/components/Team.stsx`) → URL of its chunk in the client build
 * (SPA layouts and pages too), and the URLs of the island loader and the SPA entry. A loader
 * without islands, or an SPA entry without `spa` pages, is removed: no page loads it. `spaPreloads`
 * lists, per SPA layout and page, its chunk and the chunks it imports statically: the server
 * modulepreloads them so that a deep link does not wait for the entry to run first (TASK-123).
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
      if (chunk.dynamicImports.length > 0) spa = base + chunk.fileName;
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
    for (const fileName of spaEntry.dynamicImports) {
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
  return { islands, loader, spa, spaPreloads };
}
