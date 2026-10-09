// `lumen/vite`: the Vite 8 plugin (owner: Photon; spec §5.5, decision-5).
//
// - Compiles `.stsx` and `.tsx` modules (outside node_modules) with the native Lumen compiler,
//   before Vite's own OXC transform, which is told to skip them. The target follows the Vite
//   environment: `lumen/server` code for server consumers (SSR), `lumen/dom` code otherwise.
// - Compiler diagnostics become Vite warnings and errors with code frames (the dev overlay).
// - `lumen` resolves its `browser` export in client environments and its `node` export in server
//   environments; Vite processes it in both (never externalized or pre-bundled), so compiled code
//   and the runtime share one module instance. Vitest's DOM environments (happy-dom, jsdom) are
//   client environments with Node's conditions: they get the browser entry too (TASK-54).
// - HMR (v1): a client module that imports `mount` from `lumen/dom` (an app entry) accepts
//   updates of itself and of every module it reaches, so an edit re-runs the entry, which
//   re-mounts the app into the same container after disposing the previous root. Component state
//   is reset; module-level signals of unchanged modules survive. Per-component hot replacement
//   can come later without changing this contract.
// - Style blocks: compiled code imports `<id>?lumen&type=style&lang.css`, served from the
//   compiler's CSS through Vite's CSS pipeline, with imported `$name` constants loaded through
//   Vite's resolver and CSS-only HMR for style edits (./styles.ts).
// - `virtual:lumen/islands` is the island manifest (./islands.ts). Island refs are root-relative
//   (`/src/components/Team.stsx#TeamPanel`) for modules inside the Vite root and package-relative
//   (`@acme/ui/src/Nav.stsx#Nav`) outside it, so the HTML never holds build-machine paths; the
//   scan covers linked Lumen packages too (./packages.ts).
// - `virtual:lumen/css-manifest` is the CSS manifest of builds (./css-manifest.ts): every
//   stylesheet is built in the client environment, and the server build maps each route module to
//   the stylesheets its static import graph reaches.
// - `.svg` imports are inline components (`lumen({ svg })`, ./svg.ts); `?url` and `?raw` stay
//   Vite's.
// - `.md` and `.html` imports are components (`lumen({ md, html })`, ./content.ts): their Lumen
//   modules (`<file>.md.stsx`) are compiled here like any `.stsx` module, with the source
//   generated from the file (`content.source`, also for their CSS modules and the build scan).
// - Project options (`mode`, `ssr`, `trailingSlash`, `csrf`; decision-21) are validated here and
//   exposed as the plugin's `api.options` for `lumen dev`/`build` and the CLI (./options.ts).

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Diagnostic } from "@lumen/compiler";
import { writeLumenTsconfig } from "../cli/check/layout.ts";
import {
  defaultClientConditions,
  defaultServerConditions,
  normalizePath,
  type DevEnvironment,
  type EnvironmentOptions,
  type Plugin,
  type ResolvedConfig,
  type Rollup,
  type ViteDevServer,
} from "vite";
import { contentOf, contentOptionsOf } from "./content.ts";
import { CSS_MANIFEST_ID, CssManifest, cssManifestCode, fillManifest } from "./css-manifest.ts";
import { CustomPropertyCheck, unreadMessage } from "./custom-properties.ts";
import { ISLANDS_ID, IslandRegistry } from "./islands.ts";
import { projectOptionsOf, type LumenOptions, type LumenPluginApi } from "./options.ts";
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
import { svgOptionsOf, svgPlugin } from "./svg.ts";

export type {
  CsrfOptions,
  LumenOptions,
  LumenPluginApi,
  MarkdownOptions,
  ProjectOptions,
  RouteMode,
  SvgOptions,
  TrailingSlash,
} from "./options.ts";

const LUMEN_MODULE = /\.(?:stsx|tsx)$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;
/** Vite's default OXC exclusion, kept when Lumen files are added to it. */
const VITE_OXC_EXCLUDE = /\.js$/;
/** Every entry point of the `lumen` package (kept out of dependency pre-bundling). */
const LUMEN_ENTRIES = [
  "lumen",
  "lumen/dom",
  "lumen/dom/hydrate",
  "lumen/server",
  "lumen/router",
  "@lumen/compiler",
];
/** Stylesheets Vite's CSS pipeline handles (its `CSS_LANGS_RE`). */
const STYLESHEET = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const HMR_DOM = "virtual:lumen/hmr-dom";
const HMR_DOM_ID = "\0lumen:hmr-dom";
// The compiler prints user imports verbatim, normalized by the code printer.
const IMPORTS_MOUNT = /import\s*\{[^}]*\bmount\b[^}]*\}\s*from\s*"lumen\/dom"/;

