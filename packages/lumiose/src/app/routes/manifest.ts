// Builds the typed route manifest from route files (spec §7.1, §8). Pure: `scan.ts` does
// the file system work, so this also runs on in-memory trees (tests, dev server updates).

import {
  LUM_DUPLICATE_ROUTE,
  LUM_INVALID_ROUTE_FILE,
  LUM_PRERENDER_CLIENT_ONLY,
  LUM_STATIC_ENDPOINT_METHOD,
  type AppDiagnostic,
  type DiagnosticSeverity,
} from "../diagnostics.ts";
import { readRouteModuleMeta, type ReadRouteModuleMeta, type RouteModuleMeta } from "./meta.ts";
import {
  classifyRouteFile,
  compareSegments,
  formatPattern,
  patternKey,
  routeVariants,
  type RouteFile,
  type RouteSegment,
} from "./segments.ts";

export type RouteMode = "static" | "server" | "spa";
/** Endpoints are prerendered (`static`) or served per request (`server`). */
export type EndpointMode = "static" | "server";

export interface RouteParam {
  name: string;
  /** `[...name]` and `[[...name]]`: the matched segments, joined with "/". */
  rest: boolean;
  /** `[[name]]` and `[[...name]]`: may match no segment, and then the param is absent. */
  optional: boolean;
}

interface RouteBase {
  /** Lumiose route pattern, e.g. `/blog/[slug]`; route groups are removed. */
  pattern: string;
  segments: RouteSegment[];
  params: RouteParam[];
  /** Project-relative POSIX path, e.g. `src/routes/blog/[slug]/page.stsx`. */
  file: string;
}

export interface PageRoute extends RouteBase {
  kind: "page";
  /** Own `export const mode`, else the nearest layout's, else the project default (`static`). */
  mode: RouteMode;
  /** `false` only for `spa` routes rendered as a client shell (`export const ssr = false`). */
  ssr: boolean;
  /**
   * `spa` routes rendered at build time into HTML that hydrates (decision-38): own
   * `export const prerender`, else the nearest layout's, else the project default
   * `lumiose({ prerender })`. Always `false` for other modes (`static` routes are prerendered by
   * their mode) and `ssr = false` shells.
   */
  prerender: boolean;
  /** Layout files, outermost first. */
  layouts: string[];
  /** Nearest `error` page. */
  errorPage: string | undefined;
  /** Nearest `not-found` page, rendered when the page calls `notFound()`. */
  notFoundPage: string | undefined;
}

export interface EndpointRoute extends RouteBase {
  kind: "endpoint";
  /** Own `export const mode`, else inherited from the nearest layout or the project default (`spa` serves endpoints live as `server`), else `static`. */
  mode: EndpointMode;
}

export type RouteEntry = PageRoute | EndpointRoute;

export interface LayoutEntry {
  file: string;
  /** Routes-relative directory the layout applies to. */
  dir: string;
  /** URL scope of the layout's directory. */
  pattern: string;
  mode: RouteMode;
  ssr: boolean;
}

/** A `not-found` or `error` page and the URL scope of its directory. */
export interface SpecialPage {
  file: string;
  dir: string;
  pattern: string;
  segments: RouteSegment[];
}

export interface RouteManifest {
  /** Project-relative POSIX path of the routes directory. */
  routesDir: string;
  /**
   * Pages and endpoints in match priority order; a route with optional segments sorts by its most
   * specific URL shape (the matcher ranks each shape on its own).
   */
  routes: RouteEntry[];
  layouts: LayoutEntry[];
  notFoundPages: SpecialPage[];
  errorPages: SpecialPage[];
  diagnostics: AppDiagnostic[];
}

export interface RouteSourceFile {
  /** Path relative to the routes directory, POSIX separators. */
  path: string;
  source: string;
}

export interface CreateRouteManifestOptions {
  /** Project-relative routes directory. Default `src/routes`. */
  routesDir?: string;
  /** Reads `mode`/`ssr` from a module; swappable for compiler-provided module meta. */
  readMeta?: ReadRouteModuleMeta;
  /** Project default mode, `lumiose({ mode })` (decision-21); layouts and routes override it. Default `static`. */
  defaultMode?: RouteMode;
  /** Project default `ssr` of `spa` routes, `lumiose({ ssr })`. Default `true`. */
  defaultSsr?: boolean;
  /** Project default `prerender` of `spa` routes, `lumiose({ prerender })` (decision-38). Default `false`. */
  defaultPrerender?: boolean;
}

export const DEFAULT_ROUTES_DIR = "src/routes";
const ROUTE_MODES: readonly string[] = ["static", "server", "spa"];
const ENDPOINT_MODES: readonly string[] = ["static", "server"];

