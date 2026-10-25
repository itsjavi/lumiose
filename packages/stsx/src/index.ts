// @lumiose/stsx (decision-86): `.stsx` files (TSX plus raw-CSS `<style>` blocks, scoped by
// placement) for React, Preact, Solid and other JSX frameworks. The framework's own Vite plugin
// compiles the JSX; this one compiles the style blocks.
//
// - **Modules.** `X.stsx` is served as the virtual module `X.stsx.tsx`, so the `.[jt]sx?` filters
//   of the framework plugins (Vite's oxc transform, @vitejs/plugin-react, React Router's refresh
//   transform, vite-plugin-solid) accept it. Its stylesheet is the virtual module `X.stsx.css`,
//   which Vite's CSS pipeline takes from there (targets, extraction, per-route CSS, HMR).
// - **TSX.** `compileTsx()` of @lumiose/compiler: the source with its blocks removed, the scope
//   markers stamped (`scopedStyles`) and an import of the stylesheet. The JS module loads the raw
//   source and `transform` compiles it, so hosts that read a file and transform it themselves
//   (React Router's route exports) get TSX too.
// - **Dependency scan.** Vite's scanner resolves `.stsx` imports through this plugin but loads the
//   files itself: a scanner plugin gives it the masked TSX, so dependencies are pre-bundled on the
//   first load instead of being discovered late (which would load React twice).
// - **Dev URLs.** A request for `/x.stsx` (React Router imports route-adjacent modules by URL) is
//   served as `/x.stsx.tsx`.
// - **Constants.** `$name` constants imported from other modules are resolved with Vite's
//   resolver and read from disk until the compiler has them all; edits to those modules update the
//   CSS of the files that use them.
// - **Types.** The shadow TSX that `tsc` checks `.stsx` files through (./typegen.ts) is written when
//   a dev server or a build starts, and again when a `.stsx` file changes (`stsx typegen` for CI).
// - **React Router.** Route modules cannot be `.stsx`: React Router finds route modules by their
//   file path and would leave their server-only exports in the client. An import of one from its
//   route manifest is an error that shows the supported pattern.

import { readFile } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compileTsx, scan, type HostModule, type TsxResult } from "@lumiose/compiler";
import { normalizePath, type Plugin, type Rollup } from "vite";
import { toLog } from "./diagnostics.ts";
import { validateOptions, type StsxOptions } from "./options.ts";
import { packagesFor } from "./packages.ts";
import { shadowLayout, shadowPathFor, syncShadows, writeShadow } from "./typegen.ts";

export type { ScopedStylesOption, StsxOptions } from "./options.ts";

const JS_SUFFIX = ".tsx";
const CSS_SUFFIX = ".css";
/** `X.stsx.tsx` and `X.stsx.css`, the modules of `X.stsx`. */
const VIRTUAL = /\.stsx\.(tsx|css)$/;
const JS_MODULE = /\.stsx\.tsx(?:\?|$)/;
/** Queries that ask for the file itself, not its module. */
const RAW_QUERY = /(?:^|&)(?:raw|url)(?:&|=|$)/;
/** Modules of React Router that import route modules by their files. */
const ROUTE_IMPORTER = /virtual:react-router\/(?:server-build|server-manifest)/;
const ROUTE_QUERY = /(?:^|&)(?:__react-router-build-client-route|route-chunk=)/;

interface Output {
  code: string;
  map: string | null;
  css: string | null;
  cssMap: string | null;
}

function outputOf(result: TsxResult): Output {
  return {
    code: result.code,
    map: result.map ?? null,
    css: result.css ?? null,
    cssMap: result.cssMap ?? null,
  };
}

/** The `.stsx` file of a module id (`X.stsx.tsx?…` → `X.stsx`). */
function fileOf(id: string): string {
  return id.split("?")[0]!.replace(VIRTUAL, ".stsx");
}

