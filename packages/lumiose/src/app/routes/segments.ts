// File-route naming conventions (spec §8, decision-42): the Next.js App Router file names.
// Classifies a `src/routes`-relative path and parses its folders into URL segments. Pure and
// runtime-agnostic.

export type RouteSegment =
  | { kind: "static"; value: string }
  /** `[name]`: exactly one segment. */
  | { kind: "param"; name: string }
  /** `[[name]]`: zero or one segment. */
  | { kind: "optional"; name: string }
  /** `[...name]`: one or more segments; always last. */
  | { kind: "rest"; name: string }
  /** `[[...name]]`: zero or more segments; always last. */
  | { kind: "optionalRest"; name: string };

/** A segment list without optional segments: one URL shape of a route ({@link routeVariants}). */
export type VariantSegment = Extract<RouteSegment, { kind: "static" | "param" | "rest" }>;

export type RouteFileKind = "page" | "endpoint" | "layout" | "notFound" | "error" | "middleware";

export interface RouteFile {
  status: "route";
  kind: RouteFileKind;
  /** Routes-relative POSIX directory of the file ("" for the routes root). */
  dir: string;
  /**
   * URL segments of the file's directory: the route itself for `page` and `route` files, the URL
   * scope of `layout`, `not-found`, `error` and `middleware` files.
   */
  segments: RouteSegment[];
}

export interface InvalidRouteFile {
  status: "invalid";
  message: string;
  help?: string;
}

/** Not a route file: a colocated module, or anything below a private (`_`) or hidden folder. */
export interface IgnoredRouteFile {
  status: "ignored";
}

export type ClassifiedRouteFile = RouteFile | InvalidRouteFile | IgnoredRouteFile;

