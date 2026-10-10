// Options of `lumiose({ … })` (decision-21): the compiler's own (`include`, `exclude`) and the
// project options the app layer reads from the plugin's `api.options` (`lumiose dev`, `lumiose build`,
// `lumiose routes`/`check`/typegen; app/project.ts). Validated when the plugin is created, so a
// typo or a wrong value fails the config load with a message instead of being ignored.

import type { HeaderRule, HeadersOption } from "../app/headers.ts";
import { DEFAULT_LIMITS, resolveLimits, type LimitsOption } from "../app/server/body.ts";
import type { ProjectOptions } from "../app/project.ts";
import type { RouteMode } from "../app/routes/manifest.ts";
import type { CsrfOptions } from "../app/server/csrf.ts";
import type { TrailingSlash } from "../app/server/handler.ts";
import type { MarkdownOptions } from "./content.ts";
import type { Rollup } from "vite";
import type { SvgOptions } from "./svg.ts";

export type {
  CsrfOptions,
  HeaderRule,
  HeadersOption,
  MarkdownOptions,
  ProjectOptions,
  RouteMode,
  SvgOptions,
  TrailingSlash,
};

export interface LumioseOptions {
  /** Modules compiled by Lumiose. Default: `.stsx` and `.tsx` files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
  /**
   * The project's default route mode: `"static"` (prerendered at build time), `"server"`
   * (rendered per request) or `"spa"` (client-rendered with the client router). A layout's or
   * route's `export const mode` overrides it. Default: `"static"`.
   *
   * @example lumiose({ mode: "spa", ssr: false }) // a client-rendered SPA, built as static files
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
   * `.svg` imports (`import Icon from "./icon.svg"`) as inline components, optimised with SVGO;
   * `?url` and `?raw` keep Vite's behaviour. `false` leaves `.svg` imports to Vite (a URL).
   * Default: `true` (`{ optimize: true, currentColor: false }`).
   */
  svg?: boolean | SvgOptions;
  /**
   * `.md` imports as components (`import Post, { frontmatter } from "./post.md"`): CommonMark and
   * GFM compiled at build time, with heading ids; the YAML frontmatter is exported as data, which
   * `{ frontmatter(data, { file }) }` can validate or transform. Default: `false`.
   */
  md?: boolean | MarkdownOptions;
  /**
   * `.html` imports as components (`import Card from "./card.html"`): a full document contributes
   * its `<body>` content; `<script>` elements run as client modules wherever the component
   * renders, and top-level `<style>` elements are scoped to the file. Default: `false`.
   */
  html?: boolean;
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
  /**
   * A strict Content Security Policy (spec §7.4): pages rendered per request get a nonce on every
   * inline script and style Lumiose writes and on those written in JSX (an explicit `nonce` wins),
   * `cspNonce()` for markup the app builds itself, and a `Content-Security-Policy` header
   * (`script-src 'nonce-…' 'strict-dynamic'`); prerendered pages get the same policy with hashes in
   * a `<meta>`. `style` props and static `style` strings render as nonce'd rules instead of
   * `style` attributes. A policy set by `setHeader`, middleware or `headers` replaces it. Default: off.
   *
   * @example lumiose({ csp: "strict" })
   */
  csp?: "strict";
  /**
   * Response headers, declared once: a record for every response, or `{ path, headers }` rules
   * for the paths that match (below `base`; `*` is one segment, `**` any depth; later rules win).
   * `lumiose dev`, `lumiose preview` and @lumiose/adapter-node send them, and `lumiose build` writes
   * `dist/client/_headers` for static hosts. Headers set by middleware, endpoints or `setHeader`
   * win.
   *
   * @example lumiose({ headers: { "cross-origin-opener-policy": "same-origin" } })
   * @example lumiose({ headers: [{ path: "/admin/**", headers: { "x-robots-tag": "noindex" } }] })
   */
  headers?: HeadersOption;
  /**
   * Request body limits (decision-29): `body` for URL-encoded forms, JSON and other bodies,
   * `upload` for multipart bodies, in bytes or as `"512kb"`, `"1mb"`. Larger requests get 413. A
   * route's `export const limits` overrides them for its requests.
   * Default: `{ body: "1mb", upload: "10mb" }`.
   */
  limits?: LimitsOption;
}

