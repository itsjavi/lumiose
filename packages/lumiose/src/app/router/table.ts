// Which routes render as an SPA (spec §7.1, §7.5), and the route table the client router gets.
//
// A page with `mode = "spa"` is part of an SPA subtree. The subtree starts at the outermost `spa`
// layout of its chain (or at the page itself when no layout is `spa`): the layouts above it render
// on the server only, and the subtree renders as one root island. Pages that share that first
// layout belong to the same SPA ("app") and navigate between each other on the client; any other
// URL is a document navigation. `not-found` and `error` pages below an `spa` layout render inside the
// SPA too. Pure and runtime-agnostic: used by the request handler, the dev and build entry
// generator, and (as generated data) the client router.

import type { I18nUrls } from "../i18n/config.ts";
import type { PageRoute, RouteManifest } from "../routes/manifest.ts";
import type { RouteSegment } from "../routes/segments.ts";

/** Suffix of the island ref of an SPA root, rendered on the server and hydrated: `/<leaf file>#lumiose:spa`. */
export const SPA_REF = "#lumiose:spa";
/** Suffix of the island ref of an SPA shell (`ssr = false`), rendered on the client only. */
export const CSR_REF = "#lumiose:csr";
/** Set on `<html>` by a `not-found` page's script while it hides the document for the router (`rerouteScript()`). */
export const REROUTE_ATTR = "data-l-reroute";

/** The part of a page's layout chain that renders inside the SPA root island. */
export interface SpaPart {
  /** Layout files the server renders around the island, outermost first. */
  outer: string[];
  /** Files the island renders: the SPA's layouts, outermost first, then the page. */
  levels: string[];
  /** The SPA the page belongs to: the file of its first level. */
  app: string;
  /** `false`: the server sends an empty shell and the client renders the island. */
  ssr: boolean;
}

type Layouts = Pick<RouteManifest, "layouts">;

/** The SPA part of a page with `mode = "spa"`, given its layout chain and resolved `ssr`. */
export function spaPagePart(
  manifest: Layouts,
  layouts: readonly string[],
  file: string,
  ssr: boolean,
): SpaPart {
  const modes = layoutModes(manifest);
  const start = layouts.findIndex((layout) => modes.get(layout)?.mode === "spa");
  return part(layouts, start === -1 ? layouts.length : start, file, ssr);
}

/**
 * The SPA part of a `not-found`/`error` page rendered with `layouts`, or `undefined` when none of
 * them is an `spa` layout. Its `ssr` is the innermost `spa` layout's.
 */
export function spaErrorPart(
  manifest: Layouts,
  layouts: readonly string[],
  file: string,
): SpaPart | undefined {
  const modes = layoutModes(manifest);
  const start = layouts.findIndex((layout) => modes.get(layout)?.mode === "spa");
  if (start === -1) return undefined;
  const innermost = layouts.findLast((layout) => modes.get(layout)?.mode === "spa")!;
  return part(layouts, start, file, modes.get(innermost)!.ssr);
}

function part(layouts: readonly string[], start: number, file: string, ssr: boolean): SpaPart {
  const levels = [...layouts.slice(start), file];
  return { outer: layouts.slice(0, start), levels, app: levels[0]!, ssr };
}

function layoutModes(manifest: Layouts): Map<string, { mode: string; ssr: boolean }> {
  return new Map(manifest.layouts.map((layout) => [layout.file, layout]));
}

/** Layout files that wrap a page in the routes-relative `dir`, outermost first. */
export function layoutChain(manifest: Layouts, dir: string): string[] {
  return manifest.layouts
    .filter((layout) => layout.dir === "" || dir === layout.dir || dir.startsWith(`${layout.dir}/`))
    .toSorted((a, b) => a.dir.length - b.dir.length)
    .map((layout) => layout.file);
}

// --- The client table ---------------------------------------------------------------------------

