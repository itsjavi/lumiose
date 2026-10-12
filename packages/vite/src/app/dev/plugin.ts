// The app side of `lumiose dev` (spec §8 "Dev and config", decision-5): a Vite 8 plugin that serves
// file routes from source through the request handler.
//
// - Environments: route modules, middleware and the document load in Vite's `ssr` environment
//   (its module runner), together with the request handler and the server runtime, so compiled
//   code, `lumiose` and the handler share one module instance (request scope, render frames).
//   Islands and SPA code are client-environment modules served by Vite as usual.
// - Requests: a connect middleware after Vite's own (modules, assets) bridges Node requests to the
//   web-standard handler and streams its responses.
// - Routes: the manifest is scanned from `src/routes` at startup and whenever a route file, the
//   middleware or the document is added, removed or changed; typegen rewrites
//   `.lumiose/types/routes.d.ts` on the way. A structural change reloads the browser.
// - HMR: edits invalidate the module runner's cache (Vite's ssr full-reload), so the next request
//   re-imports the changed server modules. When every changed module is a stylesheet, linked styles
//   are swapped in place. Server-only code (not imported by an island or an SPA page) patches the
//   page in place (TASK-148): the dev client (./client.ts) fetches its URL again and morphs the
//   DOM, keeping islands (./morph.ts), as described by the dev annotation every HTML page ends
//   with (./annotation.ts). Client code reloads the page, unless Vite or the island hot swap
//   updates it. Once per burst of file events: a save reported as two changes updates once.
// - Errors: unexpected render errors and compiler diagnostics (LUMxxxx, with Vite's code frame)
//   are logged and open Vite's error overlay on the page that hit them, on top of the dev
//   `error`/fallback page; route manifest errors (LUM5002/5003) show on every page until fixed.

import { runtimeFile } from "../../runtime-files.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, EnvironmentModuleNode, Plugin, ViteDevServer } from "vite";
import { isCSSRequest, isRunnableDevEnvironment, loadEnv, normalizePath } from "vite";
import { escapeAttr } from "lumiose/internal/server/node.ts";
import type { AppDiagnostic } from "lumiose/internal/app/diagnostics.ts";
import {
  configProjectOptions,
  DOCUMENT_FILES,
  findAppFile,
  hrefDefine,
  isClientState,
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
} from "lumiose/internal/app/routes/manifest.ts";
import type { RequestHandler, TrailingSlash } from "lumiose/internal/app/server/handler.ts";
import {
  RejectedRequest,
  sendWebResponse,
  toWebRequest,
} from "lumiose/internal/app/server/node-http.ts";
import { typegen } from "../typegen/index.ts";
import { formatError, overlayError, overlayScript, type OverlayError } from "./errors.ts";
import { devAnnotation } from "./annotation.ts";
import { hasSpa, SPA_ENTRY_ID, spaEntryCode } from "../router/entry.ts";
import { ISLANDS_ID } from "../../islands.ts";
import { spaRouteFiles } from "../../server-routes.ts";
import { headersFor, pathBelowBase } from "lumiose/internal/app/headers.ts";

/** How long a burst of file events may last and still reload the browser once. */
const RELOAD_DEBOUNCE_MS = 30;
/** The custom HMR event of server-only edits, which ./client.ts answers. */
const SERVER_UPDATE = "lumiose:server-update";

export interface LumioseDevOptions {
  /** Project-relative routes directory. Default `src/routes`. */
  routesDir?: string;
  /**
   * Project default route mode (decision-21). Default: `lumiose({ mode })` of the Vite config, read
   * from the `lumiose` plugin's `api.options`, else `static`.
   */
  mode?: RouteMode;
  /** Project default `ssr` of `spa` routes. Default: `lumiose({ ssr })`, else `true`. */
  ssr?: boolean;
  /** Trailing slashes of page URLs. Default: `lumiose({ trailingSlash })`, else `ignore`. */
  trailingSlash?: TrailingSlash;
}

/** The handler and server runtime, imported through the ssr module runner. */
type AppServerModule = typeof import("lumiose/internal/app/server/index.ts");

