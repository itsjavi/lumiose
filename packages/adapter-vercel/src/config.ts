// `.vercel/output/config.json` (Build Output API v3) for a Lumiose build: the response headers of
// `lumiose({ headers })` and Lumiose's defaults, a year of caching for content-hashed assets, the
// static files, then the function for every other path below `base`.

import { DEFAULT_HEADERS, headerRules, type HeadersOption } from "lumiose/internal/app/headers.ts";
import type { BuiltAppConfig } from "lumiose/internal/app/server/app.ts";

/** A route of the Build Output API's `config.json`. */
export type Route =
  | {
      src: string;
      methods?: string[];
      headers?: Record<string, string>;
      dest?: string;
      status?: number;
      continue?: boolean;
    }
  | { handle: "filesystem" | "miss" | "rewrite" | "hit" | "error" | "resource" };

export interface OutputConfig {
  version: 3;
  routes: Route[];
  /** Static files served at another path: `about/index.html` at `/about`. */
  overrides?: Record<string, { path?: string; contentType?: string }>;
}

/** The name of the function directory (`functions/<name>.func`) and of its route destination. */
export const FUNCTION_NAME = "__lumiose";

export interface ConfigInput {
  config: BuiltAppConfig;
  /** Whether the build has a server (a function); without one, unknown paths get `404.html`. */
  hasFunction: boolean;
  /** Prerendered pages, relative to the static directory (`about/index.html`). */
  pages: readonly string[];
  /** The URL paths (with `base`) of the prerendered pages with form actions: their POSTs go to the function. */
  actionPaths: readonly string[];
  /** Whether the static files include a `404.html` (for builds without a function). */
  notFoundPage: boolean;
}

export function outputConfig(input: ConfigInput): OutputConfig {
  const { config } = input;
  const prefix = config.base.slice(0, -1);
  const routes: Route[] = [
    ...headerRoutes(config.headers, prefix),
    {
      src: `^${escape(prefix)}/${escape(config.assetsDir.replace(/^\/+|\/+$/g, ""))}/(?:[^/]+/)*[^/]*[-.](?=\\w*[\\dA-Z])\\w{8,}\\.[^./]+$`,
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
  ];
  // The static file would answer a form post with 405: the function runs the page's actions.
  if (input.hasFunction) {
    for (const path of input.actionPaths) {
      routes.push({
        src: `^${escape(path.replace(/\/$/, ""))}/?$`,
        methods: ["POST", "PUT", "PATCH", "DELETE"],
        dest: `/${FUNCTION_NAME}`,
      });
    }
  }
  routes.push({ handle: "filesystem" });
  if (input.hasFunction) {
    routes.push({ src: `^${escape(prefix)}(?:/.*)?$`, dest: `/${FUNCTION_NAME}` });
  } else if (input.notFoundPage) {
    routes.push({ src: "^/.*$", dest: `${prefix}/404.html`, status: 404 });
  }
  const output: OutputConfig = { version: 3, routes };
  const overrides = pageOverrides(input.pages, config);
  if (Object.keys(overrides).length > 0) output.overrides = overrides;
  return output;
}

/**
 * Prerendered pages at the URL without the slash (`about/index.html` at `/about` with
 * `trailingSlash: "ignore"`, `about.html` at `/about` with `"never"`): the static files answer the
 * usual links, not the function. `"always"` keeps `about/index.html` at `/about/`; the function
 * redirects `/about` there.
 */
function pageOverrides(
  pages: readonly string[],
  config: BuiltAppConfig,
): Record<string, { path: string }> {
  const overrides: Record<string, { path: string }> = {};
  if (config.trailingSlash === "always") return overrides;
  const prefix = config.base.slice(1);
  for (const page of pages) {
    const file = page.slice(prefix.length);
    let path: string | undefined;
    if (config.trailingSlash === "never" && file.endsWith(".html") && file !== "404.html") {
      path = file.slice(0, -".html".length);
    } else if (config.trailingSlash === "ignore" && file.endsWith("/index.html")) {
      path = file.slice(0, -"/index.html".length);
    }
    if (path !== undefined && path !== "index") overrides[page] = { path: prefix + path };
  }
  return overrides;
}

/**
 * One route per header rule, in order (a later rule's value wins), each `continue`-ing to the
 * static files and the function. Lumiose's defaults come first. A `""` value removes a header in
 * Lumiose; routes cannot, so a header removed for every path (`/**`) is left out of the earlier
 * rules, and other removals are not applied to static files.
 */
function headerRoutes(option: HeadersOption | undefined, prefix: string): Route[] {
  const rules = [
    { path: "/**", headers: DEFAULT_HEADERS },
    ...(option === undefined ? [] : headerRules(option)),
  ];
  const removedEverywhere = new Set<string>();
  for (const rule of rules) {
    if (rule.path.split("/").filter(Boolean).join("/") !== "**") continue;
    for (const [name, value] of Object.entries(rule.headers)) {
      if (value === "") removedEverywhere.add(name.toLowerCase());
    }
  }
  const routes: Route[] = [];
  for (const rule of rules) {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(rule.headers)) {
      if (value !== "" && !removedEverywhere.has(name.toLowerCase())) {
        headers[name.toLowerCase()] = value;
      }
    }
    if (Object.keys(headers).length === 0) continue;
    routes.push({ src: pathPattern(rule.path, prefix), headers, continue: true });
  }
  return routes;
}

/** A `lumiose({ headers })` path pattern below `base` as a route regex (`*` a segment, `**` any). */
export function pathPattern(pattern: string, prefix: string): string {
  let regex = `^${escape(prefix)}`;
  for (const segment of pattern.split("/").filter(Boolean)) {
    if (segment === "**") regex += "(?:/[^/]+)*";
    else if (segment === "*") regex += "/[^/]+";
    else regex += `/${escape(segment)}`;
  }
  return `${regex}/?$`;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
