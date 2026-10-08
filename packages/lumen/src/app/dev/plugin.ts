// The app side of `lumen dev` (spec §8 "Dev and config", decision-5): a Vite 8 plugin that serves
// file routes from source through the request handler.
//
// - Environments: route modules, middleware and the document load in Vite's `ssr` environment
//   (its module runner), together with the request handler and the server runtime, so compiled
//   code, `lumen` and the handler share one module instance (request scope, render frames).
//   Islands and SPA code are client-environment modules served by Vite as usual.
// - Requests: a connect middleware after Vite's own (modules, assets) bridges Node requests to the
//   web-standard handler and streams its responses.
// - Routes: the manifest is scanned from `src/routes` at startup and whenever a route file, the
//   middleware or the document is added, removed or changed; typegen rewrites
//   `.lumen/types/routes.d.ts` on the way. A structural change reloads the browser.
// - HMR: edits invalidate the module runner's cache (Vite's ssr full-reload), so the next request
//   re-imports the changed server modules. A module in the server graph reloads the page; when
//   every changed module is a stylesheet, linked styles are swapped in place instead.
// - Errors: unexpected render errors and compiler diagnostics (LUMxxxx, with Vite's code frame)
//   are logged and open Vite's error overlay on the page that hit them, on top of the dev
//   `_error`/fallback page; route manifest errors (LUM5002/5003) show on every page until fixed.

import { AsyncLocalStorage } from "node:async_hooks";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, EnvironmentModuleNode, Plugin, ViteDevServer } from "vite";
import { isCSSRequest, isRunnableDevEnvironment, loadEnv, normalizePath } from "vite";
import { escapeAttr } from "../../server/node.ts";
import type { AppDiagnostic } from "../diagnostics.ts";
import {
  DOCUMENT_FILES,
  findAppFile,
  islandModules,
  MIDDLEWARE_FILES,
  navigationOptions,
  projectOptions,
  type ProjectOptions,
} from "../project.ts";
import {
  DEFAULT_ROUTES_DIR,
  type CreateRouteManifestOptions,
  type RouteManifest,
  type RouteMode,
} from "../routes/manifest.ts";
import type { RequestHandler, TrailingSlash } from "../server/handler.ts";
import { sendWebResponse, toWebRequest } from "../server/node-http.ts";
import { typegen } from "../typegen/index.ts";
import { formatError, overlayError, overlayScript, type OverlayError } from "./errors.ts";
import { hasSpa, SPA_ENTRY_ID, spaEntryCode } from "../router/entry.ts";

export interface LumenDevOptions {
  /** Project-relative routes directory. Default `src/routes`. */
  routesDir?: string;
  /**
   * Project default route mode (decision-21). Default: `lumen({ mode })` of the Vite config, read
   * from the `lumen` plugin's `api.options`, else `static`.
   */
  mode?: RouteMode;
  /** Project default `ssr` of `spa` routes. Default: `lumen({ ssr })`, else `true`. */
  ssr?: boolean;
  /** Trailing slashes of page URLs. Default: `lumen({ trailingSlash })`, else `ignore`. */
  trailingSlash?: TrailingSlash;
}

/** The handler and server runtime, imported through the ssr module runner. */
type AppServerModule = typeof import("../server/index.ts");

const APP_SERVER_ENTRY = normalizePath(
  fileURLToPath(new URL("../server/index.ts", import.meta.url)),
);
/**
 * The island loader's client entry (`lumen/dom/loader`). Pages load it through a virtual module
 * that imports it, so Vite resolves it like any import: it is served from lumen's source (one
 * module instance with the islands' `lumen`), also when lumen lies outside `server.fs.allow`.
 */
const ISLAND_LOADER = normalizePath(fileURLToPath(new URL("../../dom/loader.ts", import.meta.url)));
const LOADER_ID = "\0lumen:loader";
/** The browser URL of a virtual module id (`\0lumen:spa` → `/@id/__x00__lumen:spa`). */
const virtualUrl = (base: string, id: string): string =>
  `${base}@id/${id.replace("\0", "__x00__")}`;
const NOT_A_STYLESHEET = /[?&](?:inline|url|raw)\b/;
const JS_MODULE = /\.[cm]?[jt]sx?$/;
/** An absolute module id (`/repo/kit/src/Nav.stsx`, `C:/repo/…`), not a bare specifier. */
const ABSOLUTE_ID = /^(?:\/|[a-z]:\/)/i;

