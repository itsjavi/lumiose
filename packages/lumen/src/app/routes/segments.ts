// File-route naming conventions (spec §8): classifies a `src/routes`-relative path and
// parses it into URL segments. Pure and runtime-agnostic.

export type RouteSegment =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "rest"; name: string };

export type RouteFileKind = "page" | "endpoint" | "layout" | "notFound" | "error";

export interface RouteFile {
  status: "route";
  kind: RouteFileKind;
  /** Routes-relative POSIX directory of the file ("" for the routes root). */
  dir: string;
  /**
   * URL segments. For pages and endpoints, the route itself; for `_layout`, `_404` and
   * `_error`, the URL scope of their directory.
   */
  segments: RouteSegment[];
}

export interface InvalidRouteFile {
  status: "invalid";
  message: string;
  help?: string;
}

export interface IgnoredRouteFile {
  status: "ignored";
}

export type ClassifiedRouteFile = RouteFile | InvalidRouteFile | IgnoredRouteFile;

const PAGE_EXTENSIONS = [".stsx", ".tsx"] as const;
const ENDPOINT_EXTENSION = ".ts";
const SPECIAL_FILES: Record<string, RouteFileKind> = {
  _layout: "layout",
  _404: "notFound",
  _error: "error",
};
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const GROUP = /^\(([^()]+)\)$/;
const PARAM = /^\[(\.\.\.)?([^[\]]*)\]$/;
const UNSAFE_STATIC = /[\s?#%\\{}<>|^"`[\]()]/;

/** Whether a file name could be a route module (cheap pre-filter before reading it). */
export function isRouteModuleCandidate(fileName: string): boolean {
  return splitExtension(fileName) !== undefined;
}

/** Classifies a `src/routes`-relative POSIX path. */
export function classifyRouteFile(path: string): ClassifiedRouteFile {
  const parts = path.split("/");
  const fileName = parts.pop() ?? "";
  if (parts.some((part) => part.startsWith("."))) return { status: "ignored" };
  const split = splitExtension(fileName);
  if (split === undefined) return { status: "ignored" };
  const { stem, extension } = split;
  const isPage = extension !== ENDPOINT_EXTENSION;

  const segments: RouteSegment[] = [];
  for (const part of parts) {
    if (GROUP.test(part)) continue;
    if (part.includes("(") || part.includes(")")) {
      return invalid(`Folder "${part}" is not a valid route group.`, 'Groups are named "(name)".');
    }
    const segment = parseSegment(part);
    if ("message" in segment) return segment;
    segments.push(segment);
  }

  let kind: RouteFileKind;
  if (stem.startsWith("_")) {
    const special = SPECIAL_FILES[stem];
    if (special === undefined) {
      return invalid(
        `"${fileName}" is not a route file: only _layout, _404 and _error may start with "_".`,
        "Move shared modules out of src/routes (for example to src/lib or src/components).",
      );
    }
    if (!isPage) {
      return invalid(
        `"${fileName}" must be a page file.`,
        `Rename it to "${stem}.stsx" or "${stem}.tsx".`,
      );
    }
    kind = special;
  } else {
    kind = isPage ? "page" : "endpoint";
    if (GROUP.test(stem)) {
      return invalid(
        `"${fileName}": route groups must be folders.`,
        `Use "${stem}/index${extension}".`,
      );
    }
    if (stem !== "index") {
      const segment = parseSegment(stem);
      if ("message" in segment) return segment;
      segments.push(segment);
    }
  }

  const restIndex = segments.findIndex((segment) => segment.kind === "rest");
  if (restIndex !== -1 && restIndex !== segments.length - 1) {
    return invalid(
      `"${path}": a [...rest] segment must be the last segment of the URL.`,
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

/** Renders segments as a Lumen route pattern, e.g. `/blog/[slug]`. */
export function formatPattern(segments: readonly RouteSegment[]): string {
  const parts = segments.map((segment) => {
    if (segment.kind === "static") return segment.value;
    return segment.kind === "param" ? `[${segment.name}]` : `[...${segment.name}]`;
  });
  return `/${parts.join("/")}`;
}

/** Pattern with param names erased: two routes with the same key serve the same URLs. */
export function patternKey(segments: readonly RouteSegment[]): string {
  return `/${segments.map((segment) => (segment.kind === "static" ? segment.value : segment.kind === "param" ? "[]" : "[...]")).join("/")}`;
}

const RANK = { static: 0, param: 1, rest: 2 } as const;

/**
 * Orders segment lists by match priority: position by position, static beats [param] beats
 * [...rest], and ending beats a trailing rest. Ties fall back to the static values so the
 * order is total and deterministic.
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

function parseSegment(name: string): RouteSegment | InvalidRouteFile {
  if (name.startsWith("[[")) {
    return invalid(
      `"${name}": optional params are not supported.`,
      "Use a [...rest] segment, which also matches nothing.",
    );
  }
  const param = PARAM.exec(name);
  if (param !== null) {
    const paramName = param[2] ?? "";
    if (!IDENTIFIER.test(paramName) || paramName === "__proto__") {
      return invalid(
        `"${name}": "${paramName}" is not a valid param name.`,
        "Param names must be JavaScript identifiers, for example [slug] or [...path].",
      );
    }
    return param[1] === undefined
      ? { kind: "param", name: paramName }
      : { kind: "rest", name: paramName };
  }
  if (name === "" || UNSAFE_STATIC.test(name)) {
    return invalid(
      `"${name}" is not a valid route segment.`,
      "A segment is either static text without spaces, brackets or URL delimiters, or exactly [param] or [...rest].",
    );
  }
  return { kind: "static", value: name };
}

function splitExtension(fileName: string): { stem: string; extension: string } | undefined {
  if (fileName.startsWith(".") || fileName.endsWith(".d.ts")) return undefined;
  const extension = [...PAGE_EXTENSIONS, ENDPOINT_EXTENSION].find((ext) => fileName.endsWith(ext));
  if (extension === undefined) return undefined;
  const stem = fileName.slice(0, -extension.length);
  if (/\.(test|spec)$/.test(stem)) return undefined;
  return { stem, extension };
}

function invalid(message: string, help?: string): InvalidRouteFile {
  return help === undefined ? { status: "invalid", message } : { status: "invalid", message, help };
}
