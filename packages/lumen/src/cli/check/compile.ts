// Compiler diagnostics (spec §9.1 step 3, §9.2): `compile()` on `.stsx` / `.tsx` sources for the
// reactivity, style and island checks (LUM2xxx–LUM4xxx) that scanning and type checking miss.
// Shared by `lumen check` (as a built-in diagnostic provider) and the language server.

import type {
  CompileOptions,
  CompileResult,
  Diagnostic as CompilerDiagnostic,
  HostModule,
} from "@lumen/compiler";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { DiagnosticProvider, FileDiagnostics } from "./index.ts";
import { scanServerRoutes, serverRouteFiles } from "../../vite/server-routes.ts";
import { routeOptions } from "../project.ts";
import { projectDiagnostics, type CompiledSource } from "./project-checks.ts";
import { ModuleHost } from "./modules.ts";
import { listFiles, loadCompiler, SOURCE_DIR } from "./shadow.ts";

/** TypeScript reports syntax errors itself, on the same (masked) text. */
const REPORTED_BY_TYPESCRIPT = new Set(["LUM1001"]);

/** Compile rounds before giving up on module requests (one per level of re-exports). */
const MAX_ROUNDS = 32;

export interface CompileDiagnosticsOptions {
  /** The project root (island refs are root-relative). */
  root?: string;
  /** Diagnostics already reported for this text (its scan's); not repeated. */
  reported?: readonly CompilerDiagnostic[];
  /**
   * Answers the compiler's requests for modules that `$` constants are imported from. Without it,
   * the compiler withholds the CSS of a file that imports constants, and its style diagnostics.
   */
  modules?: ModuleHost | undefined;
  /**
   * The file is a route module rendered only on the server (`static`/`server` route mode, see
   * `serverRouteFiles`): its default export's props are plain values (no LUM2001 for them).
   */
  serverRoute?: boolean;
  /**
   * The file only runs in the browser (an `spa` route with `export const ssr = false`): no LUM4004.
   * Modules that import `lumen/dom` (client entries) are recognised on their own.
   */
  clientOnly?: boolean;
}

/**
 * Compiles `text`, answering the compiler's module requests from `host` (transitively, up to
 * {@link MAX_ROUNDS} rounds) and recording the modules read as the file's dependencies.
 */
export async function compileWithModules(
  text: string,
  filename: string,
  options: CompileOptions,
  host: ModuleHost,
): Promise<CompileResult> {
  const { compile } = await loadCompiler();
  const modules: HostModule[] = [];
  for (let round = 1; ; round++) {
    const result = compile(text, filename, { ...options, modules });
    if (result.moduleRequests.length === 0 || round === MAX_ROUNDS) {
      host.record(filename, result.cssDeps);
      return result;
    }
    for (const { importer, specifier } of result.moduleRequests) {
      const id = host.resolve(specifier, importer);
      const source = id === null ? undefined : await host.load(id);
      // Without `resolved`, the compiler reports LUM3008 (the module could not be resolved).
      modules.push(
        id === null || source === undefined
          ? { importer, specifier }
          : { importer, specifier, resolved: { id, source } },
      );
    }
  }
}

/**
 * The client compile's diagnostics for one source (UTF-16 spans), without syntax errors and
 * without diagnostics already in `options.reported`.
 */
export async function compileDiagnostics(
  text: string,
  filename: string,
  options: CompileDiagnosticsOptions = {},
): Promise<CompilerDiagnostic[]> {
  return (await compileChecked(text, filename, options)).diagnostics;
}

