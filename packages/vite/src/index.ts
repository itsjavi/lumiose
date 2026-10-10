// `@lumiose/vite`: the Vite 8 plugin (owner: Photon; spec §5.5, decision-5).
//
// - Compiles `.stsx` and `.tsx` modules (outside node_modules) with the native Lumiose compiler,
//   before Vite's own OXC transform, which is told to skip them. The target follows the Vite
//   environment: `lumiose/server` code for server consumers (SSR), `lumiose/dom` code otherwise.
// - Compiler diagnostics become Vite warnings and errors with code frames (the dev overlay).
// - `lumiose` resolves its `browser` export in client environments and its `node` export in server
//   environments; Vite processes it in both (never externalized or pre-bundled), so compiled code
//   and the runtime share one module instance. Vitest's DOM environments (happy-dom, jsdom) are
//   client environments with Node's conditions: they get the browser entry too (TASK-54).
// - HMR (v1): a client module that imports `render` from `lumiose/dom` (an app entry) accepts
//   updates of itself and of every module it reaches, so an edit re-runs the entry, which
//   re-renders the app into the same container after disposing the previous root. Component state
//   is reset; module-level signals of unchanged modules survive. Per-component hot replacement
//   can come later without changing this contract.
// - Style blocks: compiled code imports `<id>?lumiose&type=style&lang.css`, served from the
//   compiler's CSS through Vite's CSS pipeline, with imported `$name` constants loaded through
//   Vite's resolver and CSS-only HMR for style edits (./styles.ts).
// - `virtual:lumiose/islands` is the island manifest (./islands.ts). Island refs are root-relative
//   (`/src/components/Team.stsx#TeamPanel`) for modules inside the Vite root and package-relative
//   (`@acme/ui/src/Nav.stsx#Nav`) outside it, so the HTML never holds build-machine paths; the
//   scan covers linked Lumiose packages too (./packages.ts).
// - `virtual:lumiose/css-manifest` is the CSS manifest of builds (./css-manifest.ts): every
//   stylesheet is built in the client environment, and the server build maps each route module to
//   the stylesheets its static import graph reaches.
// - `.svg` imports are inline components (`lumiose({ svg })`, ./svg.ts); `?url` and `?raw` stay
//   Vite's.
// - `.md` and `.html` imports are components (`lumiose({ md, html })`, ./content.ts): their Lumiose
//   modules (`<file>.md.stsx`) are compiled here like any `.stsx` module, with the source
//   generated from the file (`content.source`, also for their CSS modules and the build scan).
// - Project options (`mode`, `ssr`, `trailingSlash`, `csrf`; decision-21) are validated here and
//   exposed as the plugin's `api.options` for `lumiose dev`/`build` and the CLI (./options.ts).

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Diagnostic } from "@lumiose/compiler";
import { writeLumioseTsconfig } from "./layout.ts";
import {
  defaultClientConditions,
  defaultServerConditions,
  normalizePath,
  type DevEnvironment,
  type EnvironmentOptions,
  type Plugin,
  type ResolvedConfig,
  type Rollup,
  type UserConfig,
  type ViteDevServer,
} from "vite";
import { contentOf, contentOptionsOf } from "./content.ts";
import { CSS_MANIFEST_ID, CssManifest, cssManifestCode, fillManifest } from "./css-manifest.ts";
import { CustomPropertyCheck, unreadMessage } from "./custom-properties.ts";
import { ISLANDS_ID, IslandRegistry } from "./islands.ts";
import { projectOptionsOf, type LumioseOptions, type LumiosePluginApi } from "./options.ts";
import { Packages } from "./packages.ts";
import { scanProject, type ScannedModule } from "./scan.ts";
import {
  STYLE_QUERY,
  StyleCache,
  cleanId,
  compileWithModules,
  linkedStyleUrl,
  type Resolve,
  type Target,
} from "./styles.ts";
import { serverOnlyPlugin } from "./server-only.ts";
import { scanServerRoutes } from "./server-routes.ts";
import { svgOptionsOf, svgPlugin } from "./svg.ts";

