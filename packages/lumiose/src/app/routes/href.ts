// Typed link builder: `href("/blog/[slug]", { slug })` → "/blog/hello-world", below Vite's `base`,
// in the form of the project's `trailingSlash` policy, and in the current locale with
// `lumiose({ i18n })` (`{ locale }` switches it, decision-44).
//
// Vite fills them in in every environment: `lumiose` is never external or pre-bundled
// (@lumiose/vite), so server and client code alike see `import.meta.env.BASE_URL`,
// `import.meta.env.LUMIOSE_TRAILING_SLASH` (defined by `lumiose dev` and `lumiose build` from
// `lumiose({ trailingSlash })`) and `__LUMIOSE_I18N__` (defined by the `lumiose` plugin from
// `lumiose({ i18n })`). Outside Vite they are unset: paths stay root-relative and unlocalized.
//
// The locales are a global define, not an `import.meta.env` one: Vitest turns `import.meta.env.*`
// defines into `process.env` entries, strings shared by every project of a workspace, while it
// sets global defines per project, as values.

import { localizePath, splitLocale, type I18nUrls } from "../i18n/config.ts";
import type { Locale, LocaleMap, RouteParams, Routes } from "./registry.ts";

declare global {
  interface ImportMetaEnv {
    BASE_URL: string;
    /** `lumiose({ trailingSlash })`, for `href()`. Defined by `lumiose dev` and `lumiose build`. */
    LUMIOSE_TRAILING_SLASH?: "ignore" | "always" | "never";
  }
  /** The locales of `lumiose({ i18n })`, for `href()` and `lumiose/router`; see the module comment. */
  // oxlint-disable-next-line no-underscore-dangle -- a define, named like Vite's and Vitest's
  var __LUMIOSE_I18N__: unknown;
}

/** The `define` that carries `trailingSlash` to `href()`; see the module comment. */
export const TRAILING_SLASH_DEFINE = "import.meta.env.LUMIOSE_TRAILING_SLASH";
/** The `define` that carries the locales of `lumiose({ i18n })` to `href()`. */
export const I18N_DEFINE = "__LUMIOSE_I18N__";

/**
 * The locales of `lumiose({ i18n })` from the `__LUMIOSE_I18N__` define, or `undefined` when it is
 * not defined or not a locale config.
 */
export function envI18n(): I18nUrls | undefined {
  const value = typeof __LUMIOSE_I18N__ === "undefined" ? undefined : __LUMIOSE_I18N__;
  return isI18nUrls(value) ? value : undefined;
}

function isI18nUrls(value: unknown): value is I18nUrls {
  if (typeof value !== "object" || value === null) return false;
  const { locales, defaultLocale } = value as Partial<I18nUrls>;
  return (
    Array.isArray(locales) &&
    locales.every((locale) => typeof locale === "string") &&
    typeof defaultLocale === "string" &&
    locales.includes(defaultLocale)
  );
}

/** With `lumiose({ i18n })`, `locale` picks the locale of the URL; it is no route param. */
type LocaleKey = [keyof LocaleMap] extends [never] ? {} : { locale?: Locale | undefined };

/** The params argument: required when the route has params, otherwise optional. */
export type HrefArgs<P extends Routes> =
  {} extends RouteParams<P>
    ? [params?: RouteParams<P> & LocaleKey]
    : [params: RouteParams<P> & LocaleKey];

/**
 * Builds the URL path of a route from its pattern, encoding each param: below Vite's `base`, with
 * a trailing slash when `trailingSlash` is `"always"`, and with `lumiose({ i18n })` in the current
 * locale (the URL's in the browser, the request's on the server), or in `params.locale`. A
 * `[...rest]` param keeps its "/" separators; an optional `[[param]]` or `[[...rest]]` that is
 * missing or empty leaves its segment out. Throws on a missing or empty `[param]` or `[...rest]`,
 * on an unknown `locale`, and on a `.` or `..` segment, which a browser would resolve into another
 * path (TASK-165).
 */
export function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string {
  return envHref(pattern, args[0], browserLocale);
}

/**
 * `href()` with Vite's `base`, `trailingSlash` and locales from `import.meta.env`; `current` is the
 * current locale given the locales and the base (undefined: the default locale).
 */
export function envHref(
  pattern: string,
  params: object | undefined,
  current: (i18n: I18nUrls, base: string) => string | undefined,
): string {
  const base = normalizeBase(import.meta.env?.BASE_URL ?? "/");
  const i18n = envI18n();
  return routeHref(pattern, (params ?? {}) as Record<string, unknown>, {
    base,
    trailingSlash: import.meta.env?.LUMIOSE_TRAILING_SLASH,
    ...(i18n === undefined ? {} : { i18n, locale: current(i18n, base) }),
  });
}

