// The runtime side of the build's server entry (`dist/server/entry.js`, spec §8 Build): the
// generated entry holds the app's data (route manifest, module loaders, island URLs, options) and
// creates its request handler here, so the handler, the server runtime and the compiled routes
// are bundled together and share one module instance.

import type { RouteManifest } from "../routes/manifest.ts";
import type { HeadersOption } from "../headers.ts";
import type { CsrfOptions } from "./csrf.ts";
import { stylesheetTags, type StyleTags } from "./stylesheets.ts";
import {
  createRequestHandler,
  type ModuleExports,
  type RequestHandler,
  type RequestHandlerOptions,
  type TrailingSlash,
} from "./handler.ts";
import type { Prefetch } from "./navigation.ts";
import { createServerRenderer } from "./render.ts";
import { escapeAttr } from "../../server/node.ts";

/** Options of the built app, for adapters serving `dist/client` next to the handler. */
export interface BuiltAppConfig {
  /** Vite's `base`, with leading and trailing slashes. */
  base: string;
  trailingSlash: TrailingSlash;
  /** Vite's `build.assetsDir` in `dist/client` (content-hashed files: cache them forever). */
  assetsDir: string;
  /** `lumen({ headers })`: adapters send them (`headersFor()` from lumen/node), app headers win. */
  headers?: HeadersOption;
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
  /** URL of the island loader chunk (with `base`); absent when the app has no islands. */
  loader?: string;
  /** URL of the SPA entry chunk (with `base`); absent when the app has no `spa` pages. */
  spa?: string;
  /**
   * SPA layout or page (project-relative) → its chunk URL and those of its static imports (with
   * `base`), modulepreloaded by the pages that render an SPA.
   */
  spaPreloads?: Readonly<Record<string, readonly string[]>>;
  /**
   * The stylesheet URLs (with `base`) of project-relative modules, deduplicated in cascade order
   * (`stylesheets` of `virtual:lumen/css-manifest`).
   */
  stylesheets?: (files: readonly string[]) => readonly string[];
  /** How `lumen build` grouped the stylesheets: a shared file, then each page's own (TASK-121). */
  styleTags?: StyleTags;
  /** `lumen({ viewTransitions })`; absent when off. */
  viewTransitions?: boolean;
  /** `lumen({ prefetch })`; absent for `"none"`. */
  prefetch?: Prefetch;
  /** `lumen({ csp })`; absent when off. */
  csp?: "strict";
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
    render: createServerRenderer({
      islandUrl: (specifier) => app.islands[specifier] ?? specifier,
      ...(app.loader === undefined ? {} : { loaderUrl: app.loader }),
    }),
    ...(app.middleware === undefined ? {} : { middleware: app.middleware }),
    ...(app.document === undefined ? {} : { document: app.document }),
    ...(app.csrf === undefined ? {} : { csrf: app.csrf }),
    ...(app.spa === undefined ? {} : { spaEntry: app.spa }),
    ...(app.viewTransitions === undefined ? {} : { viewTransitions: app.viewTransitions }),
    ...(app.prefetch === undefined ? {} : { prefetch: app.prefetch }),
    ...(app.csp === undefined ? {} : { csp: app.csp }),
    ...(app.headers === undefined ? {} : { headers: app.headers }),
    headAssets: (files, spa) => stylesheetLinks(app, files) + spaModulePreloads(app, files, spa),
    base: app.base,
    trailingSlash: app.trailingSlash,
    // Static routes that reach the server (a form post, params staticPaths() did not list) render
    // fully resolved, like their prerendered HTML.
    prerender: (route) => route.mode === "static",
  });
}

/**
 * `<link rel="modulepreload">` for the chunks of an SPA page's layouts and page: without them the
 * browser only finds them once the SPA entry has run and matched the URL (TASK-123).
 */
function spaModulePreloads(app: BuiltApp, files: readonly string[], spa: boolean): string {
  if (!spa || app.spaPreloads === undefined) return "";
  const urls = new Set<string>();
  for (const file of files) for (const url of app.spaPreloads[file] ?? []) urls.add(url);
  let html = "";
  for (const href of urls) html += `<link rel="modulepreload" href="${escapeAttr(href)}">`;
  return html;
}

/** The stylesheets of the document, the layouts and the route, in cascade order. */
function stylesheetLinks(app: BuiltApp, files: readonly string[]): string {
  if (app.stylesheets === undefined) return "";
  const modules = app.document === undefined ? files : [app.document, ...files];
  return stylesheetTags(app.stylesheets(modules), app.styleTags);
}