export type {
  CsrfOptions,
  LumioseOptions,
  LumiosePluginApi,
  MarkdownOptions,
  ProjectOptions,
  RouteMode,
  SvgOptions,
  TrailingSlash,
} from "./options.ts";

const LUMIOSE_MODULE = /\.(?:stsx|tsx)$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;
/** Vite's default OXC exclusion, kept when Lumiose files are added to it. */
const VITE_OXC_EXCLUDE = /\.js$/;
/** Every entry point of the `lumiose` package (kept out of dependency pre-bundling). */
const LUMIOSE_ENTRIES = [
  "lumiose",
  "lumiose/dom",
  "lumiose/dom/hydrate",
  "lumiose/dom/hot",
  "lumiose/server",
  "lumiose/router",
  "@lumiose/compiler",
];
/** Stylesheets Vite's CSS pipeline handles (its `CSS_LANGS_RE`). */
const STYLESHEET = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
/** `path` as a literal glob prefix (Vite matches `server.fs.deny` with picomatch). */
function globEscape(path: string): string {
  return path.replace(/[()[\]{}*?!+@]/g, "\\$&");
}

/** Vite 8's default `server.fs.deny`, kept when Lumiose adds server-only files to it. */
const VITE_FS_DENY = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
];
const HMR_DOM = "virtual:lumiose/hmr-dom";
const HMR_DOM_ID = "\0lumiose:hmr-dom";
// The compiler prints user imports verbatim, normalized by the code printer.
const IMPORTS_RENDER = /import\s*\{[^}]*\brender\b[^}]*\}\s*from\s*"lumiose\/dom"/;

