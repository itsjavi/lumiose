---
id: TASK-255
title: 'i18n guide: Paraglide JS and i18next'
status: Done
assignee:
  - Beacon
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 21:21'
labels:
  - docs
  - i18n
milestone: m-9
dependencies:
  - TASK-254
priority: medium
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a guide showing the most popular libraries end to end on the same small site, on top of the first-class i18n routing: Paraglide JS (compile-time messages) and i18next.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A docs page with both integrations: setup, messages in pages and islands, locale switching, SEO notes
- [x] #2 A tested example for each library
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: reassigned Nova -> Beacon (doc-heavy; Nova overloaded). Beacon may create its example app under examples/.

Beacon (session beacon-20261012T205618Z-t255) 2026-10-12: started. Plan: two examples, examples/ssr-i18n-paraglide and examples/ssr-i18n-i18next, on the same small site (home, about, a blog with a post translated into some locales, an island with messages, a language switcher via alternates() that updates the detection cookie), each with a Playwright e2e on the production build; guide at packages/lumiose/docs/guides/i18n.md registered in the docs index.

Beacon 2026-10-12: examples committed (434b0cd): examples/ssr-i18n-paraglide (Paraglide JS 2.27.0 + @inlang/plugin-message-format 4.5.0 loaded from node_modules, not the CDN; overwriteGetLocale(() => locale()) from lumiose/router in src/lib/i18n.ts; missing: "404") and examples/ssr-i18n-i18next (i18next 26.4.3; one server instance + getFixedT(locale()) in src/server/i18n.server.ts; islands get their namespace as a prop and create a small instance; typed keys via CustomTypeOptions; missing: "redirect"). Same site: / in all locales (per request, detection), /about in en+es (static, prerendered per locale with site), localized not-found, LocaleSwitcher island on alternates() that sets the locale cookie. Island chunk sizes (brotli): Basket 1.8 kB with Paraglide vs 12.5 kB with i18next. Found: Chromium reuses a prefetched detection redirect of "/" after the switcher changed the cookie; worked around with <Link prefetch="none"> and recorded in TASK-261 (5). Also noted in TASK-261 (6): no API to list another route's locales (layout hard-codes ABOUT_LOCALES). Guide: packages/lumiose/docs/guides/i18n.md, registered in docs/README.md, linked from concepts/i18n.md.

Beacon 2026-10-12: validation: both e2e suites green (5 tests each, also --repeat-each=3: 15/15 each), lumiose check clean in both, docs:gen/docs:check, docs and web content tests, and pnpm check (exit 0: typecheck, lint, fmt:examples, 1766 vitest tests, scripts tests, size, cargo test). Commits: 434b0cd (examples), 6d49d5d (guide, index, concept link, switcher style fix). Screenshot: backlog/assets/task-255-paraglide-fr.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Guide packages/lumiose/docs/guides/i18n.md (registered in the docs index, linked from concepts/i18n.md) and two tested samples of the same bakery site in en/es/fr: examples/ssr-i18n-paraglide (Paraglide JS: compile-time messages through its Vite plugin, getLocale() overwritten with locale() from lumiose/router, per request on the server and the page's in islands; missing: 404) and examples/ssr-i18n-i18next (i18next: one server instance with getFixedT(locale()), islands receive their namespace as a prop; typed keys; missing: redirect). Both have a language switcher island on alternates() that updates the detection cookie, a page in two locales prerendered with site, a localized not-found page and a Playwright e2e (localized page with hreflang/canonical, 404 or redirect, switcher + cookie, first-visit detection, island messages). Follow-ups in TASK-261: Chromium reuses a prefetched detection redirect of / after the cookie changed (switcher uses <Link prefetch=none>), and no API to list another route's locales. ![French home page](../assets/task-255-paraglide-fr.png)
<!-- SECTION:FINAL_SUMMARY:END -->