/** {@link compileDiagnostics} with the compile result (its meta). */
async function compileChecked(
  text: string,
  filename: string,
  options: CompileDiagnosticsOptions,
): Promise<{ result: CompileResult; diagnostics: CompilerDiagnostic[] }> {
  const compileOptions: CompileOptions = {
    target: "client",
    sourceMap: false,
    ...(options.root === undefined ? {} : { root: options.root }),
    ...(options.serverRoute ? { serverRoute: true } : {}),
    // LUM4004 as the server compile reports it (lumen/vite's ssr environment), for modules that
    // server rendering may load.
    browserGlobals: true,
  };
  const result =
    options.modules === undefined
      ? (await loadCompiler()).compile(text, filename, compileOptions)
      : await compileWithModules(text, filename, compileOptions, options.modules);
  const reported = new Set((options.reported ?? []).map(diagnosticKey));
  // A client entry (it mounts with `lumen/dom`) or a client-only route never loads on the server.
  const clientOnly =
    options.clientOnly === true ||
    (result.meta.imports ?? []).some((i) => i.specifier === "lumen/dom");
  const diagnostics = result.diagnostics.filter(
    (diagnostic) =>
      !REPORTED_BY_TYPESCRIPT.has(diagnostic.code) &&
      !reported.has(diagnosticKey(diagnostic)) &&
      !(clientOnly && diagnostic.code === "LUM4004"),
  );
  return { result, diagnostics };
}

/**
 * `lumen check`'s compiler provider: every scanned `.stsx` (its scan diagnostics are already
 * reported) and every `src/**\/*.tsx`. Imported constants are resolved like TypeScript does
 * (with the checked tsconfig's `paths`), each module read once per run.
 */
export const compilerDiagnostics: DiagnosticProvider = async ({
  root,
  project,
  files,
  manifest,
}) => {
  const tsx = await listFiles(join(root, SOURCE_DIR), (name) => name.endsWith(".tsx"));
  const sources = [
    ...files.map((file) => ({
      file: file.source,
      text: file.text,
      reported: file.scan.diagnostics,
    })),
    ...(await Promise.all(
      tsx.map(async (file) => ({ file, text: await readFile(file, "utf8"), reported: [] })),
    )),
  ];
  const modules = new ModuleHost({ root, ...(project === undefined ? {} : { project }) });
  const results: FileDiagnostics[] = [];
  const compiled = new Map<string, CompiledSource>();
  const serverRoutes = manifest === undefined ? new Set() : serverRouteFiles(root, manifest);
  // `spa` routes rendered as client shells (`ssr = false`) never load on the server.
  const clientOnly = new Set(
    (manifest?.routes ?? [])
      .filter((route) => route.kind === "page" && !route.ssr)
      .map((route) => join(root, route.file).replaceAll("\\", "/")),
  );
  for (const { file, text, reported } of sources) {
    const path = resolve(root, file);
    const key = path.replaceAll("\\", "/");
    const checked = await compileChecked(text, path, {
      root,
      reported,
      modules,
      serverRoute: serverRoutes.has(key),
      clientOnly: clientOnly.has(key),
    });
    compiled.set(resolve(root, file), { text, result: checked.result });
    if (checked.diagnostics.length > 0) results.push({ file, diagnostics: checked.diagnostics });
  }
  // LUM4003 and LUM3012 need the whole project (./project-checks.ts).
  for (const found of await projectDiagnostics(root, compiled, modules)) {
    const existing = results.find((entry) => resolve(root, entry.file) === found.file);
    if (existing === undefined) results.push(found);
    else existing.diagnostics = [...existing.diagnostics, ...found.diagnostics];
  }
  return results;
};

/** Route options per project root: reading them resolves the Vite config, so once per root. */
const routeOptionsByRoot = new Map<string, ReturnType<typeof routeOptions>>();

/**
 * Whether `file` is a route module rendered only on the server (`static`/`server` mode), for
 * {@link CompileDiagnosticsOptions.serverRoute} in editors: the routes directory is scanned on
 * each call (route modes may have changed), the project's default mode is read once per root.
 */
export async function isServerRoute(root: string, file: string): Promise<boolean> {
  const path = file.replaceAll("\\", "/");
  if (!path.startsWith(`${root.replaceAll("\\", "/")}/src/routes/`)) return false;
  let options = routeOptionsByRoot.get(root);
  if (options === undefined) {
    options = routeOptions(root).catch(() => ({}));
    routeOptionsByRoot.set(root, options);
  }
  return (await scanServerRoutes(root, await options)).has(path);
}

function diagnosticKey(diagnostic: CompilerDiagnostic): string {
  return `${diagnostic.code}:${diagnostic.span.start}:${diagnostic.span.end}`;
}