export default function lumiose(options: LumioseOptions = {}): Plugin<LumiosePluginApi>[] {
  const api: LumiosePluginApi = {
    options: Object.freeze(projectOptionsOf(options)),
    islandModules: () => islands.modules(),
    cssManifest: (context) => cssManifest.manifest(context, root),
  };
  const svg = svgOptionsOf(options.svg);
  const include = options.include ?? LUMIOSE_MODULE;
  const exclude = options.exclude ?? NODE_MODULES;
  const content = contentOf(contentOptionsOf(options.md, options.html), exclude);
  // Content modules (`<file>.md.stsx`) are Lumiose modules whatever `include` says.
  const lumioseModules = content ? [include, content.moduleFilter] : [include];
  let serve = false;
  let root = process.cwd();
  let devServer: ViteDevServer | undefined;
  const islands = new IslandRegistry();
  const styles = new StyleCache();
  const cssManifest = new CssManifest();
  const customProperties = new CustomPropertyCheck();
  let packages = new Packages(root, exclude);
  let scanned: ScannedModule[] | undefined;
  const project = (): ScannedModule[] =>
    (scanned ??= scanProject(root, include, exclude, packages, content));
  // Every compile of a file names modules alike, so its JS and CSS agree on scope tokens.
  const compileOptions = (file: string, target: Target) => ({
    target,
    sourceMap: true,
    root,
    packages: packages.for(cleanId(file)),
    // Static `style` strings through the CSSOM, nonces on JSX scripts and styles (TASK-142).
    ...(api.options.csp === "strict" ? { strictCsp: true } : {}),
    // Component-level hot updates in dev (TASK-146; the compiler applies it to client code), not
    // under Vitest, whose modules are not hot-updated.
    ...(serve && process.env["VITEST"] === undefined ? { hot: true } : {}),
  });
  const isLumioseFile = (file: string): boolean => include.test(file) && !exclude.test(file);
  // Server-rendered route modules (./server-routes.ts), scanned once and again after a route
  // module changes (its `mode` export may have).
  let serverRoutes: Promise<Set<string>> | undefined;
  const isServerRoute = async (file: string): Promise<boolean> => {
    const { mode, ssr } = api.options;
    serverRoutes ??= scanServerRoutes(root, {
      ...(mode === undefined ? {} : { defaultMode: mode }),
      ...(ssr === undefined ? {} : { defaultSsr: ssr }),
    });
    return (await serverRoutes).has(cleanId(file));
  };
  return [
    {
      name: "lumiose",
      enforce: "pre",
      // The project options (`mode`, `ssr`, …) the app layer reads (app/project.ts).
      api,
      // One instance for every environment of a build: the server build reads the stylesheets
      // the client build recorded (./css-manifest.ts), also when a config file is resolved again
      // per environment.
      sharedDuringBuild: true,

      config(config, env) {
        serve = env.command === "serve";
        const out: UserConfig = {};
        // decision-29: only `PUBLIC_` variables reach client code through `import.meta.env`.
        if (config.envPrefix === undefined) out.envPrefix = "PUBLIC_";
        // decision-29: the dev server does not serve server-only files over HTTP (`/@fs/`, `?raw`);
        // the ssr environment still loads them. Both are the user's to override.
        if (config.server?.fs?.deny === undefined) {
          // Anchored at the project: dependencies (lumiose's own `src/server/` helpers) stay served.
          const base = globEscape(normalizePath(resolve(config.root ?? process.cwd())));
          out.server = {
            fs: { deny: [...VITE_FS_DENY, `${base}/**/*.server.*`, `${base}/src/server/**`] },
          };
        }
        // LUM4003 in web worker bundles too (./server-only.ts).
        const workerPlugins = config.worker?.plugins;
        out.worker = {
          plugins: () => [serverOnlyPlugin({ worker: true }), ...(workerPlugins?.() ?? [])],
        };
        const oxc = config.oxc;
        // `oxc: false` disables Vite's transform altogether; an explicit include/exclude is the
        // user's call. Otherwise Lumiose modules are added to Vite's default exclusion.
        if (oxc !== false && oxc?.include === undefined && oxc?.exclude === undefined) {
          out.oxc = { exclude: [VITE_OXC_EXCLUDE, ...lumioseModules] };
        }
        return out;
      },

      async configResolved(config) {
        root = config.root;
        packages = new Packages(root, exclude);
        // Vite reads the project's tsconfig, which may extend the generated one (TASK-73).
        await writeLumioseTsconfig(root);
      },

      configureServer(server) {
        devServer = server;
        // Before Vite's transform middleware: a hot-updated `<link rel="stylesheet">` of a style
        // module comes back without its query (./styles.ts `linkedStyleUrl`).
        server.middlewares.use((req, _res, next) => {
          const url = req.url && linkedStyleUrl(req.url, req.headers.accept, isLumioseFile);
          if (url) req.url = url;
          next();
        });
      },

      configEnvironment(name, config) {
        const server = (config.consumer ?? (name === "client" ? "client" : "server")) === "server";
        const out: EnvironmentOptions = {
          resolve: {
            // Explicit per consumer: `browser` → src/index.ts, `node` → src/index.server.ts.
            conditions: config.resolve?.conditions ?? [
              ...(server ? defaultServerConditions : defaultClientConditions),
            ],
          },
          optimizeDeps: { exclude: LUMIOSE_ENTRIES },
        };
        if (server) out.resolve!.noExternal = ["lumiose"];
        return out;
      },

      resolveId: {
        filter: { id: /^(?:virtual:lumiose\/(?:hmr-dom|islands|css-manifest)|lumiose)$/ },
        async handler(id, importer) {
          if (id !== "lumiose") return `\0lumiose:${id.slice("virtual:lumiose/".length)}`;
          // Client environments run the browser entry of `lumiose`, whatever their conditions:
          // Vitest gives its DOM environments (happy-dom, jsdom) Node's conditions, whose entry
          // (index.server.ts) has no reactive graph, so mounted components would never update.
          if (this.environment.config.consumer !== "client") return null;
          const manifest = await this.resolve("lumiose/package.json", importer, { skipSelf: true });
          return manifest === null || manifest.external ? null : browserEntry(manifest.id);
        },
      },

      load: {
        filter: { id: [/^\0lumiose:(?:hmr-dom|islands|css-manifest)$/, STYLE_QUERY] },
        async handler(id) {
          if (id === HMR_DOM_ID) return HMR_DOM_CODE;
          if (id === ISLANDS_ID) {
            islands.scan(project);
            return islands.code();
          }
          const serverBuild = !serve && this.environment.config.consumer === "server";
          if (id === CSS_MANIFEST_ID) return cssManifestCode(serverBuild);
          // The client build builds every stylesheet; the server's are empty (no CSS assets).
          if (serverBuild) return "";
          // `<file>?lumiose&type=style&lang.css`: the file's CSS; Vite's CSS plugin takes it from here.
          const file = cleanId(id);
          let source: string;
          try {
            source = content?.isModule(file) ? content.source(file) : await readFile(file, "utf8");
          } catch {
            return "";
          }
          // A content module's CSS comes from its `.md`/`.html` file.
          if (content?.isModule(file)) this.addWatchFile(file.replace(/\.stsx$/, ""));
          let entry = styles.get(file);
          if (entry === undefined || entry.source !== source) {
            const result = await compileWithModules(
              source,
              file,
              compileOptions(file, "client"),
              pluginResolve(this),
            );
            entry = styles.record(file, source, result, false);
            if (!serve) customProperties.module(file, source, result);
          }
          // Constants modules join the graph as imports of the CSS module (token edits update it).
          for (const dep of entry.deps) this.addWatchFile(dep);
          if (!entry.reported) {
            // Compiled here (not by the module's transform): a style-only edit.
            entry.reported = true;
            reportFromLoad(this, file, source, entry.result.diagnostics);
          }
          return { code: entry.css ?? "", map: entry.cssMap };
        },
      },

      async buildStart() {
        const environment = this.environment;
        if (serve || environment.config.consumer !== "client") return;
        if (hasServerBuild(environment.getTopLevelConfig())) {
          await cssManifest.emit(this, project());
        }
      },

      buildEnd(error) {
        // Every module of the build is compiled: report the custom properties no stylesheet
        // reads, once, at the end of the last environment (the server's in an SSR app).
        const environment = this.environment;
        if (serve || error) return;
        const last = hasServerBuild(environment.getTopLevelConfig()) ? "server" : "client";
        if (environment.config.consumer !== last) return;
        for (const unread of customProperties.unread()) {
          const { file, line, column } = unread;
          this.warn({ message: unreadMessage(unread.name), id: file, loc: { file, line, column } });
        }
      },

      generateBundle(_, bundle) {
        const config = this.environment.config;
        if (serve || config.consumer !== "client") return;
        cssManifest.record(bundle, config.base, config.build.cssCodeSplit);
      },

      renderChunk(code, chunk) {
        if (serve || !chunk.moduleIds.includes(CSS_MANIFEST_ID)) return null;
        const filled = fillManifest(code, cssManifest.manifest(this, root));
        return filled === null ? null : { code: filled, map: null };
      },

      watchChange(id) {
        styles.invalidateDependents(cleanId(id));
        if (normalizePath(id).startsWith(`${normalizePath(root)}/src/routes/`)) {
          serverRoutes = undefined;
        }
      },

      hotUpdate: {
        async handler({ file, modules, read }) {
          const environment = this.environment;
          if (!isLumioseFile(file)) {
            // A module that imported constants are read from: update the CSS of its dependents.
            const extra = styles
              .dependents(file)
              .flatMap((dependent) => [
                ...(environment.moduleGraph.getModulesByFile(dependent) ?? []),
              ])
              .filter((mod) => mod.id !== null && STYLE_QUERY.test(mod.id));
            styles.invalidateDependents(file);
            return extra.length === 0 ? undefined : [...new Set([...modules, ...extra])];
          }
          const styleModules = modules.filter((mod) => mod.id !== null && STYLE_QUERY.test(mod.id));
          const target: Target = environment.config.consumer === "server" ? "server" : "client";
          const previous = styles.code(file, target);
          if (styleModules.length === 0 || previous === undefined) return;
          const source = await read();
          const result = await compileWithModules(
            source,
            file,
            compileOptions(file, target),
            environmentResolve(environment),
          );
          styles.record(file, source, result, false);
          // Same JS and no JS errors (the parser recovers from some, keeping the same code): only
          // the style blocks changed, so only the CSS module is updated. Style diagnostics are
          // reported by its load.
          const jsErrors = result.diagnostics.some(
            (d) => d.severity === "error" && !d.code.startsWith("LUM3"),
          );
          if (result.code === previous && !jsErrors) return styleModules;
          // Code with errors never runs: the environment keeps the previous module.
          if (!jsErrors) styles.setCode(file, target, result.code);
        },
      },

      transform: {
        filter: { id: { include: lumioseModules, exclude } },
        async handler(code, id) {
          const target: Target =
            this.environment.config.consumer === "server" ? "server" : "client";
          const result = await compileWithModules(
            code,
            id,
            { ...compileOptions(id, target), serverRoute: await isServerRoute(id) },
            pluginResolve(this),
          );
          const errors = result.diagnostics.filter((d) => d.severity === "error");
          if (!serve) customProperties.module(cleanId(id), code, result);
          if (result.meta.hasStyles) {
            const file = cleanId(id);
            styles.record(file, code, result, true);
            // The JS this environment runs (modules with errors never run).
            if (errors.length === 0) styles.setCode(file, target, result.code);
          }
          if (islands.add(result.meta.islands) && devServer) {
            // A call site the manifest has not seen: the next import gets the new manifest.
            const graph = devServer.environments.client.moduleGraph;
            const manifest = graph.getModuleById(ISLANDS_ID);
            if (manifest) graph.invalidateModule(manifest);
          }
          for (const diagnostic of result.diagnostics) {
            if (diagnostic.severity !== "error") {
              this.warn(message(diagnostic), diagnostic.span.start);
            }
          }
          if (errors.length > 0) {
            const [first, ...rest] = errors;
            const more = rest.map((d) => `\n${message(d)}`).join("");
            this.error(diagnosticError(message(first!) + more, { id }), first!.span.start);
          }
          let out = result.code;
          if (serve && target === "client" && IMPORTS_RENDER.test(out)) out = hmrEntry(out);
          return { code: out, map: result.map, moduleType: "js" };
        },
      },
    },
    {
      // The `var()` reads of the project's other stylesheets, for `LUM3012` (before Sass & co.).
      name: "lumiose:custom-properties",
      apply: "build",
      enforce: "pre",
      sharedDuringBuild: true,
      transform: {
        filter: { id: { include: STYLESHEET, exclude: [STYLE_QUERY, /^\0/] } },
        handler(code, id) {
          customProperties.stylesheet(id, code);
          return null;
        },
      },
    },
    // LUM4003: server-only modules never enter a client graph (./server-only.ts).
    serverOnlyPlugin(),
    // `.svg` imports as inline components (./svg.ts).
    ...(svg ? [svgPlugin(svg, exclude, () => root)] : []),
    // `.md` and `.html` imports as components (./content.ts).
    ...(content ? [content.plugin()] : []),
  ];
}

