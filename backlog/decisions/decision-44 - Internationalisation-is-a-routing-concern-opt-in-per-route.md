---
id: decision-44
title: 'Internationalisation is a routing concern, opt-in per route'
date: '2026-10-12 18:38'
status: accepted
---
## Context

Locale-aware routing and link building are hard in Next.js and React Router: every route moves under a `[locale]` folder, and building localized links is left to the app. The user wants this to be first-class in Lumiose, without automatic behavior that hurts real sites: many sites translate only some pages, and search engines penalize duplicate alternate URLs.

## Decision

Agreed with the user on 2026-10-12. The exact configuration and API names go through the user before implementation.

- **The router handles the locale prefix.** Route files stay unprefixed: `about/page.stsx` serves `/about`, `/es/about` and `/fr/about`, and the request exposes the locale. No `[locale]` folder, no optional segment.
- **Pages opt in to translations.** A route declares the locales it exists in (a static list, or a function for content-driven pages such as a blog post translated into some languages). Without a declaration, a page exists only in the default locale.
- **No automatic duplicates.** `hreflang` alternates are written only for declared locales, each locale has its own canonical URL, and a missing translation is a 404 or a redirect to the default locale, as the site chooses. A default-locale page is never served under another locale's prefix.
- **Detection is opt-in and only on entry**: redirecting from `Accept-Language` or a cookie happens on `/` or a first visit when enabled, never on every request.
- **`href()` knows the locale**: it keeps the current locale by default and switches with an option; the types come from the declared locales. The document's `<html lang>` follows the request's locale.
- **Translation stays in libraries.** Lumiose does not format messages. The guide shows Paraglide JS (compile-time messages that load only what a page uses) and i18next end to end.

### Configuration and API (approved by the user on 2026-10-12)

```ts
// vite.config.ts
lumiose({
  i18n: {
    locales: ["en", "es", "fr"],
    defaultLocale: "en",  // served unprefixed (/about); the others are prefixed (/es/about)
    missing: "404",       // or "redirect" to the default locale's page; site-wide
    detect: false,        // or { cookie: "locale", acceptLanguage: true }: only on "/" or a first visit
  },
});
```

```ts
// src/routes/about/page.stsx: the page exists in these locales; without the export, only in "en"
export const locales = ["en", "es"]; // or "all"

// src/routes/blog/[slug]/page.stsx: content-driven
export async function locales({ params }) {
  return (await getPost(params.slug)).translations;
}
```

- A layout's `locales` export applies to every page below it; a page's own export wins.
- `locale()` from `lumiose` reads the request's locale on the server (like `params()`); `ctx.locale` in middleware, actions and endpoints; a reactive `locale()` in `lumiose/router`. `Locale` is a type generated from the config.
- `href("/about")` keeps the current locale; `href("/blog/[slug]", { slug, locale: "es" })` switches it. `locale` is a reserved key: a route param named `locale` is a diagnostic.
- `alternates()` returns `[{ locale, href }]` for the current page's declared locales; the `hreflang` links and language switchers use it.
- Locale per domain (`example.es`) is post-1.0.
- Approved by the user later on 2026-10-12, during TASK-254: `LocaleMap`, the typegen registry behind `Locale` (augmented in `.lumiose/types/routes.d.ts`, like `RouteMap`), and `lumiose({ site: "https://example.com" })`, the site origin for absolute `hreflang` and canonical URLs on prerendered pages. Pages rendered per request use the request origin; without `site`, prerendered localized pages fall back to root-relative URLs and `lumiose build` warns. `site` may include a path (user, 2026-10-12): `https://example.com/docs` makes `/docs/` the default Vite `base`; a `base` that differs from the site's path is a config error; absolute URLs are the site's origin plus the base-aware `href()` path, so the path is never counted twice.

## Consequences

- Prerendered static routes render once per declared locale.
- Independent of decision-42: optional segments remain a general routing feature.
- Tasks: TASK-254 (routing), TASK-255 (guide).
