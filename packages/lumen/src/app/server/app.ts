// The runtime side of the build's server entry (`dist/server/entry.js`, spec §8 Build): the
// generated entry holds the app's data (route manifest, module loaders, island URLs, options) and
// creates its request handler here, so the handler, the server runtime and the compiled routes
// are bundled together and share one module instance.

import type { RouteManifest } from "../routes/manifest.ts";
import type { CsrfOptions } from "./csrf.ts";
import {
  createRequestHandler,
  type ModuleExports,
  type RequestHandler,
  type RequestHandlerOptions,
  type TrailingSlash,
} from "./handler.ts";
import { createServerRenderer } from "./render.ts";
import { escapeAttr } from "../../server/node.ts";

/** Options of the built app, for adapters serving `dist/client` next to the handler. */
export interface BuiltAppConfig {
  /** Vite's `base`, with leading and trailing slashes. */
  base: string;
  trailingSlash: TrailingSlash;
  /** Vite's `build.assetsDir` in `dist/client` (content-hashed files: cache them forever). */
  assetsDir: string;
}

export interface BuiltApp extends BuiltAppConfig {
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;
  /** Imports a route module, the middleware or the document by its project-relative path. */
  loadModule: (file: string) => Promise<ModuleExports>;
  middleware?: string;
  document?: string;
  csrf?: false | CsrfOptions;
  /** Island module specifier (`/src/components/Team.stsx`) → its client chunk URL. */
  islands: Readonly<Record<string, string>>;
  /**
   * The stylesheet URLs (with `base`) of project-relative modules, deduplicated in cascade order
   * (`stylesheets` of `virtual:lumen/css-manifest`).
   */
  stylesheets?: (files: readonly string[]) => readonly string[];
}

export type AppHandlerOptions = Pick<
  RequestHandlerOptions,
  "env" | "onError" | "prerendering" | "dev"
>;

/** The production request handler of a built app (`export default { fetch }`). */
export function createAppHandler(app: BuiltApp, options: AppHandlerOptions = {}): RequestHandler {
  return createRequestHandler({
    ...options,
    manifest: app.manifest,
    loadModule: app.loadModule,
    render: createServerRenderer({ islandUrl: (specifier) => app.islands[specifier] ?? specifier }),
    ...(app.middleware === undefined ? {} : { middleware: app.middleware }),
    ...(app.document === undefined ? {} : { document: app.document }),
    ...(app.csrf === undefined ? {} : { csrf: app.csrf }),
    headAssets: (files) => stylesheetLinks(app, files),
    base: app.base,
    trailingSlash: app.trailingSlash,
    // Static routes that reach the server (a form post, params staticPaths() did not list) render
    // fully resolved, like their prerendered HTML.
    prerender: (route) => route.mode === "static",
  });
}

/** `<link rel="stylesheet">` for the document, the layouts and the route, in cascade order. */
function stylesheetLinks(app: BuiltApp, files: readonly string[]): string {
  if (app.stylesheets === undefined) return "";
  const modules = app.document === undefined ? files : [app.document, ...files];
  let html = "";
  for (const href of app.stylesheets(modules)) {
    html += `<link rel="stylesheet" href="${escapeAttr(href)}">`;
  }
  return html;
}
