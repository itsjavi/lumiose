---
id: TASK-261
title: >-
  i18n follow-ups: SPA head alternates, routes listing, Locale typing without
  i18n
status: In Progress
assignee:
  - Nova
created_date: '2026-10-12 20:55'
updated_date: '2026-10-12 21:56'
labels:
  - i18n
  - router
dependencies: []
priority: low
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-254 (Nova). (1) SPA navigations do not update hreflang/canonical links (server head only). (2) lumiose routes does not list each route's locales. (3) ctx.locale / locale() are typed Locale but undefined at runtime without lumiose({ i18n }); consider typing them Locale | undefined when LocaleMap is empty, without a new public name. (4) SPA pages with a locales() function load as a document on navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose routes lists each route's locales with lumiose({ i18n }): a LOCALES column and the configured locales in the header; JSON gains i18n, locales and localesFrom
- [ ] #2 locale(), ctx.locale and lumiose/router locale() are typed string | undefined while LocaleMap is empty (no i18n), Locale otherwise; no new public name
- [ ] #3 SPA pages with a locales() function: the trade-off of loading them as a document is recorded (docs and notes)
- [ ] #4 Item 5 (prefetch vs detection) is recorded as fixed in TASK-254 (6af11f1)
- [ ] #5 alternates(pattern?, params?): without arguments the current page; with a route pattern (and params typed like href()) that route's declared locales as [{ locale, href }]
- [ ] #6 The hard-coded ABOUT_LOCALES is gone from examples/ssr-i18n-paraglide and ssr-i18n-i18next, which use alternates("/about"); their e2e pass
- [ ] #7 Docs updated (concepts/i18n, guides/i18n, reference/app, router, cli, mcp) and regenerated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (TASK-255) 2026-10-12: (5) Prefetch vs detection: Chromium's speculation-rules prefetch of "/" (default rules, hover) made with the old locale cookie is a detection redirect, and Chromium reuses it after a language switcher changed the cookie, so switching to the default locale lands back on the old one (seen in examples/ssr-i18n-*; worked around there with <Link prefetch="none"> on the switcher links). Possible fixes, for Nova/Lux: answer requests with Sec-Purpose: prefetch that detection would redirect without the redirect (e.g. 503 + no-store, which Chromium discards), or leave "/" out of the speculation rules when detect.cookie is set. (6) Proposal only, no API decided: there is no way to ask which locales another route declares, so a layout linking an untranslated page hard-codes its locales (examples/ssr-i18n-*/src/routes/layout.stsx, ABOUT_LOCALES).

Nova 2026-10-12: (5) fixed in TASK-254 (6af11f1): speculation rules leave out / with detection on, and detecting requests with Sec-Purpose: prefetch get a 503 no-store the browser discards; the examples' prefetch="none" workaround is removed.

Lux 2026-10-12: user approved item 6 as alternates(pattern?, params?): no argument = the current page; with a route pattern (and params) = that route's declared locales as [{ locale, href }]. No new name. Remove the hard-coded ABOUT_LOCALES from the i18n examples once it exists.

Lux: item 1 (SPA alternates/canonical) split into its own task for Spark, after TASK-256.

Nova 2026-10-12 (solo worker, TASK-261 scope minus item 1, now TASK-263):
- alternates(pattern, params) is synchronous, like every other render-time API, and reads the manifest (route.locales, inherited from layouts, else the default locale). A route whose locales come from a locales({ params }) function throws a clear TypeError: rendering cannot await it. PROPOSAL for the user (API shape, not decided): an async form for function-declared routes (e.g. await alternates(pattern, params) returning a Promise for such routes, or a separate awaitable), if a real use case appears; content-driven links can be built from the content's translations with href({ locale }) meanwhile.
- params passed with a locale key are ignored (each locale overrides it). Unknown pattern: TypeError. Outside a request or without i18n: [].
- Locale typing: internal type CurrentLocale in routes/registry.ts (not exported from lumiose) = string | undefined while LocaleMap is empty, else Locale. Used by locale() (server and browser stubs), RequestContext.locale and lumiose/router locale(). The two lumiose/router lines (app/router/index.ts, index.server.ts) are Spark's area: a type-only change, required to keep the package typechecking once locale() returns CurrentLocale; Spark had no pending edits there.
- Item 4 (SPA pages with locales() load as a document): kept, trade-off recorded in concepts/i18n.md: the function is server code (content, database); only the server knows whether the URL exists, answers 404/redirect and writes hreflang. Shipping the function or adding a locale-check round trip to the client router is not worth it.
- Item 5: recorded above (Nova note, fixed in TASK-254, 6af11f1).
- lumiose routes: LOCALES column only with i18n (header names the locales and the default); 'locales() in <file>' for function-declared routes. JSON: i18n { locales, defaultLocale }, routes[].locales or routes[].localesFrom.
- Examples: layout aboutHref() = alternates("/about").find(current locale)?.href ?? href("/about", { locale: "en" }). Both examples' typecheck (lumiose check) and Playwright e2e pass (5/5 each).
<!-- SECTION:NOTES:END -->