/** What the handler is built from; replaced (never mutated) when the routes change. */
interface AppFiles {
  manifest: RouteManifest;
  middleware: string | undefined;
  document: string | undefined;
  /** Route manifest errors, shown in the overlay of every page until fixed. */
  errors: OverlayError[];
  key: string;
}

export function lumenDev(options: LumenDevOptions = {}): Plugin {
  const routesDir = options.routesDir ?? DEFAULT_ROUTES_DIR;
  const defaults: Pick<CreateRouteManifestOptions, "defaultMode" | "defaultSsr"> = {};
  let project: ProjectOptions = {};
  let server: ViteDevServer;
  let root: string;
  let app: AppFiles;
  let scanning: Promise<void> | undefined;
  let rescan = false;
  let cached: { runtime: AppServerModule; app: AppFiles; handler: RequestHandler } | undefined;
  // Errors reported while handling a request (including in-process fetches and streamed boundaries).
  const requestErrors = new AsyncLocalStorage<OverlayError[]>();

  async function scan(): Promise<AppFiles> {
    const { manifest } = await typegen(root, { routesDir, ...defaults });
    const middleware = findAppFile(root, MIDDLEWARE_FILES);
    const document = findAppFile(root, DOCUMENT_FILES);
    const errors = manifest.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => diagnosticError(diagnostic, root));
    const key = JSON.stringify([
      manifest.routes,
      manifest.layouts,
      manifest.notFoundPages,
      manifest.errorPages,
      manifest.diagnostics,
      middleware,
      document,
    ]);
    return { manifest, middleware, document, errors, key };
  }

  function reportDiagnostics(diagnostics: readonly AppDiagnostic[]): void {
    const logger = server.config.logger;
    for (const diagnostic of diagnostics) {
      const text = `${diagnostic.code}: ${diagnostic.message} (${diagnostic.file})${diagnostic.help === undefined ? "" : `\nhelp: ${diagnostic.help}`}`;
      if (diagnostic.severity === "error") logger.error(text, { timestamp: true });
      else logger.warn(text, { timestamp: true });
    }
  }

  /** Rescans the routes after a file event; reloads the browser if the manifest changed. */
  function refresh(): void {
    if (scanning !== undefined) {
      rescan = true;
      return;
    }
    scanning = (async () => {
      do {
        rescan = false;
        const next = await scan();
        if (next.key === app.key) continue;
        reportDiagnostics(next.manifest.diagnostics);
        app = next;
        // The SPA entry holds the route table (TASK-25).
        const graph = server.environments.client.moduleGraph;
        const spa = graph.getModuleById(SPA_ENTRY_ID);
        if (spa !== undefined) graph.invalidateModule(spa);
        server.environments.client.hot.send({ type: "full-reload", path: "*" });
      } while (rescan);
    })()
      .catch((error: unknown) => {
        server.config.logger.error(`Could not scan ${routesDir}: ${String(error)}`, {
          error: error as Error,
        });
      })
      .finally(() => {
        scanning = undefined;
      });
  }

  function onFileEvent(event: string, path: string): void {
    const file = relative(root, path).split(sep).join("/");
    if (file.startsWith(`${routesDir}/`)) {
      refresh();
    } else if (
      (MIDDLEWARE_FILES.includes(file) || DOCUMENT_FILES.includes(file)) &&
      (event === "add" || event === "unlink")
    ) {
      refresh();
    }
  }

  async function getHandler(): Promise<RequestHandler> {
    const ssr = server.environments.ssr;
    if (!isRunnableDevEnvironment(ssr)) {
      throw new Error("lumen dev renders through Vite's runnable `ssr` environment (the default).");
    }
    // Cached by the runner until an edit invalidates it; a new module instance gets a new handler.
    const runtime = await ssr.runner.import<AppServerModule>(APP_SERVER_ENTRY);
    if (cached?.runtime === runtime && cached.app === app) return cached.handler;
    const current = app;
    const base = server.config.base;
    const handler = runtime.createRequestHandler({
      manifest: current.manifest,
      loadModule: (file) => ssr.runner.import(`/${file}`),
      render: runtime.createServerRenderer({
        islandUrl: (specifier) => islandModuleUrl(base, specifier, server),
        loaderUrl: virtualUrl(base, LOADER_ID),
      }),
      ...(hasSpa(current.manifest) ? { spaEntry: virtualUrl(base, SPA_ENTRY_ID) } : {}),
      ...(current.middleware === undefined ? {} : { middleware: current.middleware }),
      ...(current.document === undefined ? {} : { document: current.document }),
      headAssets: (files) => headAssets(current, files),
      env: serverEnv(server),
      dev: true,
      base,
      ...(project.trailingSlash === undefined ? {} : { trailingSlash: project.trailingSlash }),
      ...(project.csrf === undefined ? {} : { csrf: project.csrf }),
      ...navigationOptions(project),
      // Static routes render fully resolved, as the build prerenders them.
      prerender: (route) => route.mode === "static",
      onError: (error) => {
        const prepared = overlayError(error, root);
        server.config.logger.error(formatError(prepared, root), { timestamp: true });
        requestErrors.getStore()?.push(prepared);
      },
    });
    cached = { runtime, app: current, handler };
    return handler;
  }

  /** `<head>` additions in dev: Vite's client (HMR, overlay) and the stylesheets the route imports. */
  function headAssets(current: AppFiles, files: readonly string[]): string {
    const base = server.config.base;
    let html = `<script type="module" src="${escapeAttr(`${base}@vite/client`)}"></script>`;
    const entries = current.document === undefined ? files : [current.document, ...files];
    for (const mod of stylesheets(entries)) {
      const href = base + mod.url.slice(1);
      html += `<link rel="stylesheet" href="${escapeAttr(href)}" data-vite-dev-id="${escapeAttr(mod.id ?? mod.url)}">`;
    }
    return html;
  }

  /**
   * Stylesheets imported (transitively) by the given route files, from the ssr module graph,
   * which holds them once the modules loaded. `.stsx` style blocks join here as CSS modules once
   * the CSS pipeline (TASK-45) imports them from compiled server code.
   */
  function stylesheets(files: readonly string[]): EnvironmentModuleNode[] {
    const graph = server.environments.ssr.moduleGraph;
    const seen = new Set<EnvironmentModuleNode>();
    const found: EnvironmentModuleNode[] = [];
    const visit = (mod: EnvironmentModuleNode): void => {
      if (seen.has(mod)) return;
      seen.add(mod);
      if (isStylesheet(mod.url)) {
        found.push(mod);
        return;
      }
      for (const dep of mod.importedModules) visit(dep);
    };
    for (const file of files) {
      for (const mod of graph.getModulesByFile(normalizePath(join(root, file))) ?? []) visit(mod);
    }
    return found;
  }

  /** Appends the overlay script to HTML responses whose request reported errors. */
  function withOverlay(response: Response, errors: OverlayError[]): Response {
    if (response.body === null || !overlayEnabled(server)) return response;
    if (!/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) return response;
    const base = server.config.base;
    const encoder = new TextEncoder();
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        flush(controller) {
          if (errors.length > 0) controller.enqueue(encoder.encode(overlayScript(errors, base)));
        },
      }),
    );
    return new Response(body, response);
  }

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    void (async () => {
      if (scanning !== undefined) await scanning;
      const handler = await getHandler();
      const request = toWebRequest(req, res);
      const errors = [...app.errors];
      const response = await requestErrors.run(errors, () => handler.fetch(request));
      await sendWebResponse(res, withOverlay(response, errors));
    })().catch(next);
  };

  return {
    name: "lumen:dev",
    apply: "serve",

    config(config) {
      // No index.html fallback: every non-asset request is a route.
      if (config.appType === undefined) return { appType: "custom" };
    },

    resolveId: {
      filter: { id: /^\0lumen:(?:loader|spa)$/ },
      handler: (id) => id,
    },

    load: {
      filter: { id: /^\0lumen:(?:loader|spa)$/ },
      handler: (id) =>
        id === SPA_ENTRY_ID
          ? spaEntryCode(app.manifest, server.config.base)
          : `import ${JSON.stringify(ISLAND_LOADER)};\n`,
    },

    configResolved(config) {
      project = { ...projectOptions(config, "dev") };
      if (options.trailingSlash !== undefined) project.trailingSlash = options.trailingSlash;
      const mode = options.mode ?? project.mode;
      const ssr = options.ssr ?? project.ssr;
      if (mode !== undefined) defaults.defaultMode = mode;
      if (ssr !== undefined) defaults.defaultSsr = ssr;
    },

    async configureServer(vite) {
      server = vite;
      root = normalizePath(vite.config.root);
      app = await scan();
      reportDiagnostics(app.manifest.diagnostics);
      vite.watcher.on("all", onFileEvent);
      // After Vite's middlewares, so modules and assets are served first.
      return () => {
        vite.middlewares.use(middleware);
      };
    },

    hotUpdate: {
      order: "post",
      handler({ file, modules, timestamp }) {
        if (this.environment !== server.environments.ssr || modules.length === 0) return;
        // Instead of Vite's ssr full reload (which clears the runner and eagerly re-imports every
        // entry, deleted route files included), invalidate the file and its importers: the next
        // request re-imports them; unrelated server modules (a database client) stay loaded.
        invalidateRunner(file);
        const client = server.environments.client.hot;
        if (modules.every((mod) => isStylesheet(mod.url))) {
          client.send({
            type: "update",
            updates: modules.map((mod) => ({
              type: "css-update" as const,
              path: mod.url,
              acceptedPath: mod.url,
              timestamp,
            })),
          });
        } else {
          client.send({ type: "full-reload", path: "*" });
        }
        return [];
      },
    },
  };

  function invalidateRunner(file: string): void {
    const ssr = server.environments.ssr;
    if (!isRunnableDevEnvironment(ssr)) return;
    const graph = ssr.runner.evaluatedModules;
    const queue = [...(graph.getModulesByFile(file) ?? [])];
    const seen = new Set(queue);
    for (const node of queue) {
      graph.invalidateModule(node);
      for (const id of node.importers) {
        const importer = graph.getModuleById(id);
        if (importer !== undefined && !seen.has(importer)) {
          seen.add(importer);
          queue.push(importer);
        }
      }
    }
  }
}