const browserEntries = new Map<string, string | null>();

/** The `browser` export of `lumiose` from its package.json (`null` when it has none). */
function browserEntry(manifest: string): string | null {
  let entry = browserEntries.get(manifest);
  if (entry === undefined) {
    const { exports } = JSON.parse(readFileSync(manifest, "utf8")) as {
      exports?: { ".": { browser?: string } };
    };
    const browser = exports?.["."].browser;
    entry = browser === undefined ? null : normalizePath(join(dirname(manifest), browser));
    browserEntries.set(manifest, entry);
  }
  return entry;
}

/** Whether the build has a server environment to build (an SSR app, not a client-only SPA). */
function hasServerBuild(config: ResolvedConfig): boolean {
  if (config.build.ssr) return true;
  return Object.values(config.environments).some(
    (environment) =>
      environment.consumer === "server" &&
      (environment.build.rolldownOptions.input !== undefined || Boolean(environment.build.ssr)),
  );
}

/** Resolution through the plugin pipeline (aliases, extensions, tsconfig paths). */
function pluginResolve(context: Rollup.PluginContext): Resolve {
  return async (specifier, importer) => {
    const resolved = await context.resolve(specifier, importer, { skipSelf: true });
    return resolved !== null && !resolved.external ? resolved.id : null;
  };
}