export interface RouteHrefOptions {
  /** Vite's `base`, normalized (`normalizeBase`). */
  base: string;
  trailingSlash?: "ignore" | "always" | "never" | undefined;
  /** The locales of `lumiose({ i18n })`: `params.locale` is then the URL's locale, not a param. */
  i18n?: I18nUrls;
  /** The locale when `params` has none (default: the default locale). */
  locale?: string | undefined;
}

/** The URL path of a route below `base` (see `href()`), with explicit options. */
export function routeHref(
  pattern: string,
  params: Record<string, unknown>,
  options: RouteHrefOptions,
): string {
  const { i18n } = options;
  let path: string;
  if (i18n === undefined) {
    path = fillPattern(pattern, params);
  } else {
    const { locale: requested, ...rest } = params;
    const locale = requested ?? options.locale ?? i18n.defaultLocale;
    if (typeof locale !== "string" || !i18n.locales.includes(locale)) {
      throw new TypeError(
        `href("${pattern}"): ${JSON.stringify(locale)} is not a locale of lumiose({ i18n }) (${i18n.locales.join(", ")}).`,
      );
    }
    path = localizePath(fillPattern(pattern, rest), locale, i18n);
  }
  const slash = options.trailingSlash === "always" && !isFilePattern(pattern);
  return appPath(path, options.base, slash);
}

/** The locale of the browser's URL, if any. */
function browserLocale(i18n: I18nUrls, base: string): string | undefined {
  if (typeof location === "undefined") return undefined;
  const path = pathBelowBase(location.pathname, base);
  return path === undefined ? undefined : splitLocale(path, i18n).locale;
}

/** A pathname below `base` (with leading and trailing slashes), starting with "/"; `undefined` outside it. */
export function pathBelowBase(pathname: string, base: string): string | undefined {
  if (base === "/") return pathname;
  if (pathname === base.slice(0, -1)) return "/";
  return pathname.startsWith(base) ? pathname.slice(base.length - 1) : undefined;
}

/** The path of a route below the base: the pattern with its params filled in, no trailing slash. */
export function fillPattern(pattern: string, params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const segment of pattern.split("/")) {
    if (segment === "") continue;
    if (!segment.startsWith("[") || !segment.endsWith("]")) {
      parts.push(segment);
      continue;
    }
    const optional = segment.startsWith("[[");
    const inner = optional ? segment.slice(2, -2) : segment.slice(1, -1);
    const rest = inner.startsWith("...");
    const name = rest ? inner.slice(3) : inner;
    const value = params[name];
    const text = value === undefined || value === null ? "" : String(value);
    const pieces = rest ? text.split("/").filter((part) => part !== "") : [text];
    if (pieces.length === 0 || pieces[0] === "") {
      if (optional) continue;
      throw new TypeError(`href("${pattern}"): missing value for param "${name}".`);
    }
    for (const piece of pieces) {
      // encodeURIComponent keeps dots: `..` would climb out of the route once resolved.
      if (piece === "." || piece === "..") {
        throw new TypeError(`href("${pattern}"): param "${name}" cannot be "${piece}".`);
      }
      parts.push(encodeURIComponent(piece));
    }
  }
  return `/${parts.join("/")}`;
}

/**
 * `path` (below the base, from `fillPattern`) as a URL path of the app. The root is the base
 * itself ("/docs/"); `slash` adds the trailing slash of `trailingSlash: "always"` to other paths.
 */
export function appPath(path: string, base: string, slash: boolean): string {
  if (path === "/") return base;
  return base + path.slice(1) + (slash ? "/" : "");
}

/** Vite's `base` as a path with leading and trailing slashes; a relative base counts as "/". */
export function normalizeBase(base: string): string {
  let path = /^[a-z][a-z\d+.-]*:\/\//i.test(base) ? new URL(base).pathname : base;
  if (path === "" || path === "./") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Whether a pattern names a file (`/feed.xml`): an endpoint, whose URL takes no trailing slash. A
 * dot in the last segment, outside a param (`[...path]`), marks one.
 */
function isFilePattern(pattern: string): boolean {
  const last = pattern.slice(pattern.lastIndexOf("/") + 1);
  return last.replace(/\[\[?[^\]]*\]\]?/g, "").includes(".");
}
