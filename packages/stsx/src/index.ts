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
// - **React Router.** Route modules cannot be `.stsx`: React Router finds route modules by their
//   file path and would leave their server-only exports in the client. An import of one from its
//   route manifest is an error that shows the supported pattern.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { compileTsx, scan, type HostModule, type TsxResult } from "@lumiose/compiler";
import { normalizePath, type EnvironmentModuleNode, type Plugin } from "vite";
import { toLog } from "./diagnostics.ts";
import { validateOptions, type StsxOptions } from "./options.ts";
import { packagesFor } from "./packages.ts";

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
      if (match[1] === "tsx") return { code: await readFile(file, "utf8") };
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

    transform: {
      filter: { id: JS_MODULE },
      async handler(code, id) {
        const file = fileOf(id);
        const result = await compileFile(file, code, async (specifier, importer) => {
          const resolved = await this.resolve(specifier, importer, { skipSelf: true });
          return resolved === null || resolved.external ? undefined : fileOf(resolved.id);
        });
        // Warnings first, then the first error (which stops the transform).
        const error = result.diagnostics.find((d) => d.severity === "error");
        for (const diagnostic of result.diagnostics) {
          if (diagnostic.severity !== "error") this.warn(toLog(file, code, diagnostic));
        }
        if (error !== undefined) this.error(toLog(file, code, error));
        outputsOf(this.environment.name).set(file, outputOf(result));
        return { code: result.code, map: result.map ?? null };
      },
    },

    async hotUpdate({ file, modules }) {
      const files = new Set(dependents.get(file) ?? []);
      if (file.endsWith(".stsx")) files.add(file);
      if (files.size === 0) return;
      const environment = this.environment;
      const graph = environment.moduleGraph;
      const byFile = outputsOf(environment.name);
      const updates: EnvironmentModuleNode[] = modules.filter(
        (mod) => mod.file === null || !files.has(mod.file),
      );
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
        if (css !== undefined) {
          graph.invalidateModule(css);
          updates.push(css);
        }
        // A style-only edit leaves the TSX as it was: only the stylesheet is replaced.
        const js = graph.getModuleById(changed + JS_SUFFIX);
        if (js !== undefined && next.code !== previous?.code) {
          graph.invalidateModule(js);
          updates.push(js);
        }
      }
      return updates;
    },
  };
}
