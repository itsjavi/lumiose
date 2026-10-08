// Which routes render as an SPA (spec §7.1, §7.5), and the route table the client router gets.
//
// A page with `mode = "spa"` is part of an SPA subtree. The subtree starts at the outermost `spa`
// layout of its chain (or at the page itself when no layout is `spa`): the layouts above it render
// on the server only, and the subtree renders as one root island. Pages that share that first
// layout belong to the same SPA ("app") and navigate between each other on the client; any other
// URL is a document navigation. `_404` and `_error` pages below an `spa` layout render inside the
// SPA too. Pure and runtime-agnostic: used by the request handler, the dev and build entry
// generator, and (as generated data) the client router.

import type { RouteManifest } from "../routes/manifest.ts";
import type { RouteSegment } from "../routes/segments.ts";

/** Suffix of the island ref of an SPA root, rendered on the server and hydrated: `/<leaf file>#lumen:spa`. */
export const SPA_REF = "#lumen:spa";
/** Suffix of the island ref of an SPA shell (`ssr = false`), rendered on the client only. */
export const CSR_REF = "#lumen:csr";

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
 * The SPA part of a `_404`/`_error` page rendered with `layouts`, or `undefined` when none of
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
  /** SPA pages: the nearest `_404` and `_error` pages. */
  notFound?: string;
  error?: string;
}

/** A `_404` page and the URL scope of its directory (for unmatched URLs). */
export interface ClientNotFoundPage {
  file: string;
  dir: string;
  segments: RouteSegment[];
}

export interface ClientTable {
  /** Pages and endpoints in match priority order. */
  routes: ClientRoute[];
  notFoundPages: ClientNotFoundPage[];
  /** `_404`/`_error` pages that render inside an SPA, by file. */
  pages: Record<string, { app: string; levels: string[] }>;
}

/** The client route table of an app, or `undefined` when it has no `spa` pages. */
export function clientTable(
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">,
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
  };
}

/** Every file the client router may import: the levels of SPA pages and error pages. */
export function clientFiles(table: ClientTable): string[] {
  const files = new Set<string>();
  for (const route of table.routes) for (const file of route.levels ?? []) files.add(file);
  for (const page of Object.values(table.pages)) for (const file of page.levels) files.add(file);
  return [...files].toSorted();
}