type Report = (
  code: AppDiagnostic["code"],
  severity: DiagnosticSeverity,
  file: string,
  message: string,
  help?: string,
) => void;

interface Declared {
  file: string;
  route: RouteFile;
  mode: string | undefined;
  ssr: boolean | undefined;
  prerender: boolean | undefined;
  methods: readonly string[];
}

export function createRouteManifest(
  files: readonly RouteSourceFile[],
  options: CreateRouteManifestOptions = {},
): RouteManifest {
  const routesDir = trimSlashes(options.routesDir ?? DEFAULT_ROUTES_DIR);
  const readMeta = options.readMeta ?? readRouteModuleMeta;
  const defaultMode = options.defaultMode ?? "static";
  const defaultSsr = options.defaultSsr ?? true;
  const defaultPrerender = options.defaultPrerender ?? false;
  const diagnostics: AppDiagnostic[] = [];
  const report: Report = (code, severity, file, message, help) => {
    const diagnostic: AppDiagnostic = { code, severity, message, file };
    if (help !== undefined) diagnostic.help = help;
    diagnostics.push(diagnostic);
  };

  const modules: Declared[] = [];
  const layoutsByDir = new Map<string, Declared>();
  const notFoundByDir = new Map<string, SpecialPage>();
  const errorByDir = new Map<string, SpecialPage>();

  for (const { path, source } of files.toSorted((a, b) => compareStrings(a.path, b.path))) {
    const file = routesDir === "" ? path : `${routesDir}/${path}`;
    const route = classifyRouteFile(path);
    if (route.status === "ignored") continue;
    if (route.status === "invalid") {
      report(LUM_INVALID_ROUTE_FILE, "error", file, route.message, route.help);
      continue;
    }

    if (route.kind === "notFound" || route.kind === "error") {
      const byDir = route.kind === "notFound" ? notFoundByDir : errorByDir;
      const existing = byDir.get(route.dir);
      if (existing !== undefined) {
        report(
          LUM_DUPLICATE_ROUTE,
          "error",
          file,
          `Duplicate ${route.kind === "notFound" ? "not-found" : "error"} page: "${existing.file}" already exists.`,
          "Keep one of them.",
        );
        continue;
      }
      byDir.set(route.dir, {
        file,
        dir: route.dir,
        pattern: formatPattern(route.segments),
        segments: route.segments,
      });
      continue;
    }

    const meta = readMeta(source);
    const declared = {
      file,
      route,
      ...checkMeta(meta, route, file, report),
      methods: meta.methods ?? [],
    };
    if (route.kind === "layout") {
      const existing = layoutsByDir.get(route.dir);
      if (existing !== undefined) {
        report(
          LUM_DUPLICATE_ROUTE,
          "error",
          file,
          `Duplicate layout: "${existing.file}" already exists.`,
          "Keep one of them.",
        );
        continue;
      }
      layoutsByDir.set(route.dir, declared);
    } else {
      modules.push(declared);
    }
  }

  const layoutChain = (dir: string): Declared[] =>
    ancestors(dir).flatMap((ancestor) => layoutsByDir.get(ancestor) ?? []);
  const inheritedMode = (dir: string): RouteMode | undefined =>
    layoutChain(dir).find((layout) => layout.mode !== undefined)?.mode as RouteMode | undefined;
  const inheritedSsr = (dir: string): boolean | undefined =>
    layoutChain(dir).find((layout) => layout.ssr !== undefined)?.ssr;
  const nearest = (byDir: Map<string, SpecialPage>, dir: string): string | undefined => {
    for (const ancestor of ancestors(dir)) {
      const page = byDir.get(ancestor);
      if (page !== undefined) return page.file;
    }
    return undefined;
  };

  const resolveSsr = (declared: Declared, mode: RouteMode, dir: string): boolean => {
    if (declared.ssr === false && mode !== "spa") {
      report(
        LUM_INVALID_ROUTE_FILE,
        "warning",
        declared.file,
        `"export const ssr = false" has no effect: it applies to spa routes and this file's mode is "${mode}".`,
        'Remove it, or also set export const mode = "spa".',
      );
    }
    if (mode !== "spa") return true;
    return declared.ssr ?? inheritedSsr(dir) ?? defaultSsr;
  };

  const noPrerenderEffect = (file: string, mode: RouteMode, where: string): void =>
    report(
      LUM_INVALID_ROUTE_FILE,
      "warning",
      file,
      `"export const prerender" has no effect: it applies to spa routes and this ${where}'s mode is "${mode}".`,
      mode === "static"
        ? "Remove it: static routes are always prerendered."
        : 'Remove it, or set export const mode = "static" to prerender these routes.',
    );

  // A layout's `prerender` applies to the `spa` pages below it (decision-38 amendment), so it has
  // no effect, and is not inherited, when the layout itself is not `spa`.
  for (const layout of layoutsByDir.values()) {
    if (layout.prerender === undefined) continue;
    const mode = inheritedMode(layout.route.dir) ?? defaultMode;
    if (mode !== "spa") {
      noPrerenderEffect(layout.file, mode, "layout");
      layout.prerender = undefined;
    }
  }

  const reportedClientOnly = new Set<string>();
  // `prerender` resolves like `ssr`: the page's own export, else the nearest layout that sets it,
  // else the project default. The project default applies to `spa` pages rendered on the server
  // only, so an `ssr = false` shell under `lumiose({ prerender: true })` stays one; an explicit
  // `prerender = true` (own or inherited) on such a page is LUM5006.
  const resolvePrerender = (
    declared: Declared,
    mode: RouteMode,
    ssr: boolean,
    dir: string,
  ): boolean => {
    if (declared.prerender !== undefined && mode !== "spa") {
      noPrerenderEffect(declared.file, mode, "file");
      return false;
    }
    if (mode !== "spa") return false;
    const source =
      declared.prerender === undefined
        ? layoutChain(dir).find((layout) => layout.prerender !== undefined)
        : declared;
    if (source === undefined) return ssr && defaultPrerender;
    if (source.prerender === true && !ssr) {
      if (source === declared) {
        report(
          LUM_PRERENDER_CLIENT_ONLY,
          "error",
          declared.file,
          `"export const prerender = true" renders this page at build time, but its ssr is false, so it renders only in the browser.`,
          "Remove export const ssr = false (here, in a layout or in lumiose({ ssr })) to prerender the page, or remove prerender to keep the client-rendered shell.",
        );
        return false;
      }
      // Report where the conflict is introduced: the page when it sets ssr = false, else the
      // deeper of the two layouts, once.
      const ssrLayout =
        declared.ssr === false ? undefined : layoutChain(dir).find((l) => l.ssr !== undefined);
      const file =
        declared.ssr === false
          ? declared.file
          : ssrLayout !== undefined && ssrLayout.route.dir.length > source.route.dir.length
            ? ssrLayout.file
            : source.file;
      if (!reportedClientOnly.has(file)) {
        reportedClientOnly.add(file);
        report(
          LUM_PRERENDER_CLIENT_ONLY,
          "error",
          file,
          `"${declared.file}" inherits "export const prerender = true" from "${source.file}", but its ssr is false, so it renders only in the browser.`,
          "Set export const prerender = false on the pages that render only in the browser, or remove export const ssr = false (in the page, a layout or lumiose({ ssr })) to prerender them.",
        );
      }
      return false;
    }
    return source.prerender === true;
  };

  const layouts: LayoutEntry[] = [...layoutsByDir.values()]
    .toSorted((a, b) => compareStrings(a.route.dir, b.route.dir))
    .map((layout) => {
      // The chain starts at the layout itself, so its own declaration wins.
      const mode = inheritedMode(layout.route.dir) ?? defaultMode;
      return {
        file: layout.file,
        dir: layout.route.dir,
        pattern: formatPattern(layout.route.segments),
        mode,
        ssr: resolveSsr(layout, mode, layout.route.dir),
      };
    });

  const routes: RouteEntry[] = [];
  const byKey = new Map<string, RouteEntry>();
  // Routes without optional segments claim their URLs first, so an overlap is reported on the
  // route whose optional segment causes it.
  const optionals = (declared: Declared) =>
    declared.route.segments.filter((s) => s.kind === "optional" || s.kind === "optionalRest")
      .length;
  for (const declared of modules.toSorted((a, b) => optionals(a) - optionals(b))) {
    const { route, file } = declared;
    const base: RouteBase = {
      pattern: formatPattern(route.segments),
      segments: route.segments,
      params: route.segments.flatMap((segment) =>
        segment.kind === "static"
          ? []
          : [
              {
                name: segment.name,
                rest: segment.kind === "rest" || segment.kind === "optionalRest",
                optional: segment.kind === "optional" || segment.kind === "optionalRest",
              },
            ],
      ),
      file,
    };
    let entry: RouteEntry;
    if (route.kind === "endpoint") {
      const inherited = inheritedMode(route.dir) ?? defaultMode;
      const mode =
        (declared.mode as EndpointMode | undefined) ??
        (inherited === "static" ? "static" : "server");
      entry = { ...base, kind: "endpoint", mode };
      const methods = declared.methods.filter((method) => method !== "GET");
      if (mode === "static" && methods.length > 0) {
        report(
          LUM_STATIC_ENDPOINT_METHOD,
          "error",
          file,
          `This endpoint is static (prerendered to a file at build time), so it can only serve GET, but it exports ${methods.join(", ")}.`,
          'Serve it per request with export const mode = "server", or keep only GET.',
        );
      }
    } else {
      const mode =
        (declared.mode as RouteMode | undefined) ?? inheritedMode(route.dir) ?? defaultMode;
      const ssr = resolveSsr(declared, mode, route.dir);
      entry = {
        ...base,
        kind: "page",
        mode,
        ssr,
        prerender: resolvePrerender(declared, mode, ssr, route.dir),
        layouts: layoutChain(route.dir)
          .map((layout) => layout.file)
          .toReversed(),
        errorPage: nearest(errorByDir, route.dir),
        notFoundPage: nearest(notFoundByDir, route.dir),
      };
    }

    // Each URL shape of a route (with and without its optional segments) has one owner.
    const variants = routeVariants(route.segments);
    const keys = variants.map(patternKey);
    const clash = keys.findIndex((key) => byKey.has(key));
    if (clash !== -1) {
      const existing = byKey.get(keys[clash]!)!;
      const sameFolder =
        existing.file.slice(0, existing.file.lastIndexOf("/")) ===
        file.slice(0, file.lastIndexOf("/"));
      if (sameFolder) {
        report(
          LUM_DUPLICATE_ROUTE,
          "error",
          file,
          `Duplicate route "${entry.pattern}": "${existing.file}" already serves the same URLs.`,
          existing.kind === entry.kind
            ? "Keep one of them."
            : "A folder has either a page or a route.ts endpoint: move one of them to another folder.",
        );
      } else {
        const urls =
          patternKey(existing.segments) === patternKey(route.segments)
            ? "the same URLs"
            : `"${formatPattern(variants[clash]!)}"`;
        report(
          LUM_DUPLICATE_ROUTE,
          "error",
          file,
          `Duplicate route "${entry.pattern}": "${existing.file}" already serves ${urls}.`,
          "Remove or move one of the files. Route groups and param names do not change the URL, and an optional segment also serves the URL without it.",
        );
      }
      continue;
    }
    for (const key of keys) byKey.set(key, entry);
    routes.push(entry);
  }
  const priority = (entry: RouteEntry) => routeVariants(entry.segments)[0]!;
  const specialPages = (byDir: Map<string, SpecialPage>) =>
    [...byDir.values()].toSorted((a, b) => compareStrings(a.dir, b.dir));

  return {
    routesDir,
    routes: routes.toSorted(
      (a, b) =>
        compareSegments(priority(a), priority(b)) || compareSegments(a.segments, b.segments),
    ),
    layouts,
    notFoundPages: specialPages(notFoundByDir),
    errorPages: specialPages(errorByDir),
    diagnostics,
  };
}