/** The `api` of the `lumiose` plugin, read by the app layer (app/project.ts `projectOptions`). */
export interface LumiosePluginApi {
  /** The project options given to `lumiose({ … })`; unset options are absent. */
  readonly options: Readonly<ProjectOptions>;
  /**
   * The island modules known so far: the module of each island ref (`/src/Nav.stsx`,
   * `@acme/ui/src/Nav.stsx` or a bare `@acme/ui`) → the specifier the island manifest imports it
   * with (root-relative, an absolute id, or bare). `lumiose build` and `lumiose dev` map refs to URLs
   * with it.
   */
  islandModules(): ReadonlyMap<string, string>;
  /**
   * In the server build's `renderChunk`: project-relative module → the client URLs of the
   * stylesheets it reaches, as `virtual:lumiose/css-manifest` holds them. `lumiose build` groups each
   * page's stylesheets with it.
   */
  cssManifest(context: Rollup.PluginContext): Readonly<Record<string, readonly string[]>>;
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
  "md",
  "html",
  "viewTransitions",
  "prefetch",
  "csp",
  "headers",
  "limits",
];

/** Validates `lumiose({ … })` options and returns the project options; throws a `TypeError`. */
export function projectOptionsOf(options: LumioseOptions): ProjectOptions {
  if (typeof options !== "object" || options === null) {
    fail("", `expected an options object, got ${describe(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (!KNOWN.includes(key)) {
      fail(key, `unknown option. Known options: ${KNOWN.join(", ")}`);
    }
  }
  const { include, exclude, mode, ssr, trailingSlash, csrf, viewTransitions, prefetch, headers } =
    options;
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
  if (options.csp !== undefined) project.csp = oneOf("csp", options.csp, ["strict"] as const);
  if (headers !== undefined) project.headers = headersOption(headers);
  if (options.limits !== undefined) {
    try {
      resolveLimits(options.limits, DEFAULT_LIMITS, "limits");
    } catch (error) {
      fail("limits", (error as Error).message.replace(/^limits(?:\.\w+)?: /, ""));
    }
    project.limits = options.limits;
  }
  return project;
}

function headersOption(headers: unknown): HeadersOption {
  if (Array.isArray(headers)) {
    return headers.map((rule: unknown, i): HeaderRule => {
      const where = `headers[${i}]`;
      if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
        fail(where, `expected { path, headers }, got ${describe(rule)}`);
      }
      for (const key of Object.keys(rule)) {
        if (key !== "path" && key !== "headers") {
          fail(`${where}.${key}`, "unknown option. Known options: path, headers");
        }
      }
      const { path, headers: values } = rule as { path?: unknown; headers?: unknown };
      if (typeof path !== "string" || !path.startsWith("/")) {
        fail(
          `${where}.path`,
          `expected a path pattern such as "/assets/**", got ${describe(path)}`,
        );
      }
      return { path, headers: headerRecord(`${where}.headers`, values) };
    });
  }
  return headerRecord("headers", headers);
}

function headerRecord(option: string, value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(option, `expected a record of header names to values, got ${describe(value)}`);
  }
  for (const [name, header] of Object.entries(value)) {
    if (typeof header !== "string") {
      fail(`${option}.${name}`, `expected a string, got ${describe(header)}`);
    }
  }
  return { ...(value as Record<string, string>) };
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
  const where = option === "" ? "lumiose()" : `lumiose({ ${option} })`;
  throw new TypeError(`${where}: ${problem}.`);
}
