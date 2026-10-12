// Locale routing (decision-44): the `lumiose({ i18n })` config and the URL rules every runtime
// shares. Route files stay unprefixed; the default locale is served without a prefix (`/about`),
// every other locale under its own (`/es/about`). Pure and runtime-agnostic: the manifest, the
// request handler, `href()` and the client router use it.

/** `lumiose({ i18n })`, as written in the Vite config. */
export interface I18nOptions {
  /** Every locale of the site, e.g. `["en", "es", "fr"]`: URL path segments such as `pt-BR`. */
  locales: readonly string[];
  /** The locale served without a prefix (`/about`); the others are prefixed (`/es/about`). */
  defaultLocale: string;
  /**
   * A page requested in a locale it does not declare: `"404"` (default) or `"redirect"` to the
   * default locale's page, when it exists there.
   */
  missing?: "404" | "redirect";
  /**
   * Locale detection, only on entry (default `false`): redirects to the visitor's locale on a first
   * visit (no `cookie`), and on `/` when the cookie names another locale. `cookie` is the cookie
   * that holds the visitor's locale; `acceptLanguage` reads the `Accept-Language` header.
   */
  detect?: false | { cookie?: string; acceptLanguage?: boolean };
}

/** The resolved config, with defaults. */
export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  missing: "404" | "redirect";
  detect: false | { cookie?: string; acceptLanguage: boolean };
}

/** The part of the config that builds URLs: what `href()` gets in every environment. */
export type I18nUrls = Pick<I18nConfig, "locales" | "defaultLocale">;

const LOCALE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Validates `lumiose({ i18n })` and fills in the defaults. Throws a `TypeError` whose message
 * starts with the option path (`locales: …`, `detect.cookie: …`).
 */
export function resolveI18n(options: unknown): I18nConfig {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError(": expected { locales, defaultLocale }");
  }
  const known = ["locales", "defaultLocale", "missing", "detect"];
  for (const key of Object.keys(options)) {
    if (!known.includes(key)) {
      throw new TypeError(`.${key}: unknown option. Known options: ${known.join(", ")}`);
    }
  }
  const { locales, defaultLocale, missing, detect } = options as Record<string, unknown>;
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new TypeError(`.locales: expected a non-empty array of locales such as ["en", "es"]`);
  }
  for (const locale of locales as unknown[]) {
    if (typeof locale !== "string" || !LOCALE.test(locale)) {
      throw new TypeError(
        `.locales: ${JSON.stringify(locale)} is not a locale: use a URL path segment such as "en" or "pt-BR"`,
      );
    }
  }
  if (new Set(locales).size !== locales.length) {
    throw new TypeError(".locales: each locale may appear once");
  }
  if (typeof defaultLocale !== "string" || !locales.includes(defaultLocale)) {
    throw new TypeError(
      `.defaultLocale: expected one of the locales (${locales.join(", ")}), got ${JSON.stringify(defaultLocale)}`,
    );
  }
  if (missing !== undefined && missing !== "404" && missing !== "redirect") {
    throw new TypeError(`.missing: expected "404" or "redirect", got ${JSON.stringify(missing)}`);
  }
  return {
    locales: [...(locales as string[])],
    defaultLocale,
    missing: missing ?? "404",
    detect: resolveDetect(detect),
  };
}

function resolveDetect(detect: unknown): I18nConfig["detect"] {
  if (detect === undefined || detect === false) return false;
  if (typeof detect !== "object" || detect === null || Array.isArray(detect)) {
    throw new TypeError(".detect: expected false or { cookie, acceptLanguage }");
  }
  for (const key of Object.keys(detect)) {
    if (key !== "cookie" && key !== "acceptLanguage") {
      throw new TypeError(`.detect.${key}: unknown option. Known options: cookie, acceptLanguage`);
    }
  }
  const { cookie, acceptLanguage } = detect as Record<string, unknown>;
  if (cookie !== undefined && (typeof cookie !== "string" || !COOKIE_NAME.test(cookie))) {
    throw new TypeError(`.detect.cookie: expected a cookie name, got ${JSON.stringify(cookie)}`);
  }
  if (acceptLanguage !== undefined && typeof acceptLanguage !== "boolean") {
    throw new TypeError(".detect.acceptLanguage: expected true or false");
  }
  if (cookie === undefined && acceptLanguage !== true) {
    throw new TypeError(".detect: detects nothing: set cookie, acceptLanguage: true, or both");
  }
  return {
    ...(cookie === undefined ? {} : { cookie: cookie as string }),
    acceptLanguage: acceptLanguage === true,
  };
}

/**
 * The locale of a pathname below `base` and the route path without its prefix: `/es/about` →
 * `es` and `/about`. A path without a locale prefix is in the default locale; the default
 * locale has no prefix (`/en/about` is not an English URL).
 */
export function splitLocale(pathname: string, i18n: I18nUrls): { locale: string; path: string } {
  const end = pathname.indexOf("/", 1);
  const first = end === -1 ? pathname.slice(1) : pathname.slice(1, end);
  if (first !== i18n.defaultLocale && i18n.locales.includes(first)) {
    return { locale: first, path: end === -1 ? "/" : pathname.slice(end) };
  }
  return { locale: i18n.defaultLocale, path: pathname };
}

/** A route path (below `base`) in `locale`: `/about` → `/es/about`; the default locale unchanged. */
export function localizePath(path: string, locale: string, i18n: I18nUrls): string {
  if (locale === i18n.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * The locale an `Accept-Language` header prefers among `locales`, or `undefined`: by quality,
 * an exact tag first (`es-MX`), then the same language (`es-MX` → `es`, `es` → `es-ES`).
 */
export function negotiateLocale(
  header: string | null,
  locales: readonly string[],
): string | undefined {
  if (header === null) return undefined;
  const ranges = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((param) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(param)?.[1]).find(Boolean);
      return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter((range) => range.tag !== "" && range.tag !== "*" && range.q > 0)
    .toSorted((a, b) => b.q - a.q || a.index - b.index);
  const lower = locales.map((locale) => locale.toLowerCase());
  for (const { tag } of ranges) {
    const exact = lower.indexOf(tag);
    if (exact !== -1) return locales[exact];
    const language = tag.split("-")[0]!;
    const same = lower.findIndex(
      (locale) => locale === language || locale.split("-")[0] === language,
    );
    if (same !== -1) return locales[same];
  }
  return undefined;
}
