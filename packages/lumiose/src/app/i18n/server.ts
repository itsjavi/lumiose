// The locale APIs of `lumiose` on the server (decision-44): `locale()`, `alternates()` and the
// request-aware `href()`. ./browser.ts has the browser variants with the same names.

import { envHref, type HrefArgs } from "../routes/href.ts";
import type { Locale, Routes } from "../routes/registry.ts";
import { getRequestScope } from "../server/scope.ts";

/**
 * The request's locale with `lumiose({ i18n })`: the locale of its URL prefix (`/es/about` →
 * `"es"`), else the default locale. Undefined without `lumiose({ i18n })`.
 */
export function locale(): Locale {
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
 * `hreflang` links: empty without `lumiose({ i18n })`, outside a request, and when no route matched.
 */
export function alternates(): Array<{ locale: Locale; href: string }> {
  return (getRequestScope()?.i18n?.alternates ?? []) as Array<{ locale: Locale; href: string }>;
}

/** `href()` on the server: in the request's locale unless `params.locale` names another. */
export function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string {
  // In a request: the handler's base, trailing slashes and locales; elsewhere Vite's.
  const i18n = getRequestScope()?.i18n;
  if (i18n !== undefined) return i18n.href(pattern, (args[0] ?? {}) as Record<string, unknown>);
  return envHref(pattern, args[0], () => undefined);
}