const PAGE_EXTENSIONS: readonly string[] = [".stsx", ".tsx"];
const ROUTE_EXTENSIONS: readonly string[] = [...PAGE_EXTENSIONS, ".ts"];
/** File names (without extension) that give a folder behavior. */
const SPECIAL_FILES: Record<string, RouteFileKind> = {
  page: "page",
  route: "endpoint",
  layout: "layout",
  "not-found": "notFound",
  error: "error",
  middleware: "middleware",
};
/** Folder middleware (decision-48): the extensions of `src/middleware.ts`. */
const MIDDLEWARE_EXTENSIONS: readonly string[] = [".ts", ".js"];
/** Next.js special files Lumiose does not have, and what to use instead. */
const UNSUPPORTED_FILES: Record<string, string> = {
  loading: "Show pending UI with <Suspense fallback={…}> in the page or a layout.",
  template: "Use a layout.",
  default: "Lumiose has no parallel routes: remove the file.",
  "global-error": "Use an error page (error.stsx) at the root of src/routes.",
};
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const GROUP = /^\(([^()]+)\)$/;
const INTERCEPTING = /^(?:\(\.{1,3}\))+/;
const PARAM = /^\[(\.\.\.)?([^[\]]*)\]$/;
const OPTIONAL_PARAM = /^\[\[(\.\.\.)?([^[\]]*)\]\]$/;
const UNSAFE_STATIC = /[\s?#%\\{}<>|^"`[\]()]/;

/**
 * Whether a file name is a route file name (`page.stsx`, `route.ts`, `layout.tsx`, …) or one of
 * the Next.js special files reported as unsupported: the cheap filter before reading a file.
 */
export function isRouteModuleCandidate(fileName: string): boolean {
  if (fileName === "middleware.js") return true;
  const split = splitExtension(fileName);
  return split !== undefined && (split.stem in SPECIAL_FILES || split.stem in UNSUPPORTED_FILES);
}

/** Whether nothing below a folder of this name routes: private (`_name`) and hidden folders. */
export function isIgnoredRouteFolder(name: string): boolean {
  return name.startsWith("_") || name.startsWith(".") || name === "node_modules";
}

/** Classifies a `src/routes`-relative POSIX path. */
export function classifyRouteFile(path: string): ClassifiedRouteFile {
  const parts = path.split("/");
  const fileName = parts.pop() ?? "";
  if (parts.some(isIgnoredRouteFolder)) return { status: "ignored" };
  const split =
    fileName === "middleware.js"
      ? { stem: "middleware", extension: ".js" }
      : splitExtension(fileName);
  if (split === undefined) return { status: "ignored" };
  const { stem, extension } = split;
  const unsupported = UNSUPPORTED_FILES[stem];
  if (unsupported !== undefined) {
    return invalid(
      `"${fileName}": Lumiose has no ${stem} files (a Next.js convention).`,
      unsupported,
    );
  }
  const kind = SPECIAL_FILES[stem];
  if (kind === undefined) return { status: "ignored" };
  if (kind === "endpoint" && extension !== ".ts") {
    return invalid(`"${fileName}": an endpoint is a route.ts file.`, 'Rename it to "route.ts".');
  }
  if (kind === "middleware") {
    if (!MIDDLEWARE_EXTENSIONS.includes(extension)) {
      return invalid(
        `"${fileName}": folder middleware is a middleware.ts file.`,
        'Rename it to "middleware.ts".',
      );
    }
    if (parts.length === 0) {
      return invalid(
        `"${fileName}" in the routes root: the app's middleware is src/middleware.ts.`,
        "Move it to src/middleware.ts, which runs for every request. A middleware.ts in a route folder runs for the pages, actions and endpoints of that folder.",
      );
    }
  } else if (kind !== "endpoint" && !PAGE_EXTENSIONS.includes(extension)) {
    return invalid(
      `"${fileName}" must be a component file.`,
      `Rename it to "${stem}.stsx" or "${stem}.tsx"${kind === "page" ? ', or to "route.ts" for an endpoint' : ""}.`,
    );
  }

  const segments: RouteSegment[] = [];
  for (const part of parts) {
    if (INTERCEPTING.test(part)) {
      return invalid(
        `Folder "${part}": Lumiose has no intercepting routes (a Next.js convention).`,
        "Rename the folder, or prefix it with _ to make it private.",
      );
    }
    if (part.startsWith("@")) {
      return invalid(
        `Folder "${part}": Lumiose has no parallel routes (@slot folders, a Next.js convention).`,
        "Rename the folder, or prefix it with _ to make it private.",
      );
    }
    if (GROUP.test(part)) continue;
    if (part.includes("(") || part.includes(")")) {
      return invalid(`Folder "${part}" is not a valid route group.`, 'Groups are named "(name)".');
    }
    const segment = parseSegment(part);
    if ("message" in segment) return segment;
    segments.push(segment);
  }

  const restIndex = segments.findIndex(isRest);
  if (restIndex !== -1 && restIndex !== segments.length - 1) {
    return invalid(
      `"${path}": a [...rest] or [[...rest]] segment must be the last segment of the URL.`,
      "Move the files after the rest segment up, or turn the rest segment into a [param].",
    );
  }
  const names = new Set<string>();
  for (const segment of segments) {
    if (segment.kind === "static") continue;
    if (names.has(segment.name)) {
      return invalid(
        `"${path}" uses the param "${segment.name}" twice.`,
        "Give each param a unique name.",
      );
    }
    names.add(segment.name);
  }

  return { status: "route", kind, dir: parts.join("/"), segments };
}

/** Renders segments as a Lumiose route pattern, e.g. `/blog/[slug]` or `/docs/[[...path]]`. */
export function formatPattern(segments: readonly RouteSegment[]): string {
  const parts = segments.map((segment) => {
    switch (segment.kind) {
      case "static":
        return segment.value;
      case "param":
        return `[${segment.name}]`;
      case "optional":
        return `[[${segment.name}]]`;
      case "rest":
        return `[...${segment.name}]`;
      case "optionalRest":
        return `[[...${segment.name}]]`;
    }
  });
  return `/${parts.join("/")}`;
}

/** Pattern with param names erased: two segment lists with the same key serve the same URLs. */
export function patternKey(segments: readonly RouteSegment[]): string {
  return formatPattern(
    segments.map((segment) =>
      segment.kind === "static" ? segment : { kind: segment.kind, name: "" },
    ),
  );
}

/**
 * The URL shapes of a route: every combination of its optional segments present or absent, as
 * plain segments (`[[lang]]` → `[lang]`, `[[...path]]` → `[...path]`), in match priority order.
 * Shapes serving the same URLs (`/[[a]]/[[b]]`) keep the first. A route without optional
 * segments has one shape, itself.
 */
export function routeVariants(segments: readonly RouteSegment[]): VariantSegment[][] {
  let variants: VariantSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.kind === "optional" || segment.kind === "optionalRest") {
      const present: VariantSegment = {
        kind: segment.kind === "optional" ? "param" : "rest",
        name: segment.name,
      };
      // Present first: on equal shapes, the earlier optional param takes the segment.
      variants = variants.flatMap((variant) => [[...variant, present], variant]);
    } else {
      variants = variants.map((variant) => [...variant, segment]);
    }
  }
  if (variants.length === 1) return variants;
  const keys = new Set<string>();
  return variants.toSorted(compareSegments).filter((variant) => {
    const key = patternKey(variant);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

const RANK = { static: 0, param: 1, optional: 2, rest: 3, optionalRest: 4 } as const;

/**
 * Orders segment lists by match priority: position by position, static beats [param] beats
 * [...rest], and ending beats a trailing rest. Ties fall back to the static values so the
 * order is total and deterministic. Lists with optional segments rank them after [param]; the
 * matcher compares their {@link routeVariants} instead.
 */
export function compareSegments(a: readonly RouteSegment[], b: readonly RouteSegment[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const rankA = a[i] === undefined ? -1 : RANK[a[i]!.kind];
    const rankB = b[i] === undefined ? -1 : RANK[b[i]!.kind];
    if (rankA !== rankB) return rankA - rankB;
  }
  const keyA = patternKey(a);
  const keyB = patternKey(b);
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
}

function isRest(segment: RouteSegment): boolean {
  return segment.kind === "rest" || segment.kind === "optionalRest";
}

function parseSegment(name: string): RouteSegment | InvalidRouteFile {
  const param = OPTIONAL_PARAM.exec(name) ?? PARAM.exec(name);
  if (param !== null) {
    const paramName = param[2] ?? "";
    if (!IDENTIFIER.test(paramName) || paramName === "__proto__") {
      return invalid(
        `"${name}": "${paramName}" is not a valid param name.`,
        "Param names must be JavaScript identifiers, for example [slug] or [...path].",
      );
    }
    const optional = name.startsWith("[[");
    if (param[1] === undefined) {
      return { kind: optional ? "optional" : "param", name: paramName };
    }
    return { kind: optional ? "optionalRest" : "rest", name: paramName };
  }
  if (name === "" || UNSAFE_STATIC.test(name)) {
    return invalid(
      `"${name}" is not a valid route segment.`,
      "A segment is either static text without spaces, brackets or URL delimiters, or exactly [param], [[param]], [...rest] or [[...rest]].",
    );
  }
  return { kind: "static", value: name };
}

function splitExtension(fileName: string): { stem: string; extension: string } | undefined {
  const extension = ROUTE_EXTENSIONS.find((ext) => fileName.endsWith(ext));
  if (extension === undefined) return undefined;
  return { stem: fileName.slice(0, -extension.length), extension };
}

function invalid(message: string, help?: string): InvalidRouteFile {
  return help === undefined ? { status: "invalid", message } : { status: "invalid", message, help };
}