function environmentResolve(environment: DevEnvironment): Resolve {
  return async (specifier, importer) => {
    const resolved = await environment.pluginContainer.resolveId(specifier, importer);
    return resolved !== null && !resolved.external ? resolved.id : null;
  };
}

/**
 * Style diagnostics (`LUM3xxx`) of a compile done by the CSS module's `load` after a style-only
 * edit; the others belong to the JS module's transform. (`load` has no `pos` argument.)
 */
function reportFromLoad(
  context: Rollup.PluginContext,
  file: string,
  source: string,
  all: readonly Diagnostic[],
): void {
  const diagnostics = all.filter((d) => d.code.startsWith("LUM3"));
  const loc = (offset: number) => {
    const before = source.slice(0, offset);
    const line = before.split("\n").length;
    return { file, line, column: offset - (before.lastIndexOf("\n") + 1) };
  };
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "error") {
      context.warn({ message: message(diagnostic), loc: loc(diagnostic.span.start) });
    }
  }
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    const more = errors
      .slice(1)
      .map((d) => `\n${message(d)}`)
      .join("");
    context.error(
      diagnosticError(message(errors[0]!) + more, { id: file, loc: loc(errors[0]!.span.start) }),
    );
  }
}

/**
 * A LUMxxxx build error. Its message, help and code frame explain it, so it has no stack: the
 * bundler would print the plugin's internals after the frame (TASK-122).
 */
