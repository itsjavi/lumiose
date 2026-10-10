// Prerendering (spec §7.1, §8 Build step 3): renders every `static` page and `GET`s every
// `static` endpoint through the built server entry, in-process, and writes the results to
// `dist/client`: `path/index.html` (`path.html` with `trailingSlash: "never"`), endpoint files
// at their path (`sitemap.xml`), and `404.html` from the root `_404` when the root scope is static
// or `spa`. `spa` pages with `ssr = false` (and no params) get their shell, which the client renders.
// Routes with params are rendered for each entry of their `staticPaths()`. Request APIs used by
// a route while it prerenders are LUM5001 (the handler's `prerendering` guard); a static endpoint
// exporting other methods than GET is LUM5005. Every problem is collected; the build fails once.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LUM_STATIC_ENDPOINT_METHOD } from "../diagnostics.ts";
import { fillPattern } from "../routes/href.ts";
import type { RouteEntry, RouteMode } from "../routes/manifest.ts";
import { createRouteMatcher } from "../routes/match.ts";
import type { AppHandlerOptions, BuiltApp, BuiltAppConfig } from "../server/app.ts";
import type { ServerEnv } from "../server/context.ts";
import type { RequestHandler, TrailingSlash } from "../server/handler.ts";
import { escapeAttr } from "../../server/node.ts";

/** What `dist/server/entry.js` exports. */
export interface ServerEntryModule {
  default: RequestHandler;
  config: BuiltAppConfig;
  app: BuiltApp;
  createHandler(options?: AppHandlerOptions): RequestHandler;
}

export interface PrerenderOptions {
  entry: ServerEntryModule;
  /** Absolute `dist/client`. */
  clientDir: string;
  /** Project default route mode: whether the root `_404` is prerendered when there is no root layout. */
  defaultMode: RouteMode;
  /** `ctx.env`/`env()` while prerendering. */
  env: ServerEnv;
  /** Origin of the prerender requests (`ctx.url`). Default `http://localhost`. */
  origin?: string;
}

export interface PrerenderedFile {
  /** URL path below `base`, e.g. `/blog/hello/`. */
  path: string;
  /** Path relative to `dist/client`, e.g. `blog/hello/index.html`. */
  file: string;
  kind: "page" | "endpoint" | "redirect" | "404";
}

/** Prerendering problems: LUM5001/LUM5005, missing `staticPaths()`, non-200 responses, render errors. */
export class PrerenderError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Prerendering failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "PrerenderError";
    this.problems = problems;
  }
}

const NON_GET_METHODS = ["HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
/** Requested to render the root `_404`; must not match a route. */
const NOT_FOUND_PROBE = "/__lumiose/404";

interface Target {
  route: RouteEntry | undefined;
  path: string;
  kind: "page" | "endpoint" | "404";
}

export async function prerender(options: PrerenderOptions): Promise<PrerenderedFile[]> {
  const { entry, clientDir } = options;
  const { app, config } = entry;
  const origin = options.origin ?? "http://localhost";
  const problems: string[] = [];
  let reported: unknown[] = [];
  const handler = entry.createHandler({
    prerendering: true,
    env: options.env,
    onError: (error) => {
      reported.push(error);
    },
  });

  const targets: Target[] = [];
  for (const route of app.manifest.routes) {
    // `spa` pages with `ssr = false` get their shell; other modes render per request.
    const shell = route.kind === "page" && route.mode === "spa" && !route.ssr;
    if (route.mode !== "static" && !(shell && route.params.length === 0)) continue;
    const kind = route.kind;
    if (shell) {
      targets.push({ route, path: route.pattern, kind });
      continue;
    }
    let module: Record<string, unknown>;
    try {
      module = await app.loadModule(route.file);
    } catch (error) {
      problems.push(`${route.file}: ${describe(error)}`);
      continue;
    }
    if (kind === "endpoint") {
      const methods = NON_GET_METHODS.filter((method) => typeof module[method] === "function");
      if (methods.length > 0) {
        problems.push(
          `${route.file}: ${LUM_STATIC_ENDPOINT_METHOD}: this endpoint is static (prerendered to a file), so it can only serve GET, but it exports ${methods.join(", ")}. Set export const mode = "server", or keep only GET.`,
        );
        continue;
      }
    }
    for (const path of await routePaths(route, module, problems)) {
      targets.push({ route, path, kind });
    }
  }
  // Static hosts serve 404.html for unknown URLs: in an `spa` root it is the SPA (an empty shell
  // with `ssr = false`), which renders the URL's route if the SPA has one.
  if (rootMode(app, options.defaultMode) !== "server") {
    if (createRouteMatcher(app.manifest).match(NOT_FOUND_PROBE) === null) {
      targets.push({ route: undefined, path: NOT_FOUND_PROBE, kind: "404" });
    }
  }

  const written = new Map<string, PrerenderedFile>();
  for (const target of targets) {
    const { route, kind } = target;
    const where = route === undefined ? "404.html" : `${route.file} (${target.path})`;
    let file: string;
    try {
      file = kind === "404" ? "404.html" : outputFile(target.path, kind, config.trailingSlash);
    } catch (error) {
      problems.push(`${where}: ${describe(error)}`);
      continue;
    }
    const existing = written.get(file);
    if (existing !== undefined) {
      problems.push(`${where}: writes ${file}, which ${existing.path} already wrote.`);
      continue;
    }

    reported = [];
    const url = new URL(requestPath(config, target.path, kind), origin);
    let response: Response;
    let body: Uint8Array | undefined;
    try {
      response = await handler.fetch(new Request(url));
      body = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      problems.push(`${where}: ${describe(error)}`);
      continue;
    }
    if (reported.length > 0) {
      const messages = [...new Set(reported.map(describe))];
      problems.push(`${where}: ${messages.join("\n    ")}`);
      continue;
    }

    let result: PrerenderedFile;
    const location = response.headers.get("location");
    if (kind === "404") {
      if (response.status !== 404) {
        problems.push(`${where}: rendering the _404 page responded ${response.status}.`);
        continue;
      }
      result = { path: "/404", file, kind };
    } else if (kind === "page" && isRedirect(response.status) && location !== null) {
      body = new TextEncoder().encode(redirectPage(new URL(location, url).href, url.origin));
      result = { path: target.path, file, kind: "redirect" };
    } else if (response.status !== 200) {
      problems.push(
        `${where}: responded ${response.status}${location === null ? "" : ` (to ${location})`}; prerendered routes must respond 200${kind === "page" ? " or redirect" : ""}.`,
      );
      continue;
    } else {
      result = { path: target.path, file, kind };
    }
    const absolute = join(clientDir, file);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body);
    written.set(file, result);
  }

  if (problems.length > 0) throw new PrerenderError(problems);
  return [...written.values()];
}