/** A route as the client router sees it: every page and endpoint, so that it knows what is not its own. */
export interface ClientRoute {
  segments: RouteSegment[];
  /** SPA pages: the SPA they belong to. */
  app?: string;
  /** SPA pages: the files rendered by the island (layouts, then the page). */
  levels?: string[];
  /** SPA pages: the nearest `not-found` and `error` pages. */
  notFound?: string;
  error?: string;
  /** SPA pages: a 404 rendered for its URL renders the page on the client instead (see `reroutes`). */
  reroute?: true;
  /**
   * SPA pages with `lumiose({ i18n })`: the locales the page declares. Absent when a `locales()`
   * function decides per params: navigations to the page then load the document.
   */
  locales?: string[];
}

/** A `not-found` page and the URL scope of its directory (for unmatched URLs). */
export interface ClientNotFoundPage {
  file: string;
  dir: string;
  segments: RouteSegment[];
}

export interface ClientTable {
  /** Pages and endpoints in match priority order. */
  routes: ClientRoute[];
  notFoundPages: ClientNotFoundPage[];
  /** `not-found`/`error` pages that render inside an SPA, by file. */
  pages: Record<string, { app: string; levels: string[] }>;
  /** `lumiose({ i18n })`: paths carry locale prefixes (decision-44). */
  i18n?: I18nUrls;
}

/** The client route table of an app, or `undefined` when it has no `spa` pages. */
export function clientTable(
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages" | "i18n">,
): ClientTable | undefined {
  const routes: ClientRoute[] = [];
  let spa = false;
  for (const route of manifest.routes) {
    if (route.kind !== "page" || route.mode !== "spa") {
      routes.push({ segments: route.segments });
      continue;
    }
    spa = true;
    const { app, levels } = spaPagePart(manifest, route.layouts, route.file, route.ssr);
    const entry: ClientRoute = { segments: route.segments, app, levels };
    if (route.notFoundPage !== undefined) entry.notFound = route.notFoundPage;
    if (route.errorPage !== undefined) entry.error = route.errorPage;
    if (reroutes(route)) entry.reroute = true;
    if (route.locales !== undefined) entry.locales = route.locales;
    routes.push(entry);
  }
  if (!spa) return undefined;
  const pages: ClientTable["pages"] = {};
  for (const page of [...manifest.notFoundPages, ...manifest.errorPages]) {
    const found = spaErrorPart(manifest, layoutChain(manifest, page.dir), page.file);
    if (found !== undefined) pages[page.file] = { app: found.app, levels: found.levels };
  }
  return {
    routes,
    notFoundPages: manifest.notFoundPages.map(({ file, dir, segments }) => ({
      file,
      dir,
      segments,
    })),
    pages,
    ...(manifest.i18n === undefined
      ? {}
      : { i18n: { locales: manifest.i18n.locales, defaultLocale: manifest.i18n.defaultLocale } }),
  };
}

/**
 * Whether a 404 the server rendered for a URL of this `spa` page is the browser's to resolve: the
 * page has params and is not rendered per request (`prerender`, or an `ssr = false` shell). A static
 * host answers the URLs `staticPaths()` did not list with `404.html`, and where the page does render
 * on the server (`lumiose dev`, a server build), it has no browser data: a song saved in the
 * browser is unknown there. When a `not-found` page hydrates at such a URL, the router renders the
 * page instead.
 */
export function reroutes(route: Pick<PageRoute, "mode" | "ssr" | "prerender" | "params">): boolean {
  return route.mode === "spa" && (route.prerender || !route.ssr) && route.params.length > 0;
}

/** Whether any SPA page or SPA error page is rendered on the server (and so hydrates). */
export function spaHydrates(
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">,
): boolean {
  return (
    manifest.routes.some((route) => route.kind === "page" && route.mode === "spa" && route.ssr) ||
    [...manifest.notFoundPages, ...manifest.errorPages].some(
      (page) => spaErrorPart(manifest, layoutChain(manifest, page.dir), page.file)?.ssr === true,
    )
  );
}

/** Every file the client router may import: the levels of SPA pages and error pages. */
export function clientFiles(table: ClientTable): string[] {
  const files = new Set<string>();
  for (const route of table.routes) for (const file of route.levels ?? []) files.add(file);
  for (const page of Object.values(table.pages)) for (const file of page.levels) files.add(file);
  return [...files].toSorted();
}
