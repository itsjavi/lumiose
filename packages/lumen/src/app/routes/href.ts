// Typed link builder: `href("/blog/[slug]", { slug })` → "/blog/hello-world", below Vite's `base`
// and in the form of the project's `trailingSlash` policy.
//
// Both come from `import.meta.env`, which Vite fills in in every environment: `lumen` is never
// external or pre-bundled (lumen/vite), so server and client code alike see `BASE_URL` and
// `LUMEN_TRAILING_SLASH` (defined by `lumen dev` and `lumen build` from `lumen({ trailingSlash })`).
// Outside Vite both are unset: paths stay root-relative.

import type { RouteParams, Routes } from "./registry.ts";

declare global {
  interface ImportMetaEnv {
    BASE_URL: string;
    /** `lumen({ trailingSlash })`, for `href()`. Defined by `lumen dev` and `lumen build`. */
    LUMEN_TRAILING_SLASH?: "ignore" | "always" | "never";
  }
}

/** The `define` that carries `trailingSlash` to `href()`; see the module comment. */
export const TRAILING_SLASH_DEFINE = "import.meta.env.LUMEN_TRAILING_SLASH";

/** The params argument: required when the route has params, otherwise optional. */
export type HrefArgs<P extends Routes> =
  {} extends RouteParams<P> ? [params?: RouteParams<P>] : [params: RouteParams<P>];

/**
 * Builds the URL path of a route from its pattern, encoding each param: below Vite's `base`, with
 * a trailing slash when `trailingSlash` is `"always"`. A `[...rest]` param keeps its "/"
 * separators and may be empty. Throws on a missing or empty `[param]`, and on a `.` or `..`
 * segment, which a browser would resolve into another path (TASK-165).
 */
export function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string {
  const path = fillPattern(pattern, (args[0] ?? {}) as Record<string, unknown>);
  const base = normalizeBase(import.meta.env?.BASE_URL ?? "/");
  const slash = import.meta.env?.LUMEN_TRAILING_SLASH === "always" && !isFilePattern(pattern);
  return appPath(path, base, slash);
}

/** The path of a route below the base: the pattern with its params filled in, no trailing slash. */
export function fillPattern(pattern: string, params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const segment of pattern.split("/")) {
    if (segment === "") continue;
    if (!segment.startsWith("[") || !segment.endsWith("]")) {
      parts.push(segment);
      continue;
    }
    const rest = segment.startsWith("[...");
    const name = segment.slice(rest ? 4 : 1, -1);
    const value = params[name];
    if (value === undefined || value === null || (!rest && value === "")) {
      throw new TypeError(`href("${pattern}"): missing value for param "${name}".`);
    }
    const text = String(value);
    const pieces = rest ? text.split("/").filter((part) => part !== "") : [text];
    for (const piece of pieces) {
      // encodeURIComponent keeps dots: `..` would climb out of the route once resolved.
      if (piece === "." || piece === "..") {
        throw new TypeError(`href("${pattern}"): param "${name}" cannot be "${piece}".`);
      }
      parts.push(encodeURIComponent(piece));
    }
  }
  return `/${parts.join("/")}`;
}

/**
 * `path` (below the base, from `fillPattern`) as a URL path of the app. The root is the base
 * itself ("/docs/"); `slash` adds the trailing slash of `trailingSlash: "always"` to other paths.
 */
export function appPath(path: string, base: string, slash: boolean): string {
  if (path === "/") return base;
  return base + path.slice(1) + (slash ? "/" : "");
}

/** Vite's `base` as a path with leading and trailing slashes; a relative base counts as "/". */
export function normalizeBase(base: string): string {
  let path = /^[a-z][a-z\d+.-]*:\/\//i.test(base) ? new URL(base).pathname : base;
  if (path === "" || path === "./") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Whether a pattern names a file (`/feed.xml`): an endpoint, whose URL takes no trailing slash. A
 * dot in the last segment, outside a param (`[...path]`), marks one.
 */
function isFilePattern(pattern: string): boolean {
  const last = pattern.slice(pattern.lastIndexOf("/") + 1);
  return last.replace(/\[[^\]]*\]/g, "").includes(".");
}