/**
 * The dev URL of an island's module, by the module part of its ref: root-relative refs are paths;
 * the modules of linked packages (`@acme/ui/src/Nav.stsx`, TASK-74) load through Vite's `/@fs/`
 * route from the absolute id the island manifest imports, and bare refs (`@acme/ui`) through
 * `/@id/` (TASK-98).
 */
function islandModuleUrl(base: string, module: string, server: ViteDevServer): string {
  if (module.startsWith("/")) return devModuleUrl(base, module);
  const specifier = islandModules(server.config).get(module);
  if (specifier === undefined) return module;
  if (!ABSOLUTE_ID.test(specifier)) return `${base}@id/${specifier}`;
  const url = `${base}@fs/${specifier.replace(/^\//, "")}`;
  return JS_MODULE.test(specifier) ? url : `${url}?import`;
}

/**
 * The browser URL of a module in dev, as Vite's import analysis writes it (non-JS extensions such
 * as `.stsx` get `?import`), so islands load the same module instance as static imports.
 */
function devModuleUrl(base: string, specifier: string): string {
  if (!specifier.startsWith("/")) return specifier;
  const url = base + specifier.slice(1);
  return JS_MODULE.test(specifier) ? url : `${url}?import`;
}

function isStylesheet(url: string): boolean {
  return isCSSRequest(url) && !NOT_A_STYLESHEET.test(url);
}

function overlayEnabled(server: ViteDevServer): boolean {
  const hmr = server.config.server.hmr;
  return hmr !== false && !(typeof hmr === "object" && hmr.overlay === false);
}

/** `ctx.env`/`env()` in dev: `.env` files of the mode, overridden by the process environment. */
function serverEnv(server: ViteDevServer): Record<string, string> {
  return loadEnv(server.config.mode, server.config.envDir, "");
}

function diagnosticError(diagnostic: AppDiagnostic, root: string): OverlayError {
  const help = diagnostic.help === undefined ? "" : `\nhelp: ${diagnostic.help}`;
  const file = join(root, diagnostic.file);
  return {
    message: `${diagnostic.code}: ${diagnostic.message}${help}`,
    stack: "",
    plugin: "lumen:routes",
    id: file,
    loc: { file, line: 1, column: 1 },
  };
}