export default function lumen(options: LumenOptions = {}): Plugin<LumenPluginApi>[] {
  const api: LumenPluginApi = {
    options: Object.freeze(projectOptionsOf(options)),
    islandModules: () => islands.modules(),
  };
  const svg = svgOptionsOf(options.svg);
  const include = options.include ?? LUMEN_MODULE;
  const exclude = options.exclude ?? NODE_MODULES;
  const content = contentOf(contentOptionsOf(options.md, options.html), exclude);
  // Content modules (`<file>.md.stsx`) are Lumen modules whatever `include` says.
  const lumenModules = content ? [include, content.moduleFilter] : [include];
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
  });
  const isLumenFile = (file: string): boolean => include.test(file) && !exclude.test(file);
  return [
    {
      name: "lumen",
      enforce: "pre",
      // The project options (`mode`, `ssr`, …) the app layer reads (app/project.ts).
      api,
      // One instance for every environment of a build: the server build reads the stylesheets
      // the client build recorded (./css-manifest.ts), also when a config file is resolved again
      // per environment.
      sharedDuringBuild: true,

      config(config, env) {
        serve = env.command === "serve";
        const oxc = config.oxc;
        // `oxc: false` disables Vite's transform altogether; an explicit include/exclude is the
        // user's call. Otherwise Lumen modules are added to Vite's default exclusion.
        if (oxc === false || oxc?.include !== undefined || oxc?.exclude !== undefined) return;
        return { oxc: { exclude: [VITE_OXC_EXCLUDE, ...lumenModules] } };
      },

      async configResolved(config) {
        root = config.root;
        packages = new Packages(root, exclude);
        // Vite reads the project's tsconfig, which may extend the generated one (TASK-73).
        await writeLumenTsconfig(root);
      },

      configureServer(server) {
        devServer = server;
        // Before Vite's transform middleware: a hot-updated `<link rel="stylesheet">` of a style
        // module comes back without its query (./styles.ts `linkedStyleUrl`).
        server.middlewares.use((req, _res, next) => {
          const url = req.url && linkedStyleUrl(req.url, req.headers.accept, isLumenFile);
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
          optimizeDeps: { exclude: LUMEN_ENTRIES },
        };
        if (server) out.resolve!.noExternal = ["lumen"];
        return out;
      },

      resolveId: {
        filter: { id: /^(?:virtual:lumen\/(?:hmr-dom|islands|css-manifest)|lumen)$/ },
        async handler(id, importer) {
          if (id !== "lumen") return `\0lumen:${id.slice("virtual:lumen/".length)}`;
          // Client environments run the browser entry of `lumen`, whatever their conditions:
          // Vitest gives its DOM environments (happy-dom, jsdom) Node's conditions, whose entry
          // (index.server.ts) has no reactive graph, so mounted components would never update.
          if (this.environment.config.consumer !== "client") return null;
          const manifest = await this.resolve("lumen/package.json", importer, { skipSelf: true });
          return manifest === null || manifest.external ? null : browserEntry(manifest.id);
        },
      },

      load: {
        filter: { id: [/^\0lumen:(?:hmr-dom|islands|css-manifest)$/, STYLE_QUERY] },
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
          // `<file>?lumen&type=style&lang.css`: the file's CSS; Vite's CSS plugin takes it from here.
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
      },

      hotUpdate: {
        async handler({ file, modules, read }) {
          const environment = this.environment;
          if (!isLumenFile(file)) {
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
        filter: { id: { include: lumenModules, exclude } },
        async handler(code, id) {
          const target: Target =
            this.environment.config.consumer === "server" ? "server" : "client";
          const result = await compileWithModules(
            code,
            id,
            compileOptions(id, target),
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
            this.error({ message: message(first!) + more, id }, first!.span.start);
          }
          let out = result.code;
          if (serve && target === "client" && IMPORTS_MOUNT.test(out)) out = hmrEntry(out);
          return { code: out, map: result.map, moduleType: "js" };
        },
      },
    },
    {
      // The `var()` reads of the project's other stylesheets, for `LUM3012` (before Sass & co.).
      name: "lumen:custom-properties",
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

/** The `browser` export of `lumen` from its package.json (`null` when it has none). */
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
    context.error({
      message: message(errors[0]!) + more,
      id: file,
      loc: loc(errors[0]!.span.start),
    });
  }
}

function message(diagnostic: Diagnostic): string {
  let text = `${diagnostic.code}: ${diagnostic.message}`;
  if (diagnostic.help) text += `\nhelp: ${diagnostic.help}`;
  return text;
}

/**
 * An app entry in dev: its `lumen/dom` imports go through the HMR wrapper (whose `mount` disposes
 * the previous root of the same container) and the module accepts updates, so an edit anywhere
 * below it re-runs it with the updated modules.
 */
function hmrEntry(code: string): string {
  return (
    code.replaceAll('from "lumen/dom"', `from "${HMR_DOM}"`) +
    "\nif (import.meta.hot) import.meta.hot.accept();\n"
  );
}

const HMR_DOM_CODE = `import { mount as mountRoot } from "lumen/dom";
export * from "lumen/dom";
const roots = (globalThis.__LUMEN_HMR_ROOTS__ ??= new Map());
export function mount(code, container) {
  roots.get(container)?.();
  const dispose = mountRoot(code, container);
  roots.set(container, dispose);
  return () => {
    if (roots.get(container) === dispose) roots.delete(container);
    dispose();
  };
}
`;
