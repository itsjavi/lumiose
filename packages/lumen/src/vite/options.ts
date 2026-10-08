// Options of `lumen({ … })` (decision-21): the compiler's own (`include`, `exclude`) and the
// project options the app layer reads from the plugin's `api.options` (`lumen dev`, `lumen build`,
// `lumen routes`/`check`/typegen; app/project.ts). Validated when the plugin is created, so a
// typo or a wrong value fails the config load with a message instead of being ignored.

import type { ProjectOptions } from "../app/project.ts";
import type { RouteMode } from "../app/routes/manifest.ts";
import type { CsrfOptions } from "../app/server/csrf.ts";
import type { TrailingSlash } from "../app/server/handler.ts";
import type { SvgOptions } from "./svg.ts";

export type { CsrfOptions, ProjectOptions, RouteMode, SvgOptions, TrailingSlash };

export interface LumenOptions {
  /** Modules compiled by Lumen. Default: `.stsx` and `.tsx` files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
  /**
   * The project's default route mode: `"static"` (prerendered at build time), `"server"`
   * (rendered per request) or `"spa"` (client-rendered with the client router). A layout's or
   * route's `export const mode` overrides it. Default: `"static"`.
   *
   * @example lumen({ mode: "spa", ssr: false }) // a client-rendered SPA, built as static files
   */
  mode?: RouteMode;
  /**
   * Whether spa routes render their content on the server (`true`) or only the document shell
   * (`false`), unless a layout or route sets `export const ssr`. Only spa routes use it.
   * Default: `true`.
   */
  ssr?: boolean;
  /**
   * Trailing slashes of page URLs (and prerendered file names): `"ignore"` serves both forms,
   * `"always"` and `"never"` redirect to the canonical one. Default: `"ignore"`.
   */
  trailingSlash?: TrailingSlash;
  /**
   * The origin check of form actions and of form-like posts to endpoints (on by default).
   * `{ allowedOrigins }` also accepts cross-site posts from those full origins
   * (`"https://app.example.com"`); `false` turns the check off.
   */
  csrf?: false | CsrfOptions;
  /**
   * `.svg` imports (`import Icon from "./icon.svg"`) as inline components, optimised with OXVG;
   * `?url` and `?raw` keep Vite's behaviour. `false` leaves `.svg` imports to Vite (a URL).
   * Default: `true` (`{ optimize: true, currentColor: false }`).
   */
  svg?: boolean | SvgOptions;
  /**
   * Cross-document View Transitions between MPA pages: page documents opt in with
   * `@view-transition { navigation: auto }`, unless the reader prefers reduced motion. Name the
   * elements that morph with the CSS `view-transition-name`. Default: `false`.
   */
  viewTransitions?: boolean;
  /**
   * Prefetch of same-origin links on MPA pages, with generated speculation rules: `"hover"`
   * (when the pointer rests on a link), `"viewport"` (early, as the browser sees fit) or `"none"`.
   * In `spa` routes, `<Link prefetch>` decides per link. Default: `"hover"`.
   */
  prefetch?: "hover" | "viewport" | "none";
}

/** The `api` of the `lumen` plugin, read by the app layer (app/project.ts `projectOptions`). */
export interface LumenPluginApi {
  /** The project options given to `lumen({ … })`; unset options are absent. */
  readonly options: Readonly<ProjectOptions>;
}

const ROUTE_MODES: readonly RouteMode[] = ["static", "server", "spa"];
const TRAILING_SLASHES: readonly TrailingSlash[] = ["ignore", "always", "never"];
const PREFETCH = ["hover", "viewport", "none"] as const;
const KNOWN = [
  "include",
  "exclude",
  "mode",
  "ssr",
  "trailingSlash",
  "csrf",
  "svg",
  "viewTransitions",
  "prefetch",
];

/** Validates `lumen({ … })` options and returns the project options; throws a `TypeError`. */
export function projectOptionsOf(options: LumenOptions): ProjectOptions {
  if (typeof options !== "object" || options === null) {
    fail("", `expected an options object, got ${describe(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (!KNOWN.includes(key)) {
      fail(key, `unknown option. Known options: ${KNOWN.join(", ")}`);
    }
  }
  const { include, exclude, mode, ssr, trailingSlash, csrf, viewTransitions, prefetch } = options;
  if (include !== undefined && !(include instanceof RegExp)) {
    fail("include", `expected a RegExp, got ${describe(include)}`);
  }
  if (exclude !== undefined && !(exclude instanceof RegExp)) {
    fail("exclude", `expected a RegExp, got ${describe(exclude)}`);
  }
  const project: ProjectOptions = {};
  if (mode !== undefined) project.mode = oneOf("mode", mode, ROUTE_MODES);
  if (ssr !== undefined) {
    if (typeof ssr !== "boolean") fail("ssr", `expected true or false, got ${describe(ssr)}`);
    project.ssr = ssr;
  }
  if (trailingSlash !== undefined) {
    project.trailingSlash = oneOf("trailingSlash", trailingSlash, TRAILING_SLASHES);
  }
  if (csrf !== undefined) project.csrf = csrfOptions(csrf);
  if (viewTransitions !== undefined) {
    if (typeof viewTransitions !== "boolean") {
      fail("viewTransitions", `expected true or false, got ${describe(viewTransitions)}`);
    }
    project.viewTransitions = viewTransitions;
  }
  if (prefetch !== undefined) project.prefetch = oneOf("prefetch", prefetch, PREFETCH);
  return project;
}

function csrfOptions(csrf: unknown): false | CsrfOptions {
  if (csrf === false) return false;
  if (typeof csrf !== "object" || csrf === null || Array.isArray(csrf)) {
    fail("csrf", `expected false or { allowedOrigins }, got ${describe(csrf)}`);
  }
  for (const key of Object.keys(csrf)) {
    if (key !== "allowedOrigins")
      fail(`csrf.${key}`, "unknown option. Known options: allowedOrigins");
  }
  const { allowedOrigins } = csrf as CsrfOptions;
  if (allowedOrigins === undefined) return {};
  if (!Array.isArray(allowedOrigins)) {
    fail("csrf.allowedOrigins", `expected an array of origins, got ${describe(allowedOrigins)}`);
  }
  for (const origin of allowedOrigins as unknown[]) {
    // Compared verbatim with the `Origin` header: scheme, host and port, nothing else.
    if (typeof origin !== "string" || originOf(origin) !== origin) {
      fail(
        "csrf.allowedOrigins",
        `expected full origins such as "https://app.example.com" (no path or trailing slash), got ${describe(origin)}`,
      );
    }
  }
  return { allowedOrigins: [...allowedOrigins] };
}

function originOf(value: string): string | undefined {
  try {
    const { origin } = new URL(value);
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  const expected = allowed.map((item) => JSON.stringify(item)).join(", ");
  return fail(name, `expected one of ${expected}, got ${describe(value)}`);
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof RegExp) return String(value);
  if (Array.isArray(value)) return "an array";
  if (value === null || typeof value !== "object") return String(value);
  return "an object";
}

function fail(option: string, problem: string): never {
  const where = option === "" ? "lumen()" : `lumen({ ${option} })`;
  throw new TypeError(`${where}: ${problem}.`);
}