function diagnosticError(text: string, props: { id: string; loc?: unknown }): Error {
  const error = Object.assign(new Error(text), props);
  error.name = "LumioseError";
  error.stack = "";
  return error;
}

function message(diagnostic: Diagnostic): string {
  let text = `${diagnostic.code}: ${diagnostic.message}`;
  if (diagnostic.help) text += `\nhelp: ${diagnostic.help}`;
  return text;
}

/**
 * An app entry in dev: its `lumiose/dom` imports go through the HMR wrapper (whose `render` disposes
 * the previous root of the same container) and the module accepts updates, so an edit anywhere
 * below it re-runs it with the updated modules.
 */
function hmrEntry(code: string): string {
  return (
    code.replaceAll('from "lumiose/dom"', `from "${HMR_DOM}"`) +
    "\nif (import.meta.hot) import.meta.hot.accept();\n"
  );
}

const HMR_DOM_CODE = `import { render as renderRoot } from "lumiose/dom";
export * from "lumiose/dom";
const roots = (globalThis.__LUMIOSE_HMR_ROOTS__ ??= new Map());
export function render(code, container) {
  roots.get(container)?.();
  const dispose = renderRoot(code, container);
  roots.set(container, dispose);
  return () => {
    if (roots.get(container) === dispose) roots.delete(container);
    dispose();
  };
}
`;
