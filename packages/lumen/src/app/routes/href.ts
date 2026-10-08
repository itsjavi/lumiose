// Typed link builder: `href("/blog/[slug]", { slug })` → "/blog/hello-world".

import type { RouteParams, Routes } from "./registry.ts";

/** The params argument: required when the route has params, otherwise optional. */
export type HrefArgs<P extends Routes> =
  {} extends RouteParams<P> ? [params?: RouteParams<P>] : [params: RouteParams<P>];

/**
 * Builds a URL path from a route pattern, encoding each param. A `[...rest]` param keeps
 * its "/" separators and may be empty. Throws on a missing or empty `[param]`.
 */
export function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string {
  const params = (args[0] ?? {}) as Record<string, unknown>;
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
    if (rest) {
      parts.push(
        ...text
          .split("/")
          .filter((part) => part !== "")
          .map(encodeURIComponent),
      );
    } else {
      parts.push(encodeURIComponent(text));
    }
  }
  return `/${parts.join("/")}`;
}
