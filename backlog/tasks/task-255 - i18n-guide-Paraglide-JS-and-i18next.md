---
id: TASK-255
title: 'i18n guide: Paraglide JS and i18next'
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 21:17'
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
- [ ] #1 A docs page with both integrations: setup, messages in pages and islands, locale switching, SEO notes
- [ ] #2 A tested example for each library
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: reassigned Nova -> Beacon (doc-heavy; Nova overloaded). Beacon may create its example app under examples/.

Beacon (session beacon-20261012T205618Z-t255) 2026-10-12: started. Plan: two examples, examples/ssr-i18n-paraglide and examples/ssr-i18n-i18next, on the same small site (home, about, a blog with a post translated into some locales, an island with messages, a language switcher via alternates() that updates the detection cookie), each with a Playwright e2e on the production build; guide at packages/lumiose/docs/guides/i18n.md registered in the docs index.

Beacon 2026-10-12: examples committed (434b0cd): examples/ssr-i18n-paraglide (Paraglide JS 2.27.0 + @inlang/plugin-message-format 4.5.0 loaded from node_modules, not the CDN; overwriteGetLocale(() => locale()) from lumiose/router in src/lib/i18n.ts; missing: "404") and examples/ssr-i18n-i18next (i18next 26.4.3; one server instance + getFixedT(locale()) in src/server/i18n.server.ts; islands get their namespace as a prop and create a small instance; typed keys via CustomTypeOptions; missing: "redirect"). Same site: / in all locales (per request, detection), /about in en+es (static, prerendered per locale with site), localized not-found, LocaleSwitcher island on alternates() that sets the locale cookie. Island chunk sizes (brotli): Basket 1.8 kB with Paraglide vs 12.5 kB with i18next. Found: Chromium reuses a prefetched detection redirect of "/" after the switcher changed the cookie; worked around with <Link prefetch="none"> and recorded in TASK-261 (5). Also noted in TASK-261 (6): no API to list another route's locales (layout hard-codes ABOUT_LOCALES). Guide: packages/lumiose/docs/guides/i18n.md, registered in docs/README.md, linked from concepts/i18n.md.
<!-- SECTION:NOTES:END -->
