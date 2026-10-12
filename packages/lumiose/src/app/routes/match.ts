// URL → route matching (spec §8). Runtime-agnostic: used by the request handler and the
// SPA router. Priority, segment by segment: static > [param] > [...rest]; groups are
// already removed from patterns by the manifest. A route with optional segments competes with
// each of its URL shapes (`/[[lang]]/about` as `/about` and `/[lang]/about`).

import type { RouteEntry, RouteManifest, SpecialPage } from "./manifest.ts";
import {
  compareSegments,
  routeVariants,
  type RouteSegment,
  type VariantSegment,
} from "./segments.ts";

export type RouteParamValues = Record<string, string>;

export interface RouteMatch<R extends RouteEntry = RouteEntry> {
  route: R;
  /**
   * Decoded params; a `[...rest]` param holds the matched segments joined with "/", and an
   * optional param that matched no segment is absent.
   */
  params: RouteParamValues;
}

export interface RouteMatcher {
  /** The highest-priority route for a pathname (query and hash are ignored). */
  match(pathname: string): RouteMatch | null;
  /** The `not-found` page whose directory scope best covers an unmatched pathname. */
  notFound(pathname: string): SpecialPage | undefined;
}

export function createRouteMatcher(
  manifest: Pick<RouteManifest, "routes" | "notFoundPages">,
): RouteMatcher {
  const routes = manifest.routes
    .flatMap((route) => routeVariants(route.segments).map((segments) => ({ route, segments })))
    .toSorted((a, b) => compareSegments(a.segments, b.segments));
  // Deeper scopes first; on equal scopes prefer the page outside route groups (shallower folder).
  const notFoundPages = manifest.notFoundPages
    .flatMap((page) => routeVariants(page.segments).map((segments) => ({ page, segments })))
    .toSorted(
      (a, b) => b.segments.length - a.segments.length || depth(a.page.dir) - depth(b.page.dir),
    );

  return {
    match(pathname) {
      const parts = splitPathname(pathname);
      for (const { route, segments } of routes) {
        const params = matchVariant(segments, parts, false);
        if (params !== null) return { route, params };
      }
      return null;
    },
    notFound(pathname) {
      const parts = splitPathname(pathname);
      return notFoundPages.find(({ segments }) => matchVariant(segments, parts, true) !== null)
        ?.page;
    },
  };
}

/** Matches decoded path segments against a route; `prefix` allows extra trailing parts. */
export function matchSegments(
  segments: readonly RouteSegment[],
  parts: readonly string[],
  prefix = false,
): RouteParamValues | null {
  for (const variant of routeVariants(segments)) {
    const params = matchVariant(variant, parts, prefix);
    if (params !== null) return params;
  }
  return null;
}

function matchVariant(
  segments: readonly VariantSegment[],
  parts: readonly string[],
  prefix: boolean,
): RouteParamValues | null {
  const params: RouteParamValues = {};
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    if (segment.kind === "rest") {
      if (i >= parts.length) return null;
      params[segment.name] = parts.slice(i).join("/");
      return params;
    }
    const part = parts[i];
    if (part === undefined) return null;
    if (segment.kind === "static") {
      if (part !== segment.value) return null;
    } else {
      params[segment.name] = part;
    }
  }
  return prefix || parts.length === segments.length ? params : null;
}

/** Splits a pathname into decoded, non-empty segments ("/a//b/" → ["a", "b"]). */
export function splitPathname(pathname: string): string[] {
  const end = pathname.search(/[?#]/);
  const path = end === -1 ? pathname : pathname.slice(0, end);
  return path
    .split("/")
    .filter((part) => part !== "")
    .map(decodeSegment);
}

function decodeSegment(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function depth(dir: string): number {
  return dir === "" ? 0 : dir.split("/").length;
}