function checkMeta(
  meta: RouteModuleMeta,
  route: RouteFile,
  file: string,
  report: Report,
): { mode: string | undefined; ssr: boolean | undefined; prerender: boolean | undefined } {
  for (const problem of meta.problems) {
    report(
      LUM_INVALID_ROUTE_FILE,
      "error",
      file,
      problem,
      "Lumiose reads route options at build time; use a literal value.",
    );
  }
  let mode = meta.mode;
  const allowed = route.kind === "endpoint" ? ENDPOINT_MODES : ROUTE_MODES;
  if (mode !== undefined && !allowed.includes(mode)) {
    report(
      LUM_INVALID_ROUTE_FILE,
      "error",
      file,
      `Invalid mode "${mode}" for ${route.kind === "endpoint" ? "an endpoint" : `a ${route.kind}`}.`,
      `Use one of: ${allowed.map((value) => `"${value}"`).join(", ")}.`,
    );
    mode = undefined;
  }
  if (route.kind === "endpoint") {
    if (meta.prerender !== undefined) {
      report(
        LUM_INVALID_ROUTE_FILE,
        "warning",
        file,
        `"export const prerender" has no effect in an endpoint: it applies to spa pages.`,
        'Remove it: static endpoints (the default) are prerendered, export const mode = "server" ones are not.',
      );
    }
    return { mode, ssr: undefined, prerender: undefined };
  }
  return { mode, ssr: meta.ssr, prerender: meta.prerender };
}

/** Nearest-first ancestors of a routes-relative directory, including itself. */
function ancestors(dir: string): string[] {
  const result = [dir];
  while (dir !== "") {
    const at = dir.lastIndexOf("/");
    dir = at === -1 ? "" : dir.slice(0, at);
    result.push(dir);
  }
  return result;
}

function trimSlashes(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\/+|\/+$/g, "");
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
