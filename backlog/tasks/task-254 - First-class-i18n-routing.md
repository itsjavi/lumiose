---
id: TASK-254
title: First-class i18n routing
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 20:54'
labels:
  - router
  - i18n
milestone: m-9
dependencies:
  - TASK-253
priority: medium
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-44. Router-level locale prefix (route files stay unprefixed), the request's locale, per-route locale declarations (list or function), locale-aware typed href(), hreflang only for declared locales, <html lang>, opt-in entry detection (Accept-Language/cookie), missing translation as 404 or redirect (site's choice), static prerender per declared locale. The configuration and API names go to the user for approval before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user approved the config shape and API names (recorded in decision-44)
- [x] #2 Routing, href(), hreflang, html lang, detection and prerendering work as decision-44 describes, with tests
- [x] #3 No automatic alternates or duplicate URLs for undeclared locales (tested)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: the user approved the config shape and API names (lumiose({ i18n }), export const locales / function locales, layout-level locales, locale(), ctx.locale, href(.., { locale }), alternates(), "all"); recorded in decision-44. Domains post-1.0.

Nova 2026-10-12: started (session nova-20261012T193255Z-t253).

Lux 2026-10-12 answers to Nova's questions (recorded by Nova):
1. LocaleMap (registry interface for the generated Locale type, like RouteMap/LayoutMap): go ahead; provisional public name, Lux confirms with the user.
2. hreflang/canonical URLs: per-request pages use the request origin (honors adapter-node origin/ORIGIN); prerendered pages use a new lumiose({ site: "https://example.com" }) option (provisional name, kept in one place). Without site, prerendered localized pages fall back to root-relative URLs and lumiose build warns, naming the option.
3. Canonical: automatic on pages that declare locales, as a default that a page's or layout's own canonical replaces (keyed dedupe like TASK-238 on link rel=canonical; never two). Tested.
4. x-default: not written.
5. Detection: Lumiose writes the configured cookie on a first visit. Redirect only when there is no cookie, or on / when the cookie names another locale; never on deep links when a cookie exists. Detection responses send Vary: Cookie, Accept-Language and are not cacheable. Docs: a switcher must update the cookie; detection needs the entry page rendered per request (a prerendered / served as a file never redirects). No switcher helper API without asking Lux.
6. Endpoints: same locales export and inheritance as pages; default locale only without one.

Lux 2026-10-12: the user approved LocaleMap and lumiose({ site }); no longer provisional (recorded in decision-44 by Lux). Docs: site in the Vite reference with the i18n page.

User via Lux 2026-10-12: site may have a path (lumiose({ site: "https://example.com/docs" })). Absolute URLs = the site's origin + the href() path, which already includes Vite's base (the site path never counted twice). If site has a path and Vite base is unset, the site path becomes base (set in the plugin's config hook so routes, assets and href() follow). Both set and different (trailing slash ignored): config error naming both values. Trailing slashes normalized; trailingSlash still applies. Tests: site with/without path, base inferred, base matching, mismatch error, absolute hreflang/canonical under a base on prerendered and per-request pages. Docs: Vite reference (site) and the i18n page.

Nova 2026-10-12, implementation:
- Config: lumiose({ i18n }) validated in lumiose/src/app/i18n/config.ts (resolveI18n; locales are URL path segments, defaults missing "404", detect false); lumiose({ site }) normalized with a trailing slash; a site path becomes Vite's base in the compiler plugin's config hook, a different base is a config error naming both. The plugin defines import.meta.env.LUMIOSE_I18N for href() and lumiose/router.
- Manifest: routes get locales (own export, else nearest layout's, else the default locale) or localesFrom (the file whose locales({ params }) decides); meta.ts reads export const locales (list, "all", function). Unknown locales and unreadable exports are LUM5002 errors, locales without i18n a LUM5002 warning, a param named locale LUM5007 (new code in registry.rs + docs page).
- Handler: strips the locale prefix before matching; undeclared locale -> 404 or redirect (302, 307 for other methods); ctx.locale, locale(), alternates(), request-aware href(); detection per Lux's rules (cookie written on first visits, not HttpOnly; Vary: Cookie, Accept-Language; private, no-store); <html lang> for the default and custom documents; hreflang for declared locales only (pages with 2+ locales) plus a canonical that is a keyed head default (document.ts now keys link rel=canonical, so the page's or layout's own replaces it). Absolute URLs: request origin, or site's origin while prerendering, root-relative without site.
- Build: prerender renders each declared locale per staticPaths entry; lumiose build warns about site; the server entry carries manifest.i18n and the site origin. Dev: the manifest scan gets project.i18n.
- Router: the client table carries i18n and static locales; prefixed URLs route only for declared locales (function locales -> document navigation); a locale change remounts every level; <html lang> follows; reactive locale(). Also fixed levelKey for [[param]] folders (TASK-253 leftover).
- Speculation rules leave out endpoints under every locale prefix.
- Evidence: pnpm typecheck, oxlint (no new warnings in my files; errors only in TASK-148's in-progress dev/morph files at the time), pnpm test 1759 passed, node --test scripts 31/31, size OK (brotli 9.89 kB), cargo test --workspace green, docs:gen/docs:check green. New tests: i18n/config.test.ts, server/i18n.test.ts (27), manifest locales + LUM5007, router locale navigation, typegen Locale (TS 7), build: prerender per locale, site base, site warning; options: i18n and site validation, base inference and mismatch.
- Not in scope / follow-ups: SPA navigations do not update hreflang/canonical links (server-rendered head only); x-default not written (agreed); lumiose routes JSON does not list locales.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
First-class i18n routing per decision-44: lumiose({ i18n: { locales, defaultLocale, missing, detect } }) serves the default locale unprefixed and the others under their prefix; pages, endpoints and layouts declare locales with export const locales (list, "all" or locales({ params })), and undeclared locales are 404s or redirects. locale(), ctx.locale, a reactive locale() in lumiose/router, the generated Locale type (LocaleMap), href(..., { locale }) and alternates(); <html lang>, hreflang only for declared locales and a replaceable canonical; detection on entry only; static prerendering per declared locale; lumiose({ site }) for absolute URLs of prerendered pages, its path becoming Vite's base. LUM5007 for a param named locale. Docs: concepts/i18n.md, routing, app/router/Vite references, LUM5002/LUM5007. Commit b22b491.
<!-- SECTION:FINAL_SUMMARY:END -->