/** The Vite plugin for `.stsx` files. Put it before the framework's plugin. */
export default function stsx(options: StsxOptions): Plugin {
  const { classAttribute, scopedStyles } = validateOptions(options);
  let root = normalizePath(process.cwd());
  /** Shadows are synced once per process, by the first environment that starts. */
  let shadowsSynced = false;
  /** By environment name, then `.stsx` file: the last compiled output. */
  const outputs = new Map<string, Map<string, Output>>();
  /** Modules that `$name` constants were folded from, to the `.stsx` files that use them. */
  const dependents = new Map<string, Set<string>>();

  const outputsOf = (environment: string): Map<string, Output> => {
    let map = outputs.get(environment);
    if (map === undefined) outputs.set(environment, (map = new Map()));
    return map;
  };

  type Resolve = (specifier: string, importer: string) => Promise<string | undefined>;

  async function compileFile(file: string, source: string, resolve: Resolve): Promise<TsxResult> {
    const modules: HostModule[] = [];
    for (let round = 0; ; round++) {
      const result = compileTsx(source, file, {
        classAttribute,
        ...(scopedStyles === undefined ? {} : { scopedStyles }),
        styleImport: file + CSS_SUFFIX,
        root,
        packages: packagesFor(file, root),
        modules,
      });
      if (result.moduleRequests.length === 0 || round === 16) {
        for (const dep of result.cssDeps) {
          let files = dependents.get(dep);
          if (files === undefined) dependents.set(dep, (files = new Set()));
          files.add(file);
        }
        return result;
      }
      for (const request of result.moduleRequests) {
        const module: HostModule = { importer: request.importer, specifier: request.specifier };
        const id = await resolve(request.specifier, request.importer);
        if (id !== undefined && existsSync(id)) {
          module.resolved = { id, source: await readFile(id, "utf8") };
        }
        modules.push(module);
      }
    }
  }

  type Context = Rollup.PluginContext & { environment: { name: string } };

  /**
   * Compiles `source` to TSX from `load` (so that the build's source maps start from this map:
   * Rolldown's native transforms do not compose JS transform maps that follow `load`) and reports
   * its diagnostics: warnings first, then the first error, which stops the build.
   */
  async function emit(
    ctx: Context,
    file: string,
    source: string,
  ): Promise<Rollup.SourceDescription> {
    const result = await compileFile(file, source, async (specifier, importer) => {
      const resolved = await ctx.resolve(specifier, importer, { skipSelf: true });
      return resolved === null || resolved.external ? undefined : fileOf(resolved.id);
    });
    const error = result.diagnostics.find((d) => d.severity === "error");
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.severity !== "error") ctx.warn(toLog(file, source, diagnostic));
    }
    if (error !== undefined) ctx.error(toLog(file, source, error));
    outputsOf(ctx.environment.name).set(file, outputOf(result));
    return { code: result.code, map: result.map ?? null };
  }

  return {
    name: "lumiose:stsx",
    enforce: "pre",

    config() {
      return {
        optimizeDeps: {
          rolldownOptions: {
            plugins: [
              {
                name: "lumiose:stsx-scan",
                load: {
                  filter: { id: VIRTUAL },
                  async handler(id: string) {
                    if (!id.split("?")[0]!.endsWith(JS_SUFFIX))
                      return { code: "", moduleType: "js" };
                    const file = fileOf(id);
                    return {
                      code: scan(await readFile(file, "utf8"), file).masked,
                      moduleType: "tsx",
                    };
                  },
                },
              },
            ],
          },
        },
      };
    },

    configResolved(config) {
      root = normalizePath(config.root);
    },

    buildStart() {
      if (shadowsSynced) return;
      shadowsSynced = true;
      syncShadows(shadowLayout(root));
    },

    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url ?? "").split("?");
        if (pathname?.endsWith(".stsx") && !RAW_QUERY.test(query ?? "")) {
          req.url = pathname + JS_SUFFIX + (query === undefined ? "" : `?${query}`);
        }
        next();
      });
    },

    async resolveId(source, importer, resolveOptions) {
      const [bare = "", query] = source.split("?");
      if (VIRTUAL.test(bare)) {
        // Ids this plugin produced, browser URLs (root-relative) and `/@fs/` URLs.
        for (const id of [bare.replace(/^\/@fs(?=\/)/, ""), join(root, bare)]) {
          const path = normalizePath(id);
          if (existsSync(fileOf(path))) return query === undefined ? path : `${path}?${query}`;
        }
        return null;
      }
      if (!bare.endsWith(".stsx")) return null;
      if (
        (importer !== undefined && ROUTE_IMPORTER.test(importer)) ||
        ROUTE_QUERY.test(query ?? "")
      ) {
        this.error(
          `${bare} is a React Router route module: route modules cannot be .stsx files, because ` +
            "React Router finds them by their file path (its server-only exports would stay in " +
            "the client). Make the route module a .tsx file that renders a component from the " +
            ".stsx file.",
        );
      }
      const resolved = await this.resolve(bare, importer, { ...resolveOptions, skipSelf: true });
      if (resolved === null || resolved.external) return resolved;
      const path = resolved.id.split("?")[0]!;
      if (query !== undefined && RAW_QUERY.test(query)) return `${path}?${query}`;
      return path + JS_SUFFIX + (query === undefined ? "" : `?${query}`);
    },

    async load(id) {
      const match = VIRTUAL.exec(id.split("?")[0]!);
      if (match === null) return null;
      const file = fileOf(id);
      this.addWatchFile(file);
      if (match[1] === "tsx") return emit(this, file, await readFile(file, "utf8"));
      const byFile = outputsOf(this.environment.name);
      let output = byFile.get(file);
      if (output === undefined) {
        const source = await readFile(file, "utf8");
        const result = await compileFile(file, source, async (specifier, importer) => {
          const resolved = await this.resolve(specifier, importer, { skipSelf: true });
          return resolved === null || resolved.external ? undefined : fileOf(resolved.id);
        });
        byFile.set(file, (output = outputOf(result)));
      }
      return {
        code: output.css ?? "",
        map: output.cssMap === null ? null : JSON.parse(output.cssMap),
      };
    },

    // Hosts that read a `.stsx` file and transform it themselves (React Router compiles route
    // files this way) pass the raw source: it is compiled here. The TSX that `load` emitted passes.
    transform: {
      filter: { id: JS_MODULE },
      async handler(code, id) {
        const file = fileOf(id);
        if (outputsOf(this.environment.name).get(file)?.code === code) return null;
        return emit(this, file, code);
      },
    },

    async hotUpdate({ file, modules }) {
      if (file.endsWith(".stsx") && this.environment.config.consumer === "client") {
        const layout = shadowLayout(root);
        if (existsSync(file)) writeShadow(layout, file);
        else rmSync(shadowPathFor(layout, file), { force: true });
      }
      const files = new Set(dependents.get(file) ?? []);
      if (file.endsWith(".stsx") && existsSync(file)) files.add(file);
      if (files.size === 0) return;
      const environment = this.environment;
      const graph = environment.moduleGraph;
      const byFile = outputsOf(environment.name);
      // Each changed `.stsx` file gets one update, sent here through `reloadModule()`. Its modules
      // (the file, which `load` watches, and its virtual modules) are not passed on: React Router
      // reloads the client copy of every module a hook passes on, which would send each update
      // two or three times.
      const others = modules.filter((mod) => mod.file === null || !files.has(fileOf(mod.file)));
      const client = environment.config.consumer === "client";
      for (const changed of files) {
        const previous = byFile.get(changed);
        const source = await readFile(changed, "utf8");
        const result = await compileFile(changed, source, async (specifier, importer) => {
          const resolved = await environment.pluginContainer.resolveId(specifier, importer);
          return resolved === null || resolved.external ? undefined : fileOf(resolved.id);
        });
        const next = outputOf(result);
        byFile.set(changed, next);
        const css = graph.getModuleById(changed + CSS_SUFFIX);
        const js = graph.getModuleById(changed + JS_SUFFIX);
        const cssChanged = previous === undefined || next.css !== previous.css;
        // A changed stylesheet gets a new HMR timestamp, so a new TSX imports it afresh. Its other
        // variants (`X.stsx.css?inline`, server-rendered critical CSS) are re-read on their next use.
        if (cssChanged) {
          const timestamp = Date.now();
          for (const variant of graph.getModulesByFile(changed + CSS_SUFFIX) ?? []) {
            graph.invalidateModule(variant, new Set(), timestamp, true);
          }
        }
        if (js !== undefined && next.code !== previous?.code) {
          await environment.reloadModule(js);
        } else if (css !== undefined && cssChanged && client) {
          // A style-only edit replaces the stylesheet alone; servers re-read it on their next
          // render.
          await environment.reloadModule(css);
        }
      }
      return others;
    },
  };
}
