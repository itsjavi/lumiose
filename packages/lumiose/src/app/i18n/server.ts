// The locale APIs of `lumiose` on the server (decision-44): `locale()`, `alternates()` and the
// request-aware `href()`. ./browser.ts has the browser variants with the same names.

import { envHref, type AlternatesArgs, type HrefArgs } from "../routes/href.ts";
import type { CurrentLocale, Locale, Routes } from "../routes/registry.ts";
import { getRequestScope } from "../server/scope.ts";

/**
 * The request's locale with `lumiose({ i18n })`: the locale of its URL prefix (`/es/about` →
 * `"es"`), else the default locale. Undefined without `lumiose({ i18n })`.
 */
export function locale(): CurrentLocale {
  const scope = getRequestScope();
  if (scope === undefined) {
    throw new Error(
      "locale() can only be called while handling a request: in middleware, endpoints or server components.",
    );
  }
  return scope.i18n?.locale as Locale;
}

/**
 * The current page in every locale it declares, `[{ locale, href }]`, for language switchers and
 * `hreflang` links. With a route pattern (and its params), that route in every locale it declares,
 * for links to a page translated into fewer locales: `alternates("/about")`. Empty without
 * `lumiose({ i18n })`, outside a request, and, without a pattern, when no route matched. Throws for
 * an unknown pattern and for a route that declares its locales with a `locales()` function.
 */
export function alternates(): Array<{ locale: Locale; href: string }>;
export function alternates<P extends Routes>(
  pattern: P,
  ...args: AlternatesArgs<P>
): Array<{ locale: Locale; href: string }>;
export function alternates(
  pattern?: string,
  params?: unknown,
): Array<{ locale: Locale; href: string }> {
  const i18n = getRequestScope()?.i18n;
  if (i18n === undefined) return [];
  const list =
    pattern === undefined
      ? i18n.alternates
      : i18n.routeAlternates(pattern, (params ?? {}) as Record<string, unknown>);
  return list as Array<{ locale: Locale; href: string }>;
}

/** `href()` on the server: in the request's locale unless `params.locale` names another. */
export function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string {
  // In a request: the handler's base, trailing slashes and locales; elsewhere Vite's.
  const i18n = getRequestScope()?.i18n;
  if (i18n !== undefined) return i18n.href(pattern, (args[0] ?? {}) as Record<string, unknown>);
  return envHref(pattern, args[0], () => undefined);
}