const APP_SERVER_ENTRY = runtimeFile("app/server/index.ts");
/**
 * The island loader's client entry (`lumiose/dom/loader`). Pages load it through a virtual module
 * that imports it, so Vite resolves it like any import: it is served from lumiose's source (one
 * module instance with the islands' `lumiose`), also when lumiose lies outside `server.fs.allow`.
 */
const ISLAND_LOADER = runtimeFile("dom/loader.ts");
const LOADER_ID = "\0lumiose:loader";
/** The dev client (./client.ts, `.js` once built), loaded on every page through `\0lumiose:dev`. */
const DEV_CLIENT = normalizePath(
  fileURLToPath(
    new URL(import.meta.url.endsWith(".ts") ? "client.ts" : "client.js", import.meta.url),
  ),
);
const DEV_CLIENT_ID = "\0lumiose:dev";
/** The browser URL of a virtual module id (`\0lumiose:spa` → `/@id/__x00__lumiose:spa`). */
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

export function lumioseDev(options: LumioseDevOptions = {}): Plugin {
  const routesDir = options.routesDir ?? DEFAULT_ROUTES_DIR;
  const defaults: Pick<
    CreateRouteManifestOptions,
    "defaultMode" | "defaultSsr" | "defaultPrerender" | "i18n"
  > = {};
  let project: ProjectOptions = {};
  let server: ViteDevServer;
  let root: string;
  let app: AppFiles;
  let scanning: Promise<void> | undefined;
  let rescan = false;
  let cached: { runtime: AppServerModule; app: AppFiles; handler: RequestHandler } | undefined;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: "reload" | "update" | undefined;

  /**
   * Reloads the browser, or has it patch the page (`update`), once for a burst of file events: one
   * save can reach the watcher as several `change` events (a truncate, then the write; editors that
   * write twice), and each would otherwise send its own (TASK-139). A reload wins.
   */
  function schedule(kind: "reload" | "update"): void {
    if (pending !== "reload") pending = kind;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const hot = server.environments.client.hot;
      if (pending === "reload") hot.send({ type: "full-reload", path: "*" });
      else hot.send({ type: "custom", event: SERVER_UPDATE });
      reloadTimer = pending = undefined;
    }, RELOAD_DEBOUNCE_MS);
  }
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
      throw new Error(
        "lumiose dev renders through Vite's runnable `ssr` environment (the default).",
      );
    }
    // Cached by the runner until an edit invalidates it; a new module instance gets a new handler.
    const runtime = await ssr.runner.import<AppServerModule>(APP_SERVER_ENTRY);
    if (cached?.runtime === runtime && cached.app === app) return cached.handler;
    const current = app;
    const base = server.config.base;
    const spaRoutes = spaRouteFiles(root, current.manifest);
    const handler = runtime.createRequestHandler({
      manifest: current.manifest,
      loadModule: (file) => ssr.runner.import(`/${file}`),
      render: runtime.createServerRenderer({
        islandUrl: (specifier) => islandModuleUrl(base, specifier, server),
        loaderUrl: virtualUrl(base, LOADER_ID),
        // Scoped state the page sends: only what islands and SPA routes reach (decision-33).
        isClientState: (ref) => isClientState(server.config, ref, spaRoutes),
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
      ...(project.limits === undefined ? {} : { limits: project.limits }),
      ...(project.csp === undefined ? {} : { csp: project.csp }),
      ...(project.headers === undefined ? {} : { headers: project.headers }),
      ...navigationOptions(project),
      // Prerendered routes render fully resolved, as the build prerenders them.
      prerender: (route) => route.mode === "static" || route.prerender,
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
    let html =
      `<script type="module" src="${escapeAttr(`${base}@vite/client`)}"></script>` +
      `<script type="module" src="${escapeAttr(virtualUrl(base, DEV_CLIENT_ID))}"></script>`;
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

  /**
   * Appends to HTML responses the dev annotation (./annotation.ts) and, when the request reported
   * errors, the overlay script.
   */
  function withDevScripts(response: Response, method: string, errors: OverlayError[]): Response {
    if (response.body === null) return response;
    if (!/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) return response;
    const base = server.config.base;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let html = "";
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          html += decoder.decode(chunk, { stream: true });
          controller.enqueue(chunk);
        },
        flush(controller) {
          html += decoder.decode();
          const page = { method, status: response.status, errors: errors.length > 0 };
          let tail = devAnnotation(html, page);
          if (errors.length > 0 && overlayEnabled(server)) tail += overlayScript(errors, base);
          controller.enqueue(encoder.encode(tail));
        },
      }),
    );
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    void (async () => {
      if (scanning !== undefined) await scanning;
      const handler = await getHandler();
      let request: Request;
      try {
        request = toWebRequest(req, res);
      } catch (error) {
        if (!(error instanceof RejectedRequest)) throw error;
        // `//host/…` and other non-path targets (TASK-164), forbidden methods, bodies over the
        // limit: the client's fault, answered with the error's status.
        res
          .writeHead(error.status, { "content-type": "text/plain; charset=utf-8" })
          .end(error.message);
        return;
      }
      const errors = [...app.errors];
      const response = await requestErrors.run(errors, () =>
        handler.fetch(request, { clientAddress: req.socket.remoteAddress }),
      );
      await sendWebResponse(res, withDevScripts(response, request.method, errors));
    })().catch(next);
  };

  return {
    name: "lumiose:dev",
    apply: "serve",

    config(config) {
      const trailingSlash =
        options.trailingSlash ?? configProjectOptions(config.plugins).trailingSlash ?? "ignore";
      return {
        // No index.html fallback: every non-asset request is a route.
        ...(config.appType === undefined ? { appType: "custom" as const } : {}),
        define: hrefDefine(trailingSlash),
      };
    },

    resolveId: {
      filter: { id: /^\0lumiose:(?:loader|spa|dev)$/ },
      handler: (id) => id,
    },

    load: {
      filter: { id: /^\0lumiose:(?:loader|spa|dev)$/ },
      handler: (id) =>
        id === SPA_ENTRY_ID
          ? spaEntryCode(app.manifest, server.config.base, {
              viewTransitions: project.viewTransitions,
            })
          : `import ${JSON.stringify(id === DEV_CLIENT_ID ? DEV_CLIENT : ISLAND_LOADER)};\n`,
    },

    configResolved(config) {
      project = { ...projectOptions(config, "dev") };
      if (options.trailingSlash !== undefined) project.trailingSlash = options.trailingSlash;
      const mode = options.mode ?? project.mode;
      const ssr = options.ssr ?? project.ssr;
      if (mode !== undefined) defaults.defaultMode = mode;
      if (ssr !== undefined) defaults.defaultSsr = ssr;
      if (project.prerender !== undefined) defaults.defaultPrerender = project.prerender;
      if (project.i18n !== undefined) defaults.i18n = project.i18n;
    },

    async configureServer(vite) {
      server = vite;
      root = normalizePath(vite.config.root);
      app = await scan();
      reportDiagnostics(app.manifest.diagnostics);
      vite.watcher.on("all", onFileEvent);
      // Before Vite's middlewares, so modules and assets get them too; later setHeader calls win.
      // Lumiose's default headers (decision-29) and lumiose({ headers }).
      const headers = project.headers;
      vite.middlewares.use((req, res, next) => {
        const path = pathBelowBase(req.url ?? "/", vite.config.base);
        if (path !== undefined) {
          for (const [name, value] of Object.entries(headersFor(headers, path))) {
            res.setHeader(name, value);
          }
        }
        next();
      });
      // After Vite's middlewares, so modules and assets are served first.
      return () => {
        vite.middlewares.use(middleware);
      };
    },

    // Dev: an island module accepts its own updates and re-renders its instances (TASK-147); the
    // loader (lumiose/dom islands.ts) answers whether it did, else the update falls back to a reload.
    // Before Vite's import analysis, which marks the module self-accepting.
    transform: {
      handler(code, id) {
        if (this.environment !== server?.environments.client) return;
        const module = islandModuleOf(id.split("?", 1)[0]!);
        // Modules the compiler registered for component-level updates (lumiose/dom/hot, TASK-146)
        // re-render their instances themselves, hydrated islands included.
        if (module === undefined || code.includes("$hotAccept")) return;
        return {
          code: `${code}
if (import.meta.hot) import.meta.hot.accept((next) => {
  const hot = globalThis[Symbol.for("lumiose.hot")];
  if (!next || !hot || !hot.reduce((done, swap) => swap(${JSON.stringify(module)}, next) || done, false)) import.meta.hot.invalidate();
});
`,
          map: null,
        };
      },
    },

    hotUpdate: {
      order: "post",
      handler({ file, modules, timestamp }) {
        if (this.environment !== server.environments.ssr || modules.length === 0) return;
        // Instead of Vite's ssr full reload (which clears the runner and eagerly re-imports every
        // entry, deleted route files included), invalidate the file and its importers: the next
        // request re-imports them; unrelated server modules (a database client) stay loaded.
        invalidateRunner(file);
        if (hotSwappable(file)) {
          // An island's own module: its instances re-render in the browser (the accept handler
          // appended by `transform`), so the page and the other islands keep their state.
          return [];
        }
        const styles = modules.filter((mod) => isStylesheet(mod.url));
        if (styles.length < modules.length && isClientCode(file)) {
          schedule("reload");
          return [];
        }
        if (styles.length > 0) {
          server.environments.client.hot.send({
            type: "update",
            updates: styles.map((mod) => ({
              type: "css-update" as const,
              path: mod.url,
              acceptedPath: mod.url,
              timestamp,
            })),
          });
        }
        // Server-only code (a `.stsx` file's markup and its style block alike): the page patches
        // itself with its fresh HTML.
        if (styles.length < modules.length) schedule("update");
        return [];
      },
    },
  };

  /** The ref module (`/src/Counter.stsx`) of the island module at `id`, if it is one. */
  function islandModuleOf(id: string): string | undefined {
    for (const [module, specifier] of islandModules(server.config)) {
      if (
        specifier === id ||
        (specifier.startsWith("/") && normalizePath(join(root, specifier)) === id)
      ) {
        return module;
      }
    }
    return undefined;
  }

  /**
   * Whether an edit of `file` can update in the browser without a reload: it is an island module
   * the page has loaded, imported only by the island manifest (another importer would keep using
   * the old exports).
   */
  function hotSwappable(file: string): boolean {
    if (islandModuleOf(file) === undefined) return false;
    const mods = server.environments.client.moduleGraph.getModulesByFile(file);
    if (mods === undefined || mods.size === 0) return false;
    for (const mod of mods) {
      if (mod.importers.size === 0) return false;
      for (const importer of mod.importers) {
        if (importer.id !== ISLANDS_ID) return false;
      }
    }
    return true;
  }

  /**
   * Whether `file` is client code: a module the browser loaded (stylesheets aside), or one that an
   * island module or an SPA page or layout imports, from the server's module graph (islands that
   * did not hydrate yet).
   */
  function isClientCode(file: string): boolean {
    for (const mod of server.environments.client.moduleGraph.getModulesByFile(file) ?? []) {
      if (!isStylesheet(mod.url)) return true;
    }
    const spa = spaRouteFiles(root, app.manifest);
    const queue = [...(server.environments.ssr.moduleGraph.getModulesByFile(file) ?? [])];
    const seen = new Set(queue);
    for (const mod of queue) {
      if (mod.file !== null && (spa.has(mod.file) || islandModuleOf(mod.file) !== undefined)) {
        return true;
      }
      for (const importer of mod.importers) {
        if (!seen.has(importer)) {
          seen.add(importer);
          queue.push(importer);
        }
      }
    }
    return false;
  }

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
  return JS_MODULE.test(specifier) ? url : withImportQuery(url);
}

/**
 * The browser URL of a module in dev, as Vite's import analysis writes it (non-JS extensions such
 * as `.stsx` get `?import`), so islands load the same module instance as static imports.
 */
function devModuleUrl(base: string, specifier: string): string {
  if (!specifier.startsWith("/")) return specifier;
  const url = base + specifier.slice(1);
  return JS_MODULE.test(specifier) ? url : withImportQuery(url);
}

/** `url` with Vite's `import` param first, as its import analysis writes it (`x.html?import&q`). */
function withImportQuery(url: string): string {
  const query = url.indexOf("?");
  return query === -1 ? `${url}?import` : `${url.slice(0, query)}?import&${url.slice(query + 1)}`;
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
    plugin: "lumiose:routes",
    id: file,
    loc: { file, line: 1, column: 1 },
  };
}
