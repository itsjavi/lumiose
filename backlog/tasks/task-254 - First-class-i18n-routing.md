---
id: TASK-254
title: First-class i18n routing
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 20:43'
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
- [ ] #2 Routing, href(), hreflang, html lang, detection and prerendering work as decision-44 describes, with tests
- [ ] #3 No automatic alternates or duplicate URLs for undeclared locales (tested)
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
<!-- SECTION:NOTES:END -->
