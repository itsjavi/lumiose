// Options of `lumiose({ … })` (decision-21): the compiler's own (`include`, `exclude`) and the
// project options the app layer reads from the plugin's `api.options` (`lumiose dev`, `lumiose build`,
// `lumiose routes`/`check`/typegen; app/project.ts). Validated when the plugin is created, so a
// typo or a wrong value fails the config load with a message instead of being ignored.

import type { HeaderRule, HeadersOption } from "lumiose/internal/app/headers.ts";
import { resolveI18n, type I18nOptions } from "lumiose/internal/app/i18n/config.ts";
import {
  DEFAULT_LIMITS,
  resolveLimits,
  type LimitsOption,
} from "lumiose/internal/app/server/body.ts";
import {
  resolveStreamTimeout,
  type StreamTimeoutOption,
} from "lumiose/internal/app/server/stream-timeout.ts";
import type { ProjectOptions } from "./app/project.ts";
import type { RouteMode } from "lumiose/internal/app/routes/manifest.ts";
import type { CsrfOptions } from "lumiose/internal/app/server/csrf.ts";
import type { TrailingSlash } from "lumiose/internal/app/server/handler.ts";
import type { MarkdownOptions } from "./content.ts";
import { isAdapter, type Adapter } from "./app/production/adapter.ts";
import type { Rollup } from "vite";
import type { SvgOptions } from "./svg.ts";

export type {
  Adapter,
  CsrfOptions,
  HeaderRule,
  HeadersOption,
  I18nOptions,
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
   * Whether spa routes that render on the server are prerendered at build time into HTML that
   * hydrates into the client router (decision-38), unless a layout or page sets
   * `export const prerender`.
   * Routes with params list their paths with `staticPaths()`. Default: `false`.
   *
   * @example lumiose({ mode: "spa", prerender: true }) // an SPA built as static, hydrating pages
   */
  prerender?: boolean;
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
   * `.svg?component` imports (`import Icon from "./icon.svg?component"`, from the project or a
   * package) as inline components, optimised with SVGO; every other `.svg` import is Vite's.
   * `false` leaves `?component` to Vite too (a URL).
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
  /**
   * How long a page render waits for its pending `<Suspense>` boundaries (decision-58), in
   * milliseconds or as `"30s"`, `"500ms"`, `"2m"`. Once it expires, async components still pending
   * fail with LUM5009 (the nearest `<ErrorBoundary>` renders its fallback), boundaries still
   * pending keep their fallback, and the response ends. `false` waits as long as the client stays.
   * Prerendering ignores it. Default: `"30s"`.
   */
  streamTimeout?: StreamTimeoutOption;
  /**
   * The deploy adapter (decision-45): after prerendering, `lumiose build` writes the platform's
   * output with it. `cloudflare()` from @lumiose/adapter-cloudflare, `vercel()` from
   * @lumiose/adapter-vercel, `netlify()` from @lumiose/adapter-netlify. Default: none, the Node
   * build that @lumiose/adapter-node, Bun and Deno serve.
   *
   * @example lumiose({ adapter: cloudflare() })
   */
  adapter?: Adapter;
  /**
   * Locale routing (decision-44): route files stay unprefixed, the router serves the default locale
   * at `/about` and every other locale under its prefix (`/es/about`). A page exists in the locales
   * it declares with `export const locales` (a list, `"all"` or a function of its params), or a
   * layout's; without one, only in the default locale. `missing`: a page requested in a locale it
   * does not declare is a `"404"` (default) or a `"redirect"` to the default locale's page.
   * `detect`: redirects to the visitor's locale on entry only (default `false`).
   *
   * @example lumiose({ i18n: { locales: ["en", "es"], defaultLocale: "en" } })
   */
  i18n?: I18nOptions;
  /**
   * The site's URL, `"https://example.com"` or with a path, `"https://example.com/docs"`: its origin
   * makes the absolute URLs that prerendered pages need, such as the `hreflang` and canonical links
   * of localized pages (pages rendered per request use the request's origin). A path is Vite's
   * `base`: it becomes the base when the config sets none, and must match it otherwise.
   */
  site?: string;
  /**
   * The in-page inspector of `lumiose dev` (decision-59): Alt+Shift+L or the corner button opens
   * it on every page (the component tree, signals, islands and why something updated), and
   * Alt+click opens an element's source in your editor. Dev only: builds contain none of it.
   * `false` removes it. Default: `true`.
   *
   * @example lumiose({ inspector: false })
   */
  inspector?: boolean;
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
  /**
   * Dev: whether client code reaches the scoped state `ref` (`<module>#<export>`), so pages send
   * it (decision-33): its module reaches an island module or one of `spaRoutes` (absolute files of
   * SPA pages and layouts) through the ssr module graph. True outside dev, where only such states
   * have an id. `lumiose dev` passes it to the renderer.
   */
  isClientState(ref: string, spaRoutes: ReadonlySet<string>): boolean;
}

const ROUTE_MODES: readonly RouteMode[] = ["static", "server", "spa"];
const TRAILING_SLASHES: readonly TrailingSlash[] = ["ignore", "always", "never"];
const PREFETCH = ["hover", "viewport", "none"] as const;
const KNOWN = [
  "include",
  "exclude",
  "mode",
  "ssr",
  "prerender",
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
  "streamTimeout",
  "adapter",
  "i18n",
  "site",
  "inspector",
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
  if (options.prerender !== undefined) {
    if (typeof options.prerender !== "boolean") {
      fail("prerender", `expected true or false, got ${describe(options.prerender)}`);
    }
    if (options.prerender && ssr === false) {
      fail(
        "prerender",
        "has no effect with ssr: false, which renders spa routes only in the browser. Remove one of them.",
      );
    }
    project.prerender = options.prerender;
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
  if (options.streamTimeout !== undefined) {
    try {
      resolveStreamTimeout(options.streamTimeout);
    } catch (error) {
      fail("streamTimeout", (error as Error).message.replace(/^streamTimeout: /, ""));
    }
    project.streamTimeout = options.streamTimeout;
  }
  if (options.adapter !== undefined) {
    if (!isAdapter(options.adapter)) {
      fail(
        "adapter",
        `expected an adapter such as cloudflare() from @lumiose/adapter-cloudflare, got ${describe(options.adapter)}`,
      );
    }
    project.adapter = options.adapter;
  }
  if (options.i18n !== undefined) {
    try {
      project.i18n = resolveI18n(options.i18n);
    } catch (error) {
      const [where, ...problem] = (error as Error).message.split(": ");
      fail(`i18n${where}`, problem.join(": "));
    }
  }
  if (options.site !== undefined) project.site = siteOf(options.site);
  if (options.inspector !== undefined) {
    if (typeof options.inspector !== "boolean") {
      fail("inspector", `expected true or false, got ${describe(options.inspector)}`);
    }
    project.inspector = options.inspector;
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

/** `lumiose({ site })` as its origin and path with a trailing slash: `https://example.com/docs/`. */
function siteOf(site: unknown): string {
  let url: URL | undefined;
  try {
    url = typeof site === "string" ? new URL(site) : undefined;
  } catch {
    url = undefined;
  }
  if (
    url === undefined ||
    originOf(url.href) === undefined ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    fail(
      "site",
      `expected the site's URL such as "https://example.com" or "https://example.com/docs", got ${describe(site)}`,
    );
  }
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return url.origin + path;
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