/** URL paths of a static route: its pattern, or one per `staticPaths()` entry when it has params. */
async function routePaths(
  route: RouteEntry,
  module: Record<string, unknown>,
  problems: string[],
): Promise<string[]> {
  if (route.params.length === 0) return [route.pattern];
  const staticPaths = module.staticPaths;
  if (typeof staticPaths !== "function") {
    problems.push(
      `${route.file}: "${route.pattern}" is static and has params, so it needs \`export async function staticPaths()\` returning [{ params }] for the build to prerender it. Or render it per request: export const mode = "server".`,
    );
    return [];
  }
  let entries: unknown;
  try {
    entries = await staticPaths();
  } catch (error) {
    problems.push(`${route.file}: staticPaths() failed: ${describe(error)}`);
    return [];
  }
  if (!Array.isArray(entries)) {
    problems.push(`${route.file}: staticPaths() must return an array of { params }.`);
    return [];
  }
  const paths = new Set<string>();
  for (const item of entries) {
    const params = (item as { params?: unknown } | null)?.params;
    if (typeof params !== "object" || params === null) {
      problems.push(
        `${route.file}: staticPaths() returned ${JSON.stringify(item)}; expected { params }.`,
      );
      continue;
    }
    try {
      paths.add(fillPattern(route.pattern, params as Record<string, unknown>));
    } catch (error) {
      problems.push(`${route.file}: staticPaths(): ${describe(error)}`);
    }
  }
  return [...paths];
}

/** Mode of the root scope, which the root `_404` renders in. */
function rootMode(app: BuiltApp, defaultMode: RouteMode): RouteMode {
  return app.manifest.layouts.find((layout) => layout.dir === "")?.mode ?? defaultMode;
}

/** The request path of a target: below `base`, with the page trailing-slash form. */
function requestPath(config: BuiltAppConfig, path: string, kind: Target["kind"]): string {
  const slash = kind === "page" && config.trailingSlash === "always" && path !== "/";
  return config.base + path.slice(1) + (slash ? "/" : "");
}

/** The file a URL path is written to, relative to `dist/client`. */
export function outputFile(
  path: string,
  kind: "page" | "endpoint",
  trailingSlash: TrailingSlash,
): string {
  const segments = path
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || /[/\\\0]/.test(decoded)) {
        throw new Error(`"${path}" cannot be written to a file: "${decoded}" is not a file name.`);
      }
      return decoded;
    });
  if (kind === "endpoint") {
    if (segments.length === 0) throw new Error(`an endpoint at "${path}" has no file name.`);
    return segments.join("/");
  }
  if (segments.length === 0) return "index.html";
  return trailingSlash === "never"
    ? `${segments.join("/")}.html`
    : [...segments, "index.html"].join("/");
}

function isRedirect(status: number): boolean {
  return status >= 300 && status <= 399;
}

/** A static stand-in for a redirect: meta refresh plus a link. */
function redirectPage(location: string, origin: string): string {
  const target = location.startsWith(`${origin}/`) ? location.slice(origin.length) : location;
  const link = escapeAttr(target);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Redirecting…</title><meta http-equiv="refresh" content="0;url=${link}"><meta name="robots" content="noindex"><link rel="canonical" href="${link}"></head><body><a href="${link}">${link}</a></body></html>`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
